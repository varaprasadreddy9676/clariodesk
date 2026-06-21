import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

export type RouteHandler = (ctx: RequestContext) => Promise<unknown> | unknown;

export type RequestContext = {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
};

type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
};

export class HttpApp {
  private readonly routes: Route[] = [];

  constructor(private readonly opts: { apiKey: string }) {}

  get(path: string, handler: RouteHandler): void {
    this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.add("POST", path, handler);
  }

  listen(port: number, host = "0.0.0.0"): void {
    createServer((req, res) => {
      void this.handle(req, res);
    }).listen(port, host);
  }

  private add(method: string, path: string, handler: RouteHandler): void {
    const keys: string[] = [];
    const pattern = new RegExp(
      `^${path
        .split("/")
        .map((part) => {
          if (part.startsWith(":")) {
            keys.push(part.slice(1));
            return "([^/]+)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/")}$`,
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const route = this.routes.find((candidate) => {
        return (
          candidate.method === req.method &&
          candidate.pattern.test(url.pathname)
        );
      });
      if (!route) return send(res, 404, { error: "not_found" });
      if (
        url.pathname !== "/health" &&
        req.headers["x-api-key"] !== this.opts.apiKey
      ) {
        return send(res, 401, { error: "unauthorized" });
      }
      const match = route.pattern.exec(url.pathname);
      const params = Object.fromEntries(
        route.keys.map((key, index) => [
          key,
          decodeURIComponent(match?.[index + 1] ?? ""),
        ]),
      );
      const body = await readJson(req);
      const result = await route.handler({
        req,
        res,
        params,
        query: url.searchParams,
        body,
      });
      if (!res.writableEnded) send(res, 200, result ?? {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "request failed";
      send(res, 500, { error: "internal_error", message });
    }
  }
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}
