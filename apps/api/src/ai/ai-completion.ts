import type { AiProvider } from "@clariodesk/types";

const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 300;

const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  azure_openai: "gpt-4o-mini",
  custom: "gpt-4o-mini",
};

export type CompletionMessage = { role: "user" | "assistant"; content: string };

export type CompletionResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Generation call, unlike ai-provider-health.ts's connectivity-only ping —
 * this is what actually spends the workspace's tokens, so it's only ever
 * invoked on an explicit user action (draft reply), never on a schedule or
 * as a side effect of saving/testing a connection.
 */
export async function generateCompletion(
  provider: AiProvider,
  apiKey: string,
  baseUrl: string | null | undefined,
  model: string | null | undefined,
  systemPrompt: string,
  messages: CompletionMessage[],
): Promise<CompletionResult> {
  const resolvedModel = model ?? DEFAULT_MODEL[provider];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    switch (provider) {
      case "anthropic":
        return await callAnthropic(
          apiKey,
          resolvedModel,
          systemPrompt,
          messages,
          controller.signal,
        );
      case "openai":
        return await callOpenAiCompatible(
          "https://api.openai.com/v1/chat/completions",
          apiKey,
          resolvedModel,
          systemPrompt,
          messages,
          controller.signal,
        );
      case "google":
        return await callGoogle(
          apiKey,
          resolvedModel,
          systemPrompt,
          messages,
          controller.signal,
        );
      case "azure_openai":
      case "custom":
        if (!baseUrl) {
          return {
            ok: false,
            error: "This connection has no base URL configured",
          };
        }
        return await callOpenAiCompatible(
          `${baseUrl.replace(/\/$/, "")}/chat/completions`,
          apiKey,
          resolvedModel,
          systemPrompt,
          messages,
          controller.signal,
        );
    }
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: CompletionMessage[],
  signal: AbortSignal,
): Promise<CompletionResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok)
    return { ok: false, error: `Provider responded with HTTP ${res.status}` };
  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content
    ?.find((block) => block.type === "text")
    ?.text?.trim();
  if (!text) return { ok: false, error: "Provider returned an empty response" };
  return { ok: true, text };
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: CompletionMessage[],
  signal: AbortSignal,
): Promise<CompletionResult> {
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok)
    return { ok: false, error: `Provider responded with HTTP ${res.status}` };
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "Provider returned an empty response" };
  return { ok: true, text };
}

async function callGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: CompletionMessage[],
  signal: AbortSignal,
): Promise<CompletionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
  });
  if (!res.ok)
    return { ok: false, error: `Provider responded with HTTP ${res.status}` };
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) return { ok: false, error: "Provider returned an empty response" };
  return { ok: true, text };
}

// Never surface a raw error object back to the caller — keep it to a short,
// generic classification, matching ai-provider-health.ts.
function friendlyError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "Timed out reaching the provider";
  }
  return "Could not reach the provider";
}
