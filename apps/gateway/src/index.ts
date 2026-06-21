import "dotenv/config";
import { HttpApp, requireObject } from "./http.js";
import {
  SessionManager,
  type ChatStateAction,
  type GatewayMessage,
} from "./session-manager.js";

const port = readInt(process.env.CLARIO_GATEWAY_PORT, 2786);

// Fail fast on missing required secrets rather than silently disabling features
const apiKey = process.env.CLARIO_GATEWAY_API_KEY;
if (!apiKey) throw new Error("CLARIO_GATEWAY_API_KEY is required");
const webhookSecretRaw =
  process.env.CLARIO_GATEWAY_WEBHOOK_SECRET ??
  process.env.GATEWAY_WEBHOOK_SECRET;
if (!webhookSecretRaw) throw new Error("CLARIO_GATEWAY_WEBHOOK_SECRET is required");
const webhookSecret: string = webhookSecretRaw;

const dataDir = process.env.CLARIO_GATEWAY_DATA_DIR ?? "./.clario-gateway";
const webhookBaseUrl =
  process.env.CLARIO_API_WEBHOOK_BASE_URL ??
  `http://localhost:${process.env.API_PORT ?? "4000"}/api`;

const manager = new SessionManager({
  dataDir,
  puppeteerArgs: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ],
});

const app = new HttpApp({ apiKey });

app.get("/health", () => ({ ok: true }));
app.get("/sessions", () => manager.list());
app.post("/sessions", ({ body }) => {
  const input = requireObject(body);
  const id = stringField(input, "id") ?? stringField(input, "name");
  if (!id) throw new Error("id or name is required");
  return manager.getOrCreate(id, stringField(input, "name") ?? id).snapshot();
});
app.post("/sessions/:id/start", async ({ params, body }) => {
  const input = requireObject(body);
  const sessionId = requiredParam(params, "id");
  const session = manager.getOrCreate(
    sessionId,
    stringField(input, "name") ?? sessionId,
  );
  if (session.listenerCount("message") === 0) {
    session.on("message", (message: GatewayMessage) => {
      void forwardWebhook(sessionId, message);
    });
  }
  await session.start();
  return session.snapshot();
});
app.get("/sessions/:id/status", ({ params }) =>
  manager.get(requiredParam(params, "id")).snapshot(),
);
app.get("/sessions/:id/qr", ({ params }) =>
  manager.get(requiredParam(params, "id")).getQr(),
);
app.post("/sessions/:id/stop", async ({ params }) => {
  await manager.get(requiredParam(params, "id")).stop();
  return { ok: true };
});
app.post("/sessions/:id/logout", async ({ params }) => {
  // getOrCreate so logout works even if the session is not in memory
  // (e.g. after a gateway restart) — it still clears persisted auth data.
  await manager.getOrCreate(requiredParam(params, "id")).logout();
  return { ok: true };
});
app.get("/sessions/:id/groups", ({ params }) =>
  manager.get(requiredParam(params, "id")).groups(),
);
app.post("/sessions/:id/contacts/resolve", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .resolveNumber(requiredString(input, "phoneNumber"));
});
app.post("/sessions/:id/groups", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .createGroup(
      requiredString(input, "title"),
      requiredStringArray(input, "participantIds"),
    );
});
app.get("/sessions/:id/chats", ({ params }) =>
  manager.get(requiredParam(params, "id")).chats(),
);
app.get("/sessions/:id/chats/:chatId", ({ params }) =>
  manager
    .get(requiredParam(params, "id"))
    .chat(requiredParam(params, "chatId")),
);
app.post("/sessions/:id/chats/:chatId/actions", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .setChatState(
      requiredParam(params, "chatId"),
      parseChatStateAction(input),
    );
});
app.get("/sessions/:id/chats/:chatId/messages", ({ params, query }) => {
  return manager
    .get(requiredParam(params, "id"))
    .messages(requiredParam(params, "chatId"), readInt(query.get("limit"), 50));
});
app.post("/sessions/:id/messages/send-text", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .sendText(requiredString(input, "chatId"), requiredString(input, "text"));
});
app.post("/sessions/:id/messages/send-media", ({ params, body }) => {
  const input = requireObject(body);
  return manager.get(requiredParam(params, "id")).sendMedia({
    chatId: requiredString(input, "chatId"),
    mediaBase64: requiredString(input, "mediaBase64"),
    mimeType: requiredString(input, "mimeType"),
    fileName: stringField(input, "fileName"),
    caption: stringField(input, "caption"),
  });
});
app.post("/sessions/:id/messages/reply", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .reply(
      requiredString(input, "chatId"),
      requiredString(input, "messageId"),
      requiredString(input, "text"),
    );
});
app.post("/sessions/:id/messages/react", ({ params, body }) => {
  const input = requireObject(body);
  return manager
    .get(requiredParam(params, "id"))
    .react(
      requiredString(input, "messageId"),
      requiredString(input, "reaction"),
    );
});
app.get(
  "/sessions/:id/chats/:chatId/messages/:messageId/media",
  ({ params }) => {
    return manager
      .get(requiredParam(params, "id"))
      .downloadMedia(
        requiredParam(params, "chatId"),
        requiredParam(params, "messageId"),
      );
  },
);

app.listen(port);
console.log(`clario gateway listening on :${port}`);

async function shutdown(signal: string): Promise<void> {
  console.log(`gateway received ${signal} — stopping all sessions`);
  const sessions = manager.list();
  await Promise.all(
    sessions.map((s) =>
      manager
        .get(s.id)
        .stop()
        .catch((err: unknown) =>
          console.error(`failed to stop session ${s.id}:`, err),
        ),
    ),
  );
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

async function forwardWebhook(
  sessionId: string,
  message: GatewayMessage,
): Promise<void> {
  const url = `${webhookBaseUrl.replace(/\/+$/, "")}/gateway-webhooks/clario_gateway/${encodeURIComponent(sessionId)}`;
  const MAX_ATTEMPTS = 12; // up to ~60s total — covers a full API restart
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({ event: "message.received", sessionId, message }),
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.min(250 * Math.pow(2, attempt - 1), 8000);
      await sleep(delay);
    }
  }
  console.error(
    `gateway webhook delivery failed for session ${sessionId} after ${MAX_ATTEMPTS} attempts: ${lastError}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stringField(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredStringArray(
  input: Record<string, unknown>,
  key: string,
): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${key} must be a non-empty array`);
  }
  const strings = value.map((item) =>
    typeof item === "string" ? item.trim() : "",
  );
  if (strings.some((item) => !item)) {
    throw new Error(`${key} must contain only non-empty strings`);
  }
  return strings;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = stringField(input, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function requiredParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) throw new Error(`${key} parameter is required`);
  return value;
}

function parseChatStateAction(
  input: Record<string, unknown>,
): ChatStateAction {
  switch (requiredString(input, "action")) {
    case "pin":
      return { action: "pin", pinned: requiredBoolean(input, "pinned") };
    case "mute":
      return { action: "mute", muted: requiredBoolean(input, "muted") };
    case "archive":
      return {
        action: "archive",
        archived: requiredBoolean(input, "archived"),
      };
    case "mark_unread":
      if (input.markedUnread !== true) {
        throw new Error("markedUnread must be true");
      }
      return { action: "mark_unread", markedUnread: true };
    default:
      throw new Error("Unsupported chat action");
  }
}

function requiredBoolean(
  input: Record<string, unknown>,
  key: string,
): boolean {
  const value = input[key];
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}
