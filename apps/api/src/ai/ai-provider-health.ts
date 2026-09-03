import type { AiProvider } from "@clariodesk/types";

const TIMEOUT_MS = 8_000;

export type HealthCheckResult = { ok: boolean; error: string | null };

/**
 * Minimal, generation-free connectivity check per provider (docs/ai/
 * ai-native-byok-architecture.md: "Provider test connection and health
 * status"). Each call hits the cheapest endpoint that proves the key is
 * valid — never a completion/generation call, so testing a connection
 * never costs the workspace tokens.
 */
export async function checkAiProviderHealth(
  provider: AiProvider,
  apiKey: string,
  baseUrl?: string | null,
): Promise<HealthCheckResult> {
  try {
    switch (provider) {
      case "anthropic":
        return await pingUrl("https://api.anthropic.com/v1/models", {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        });
      case "openai":
        return await pingUrl("https://api.openai.com/v1/models", {
          Authorization: `Bearer ${apiKey}`,
        });
      case "google":
        // Header, not a query param -- avoids the key ending up in proxy/
        // load-balancer access logs the way a URL query string would.
        return await pingUrl(
          "https://generativelanguage.googleapis.com/v1beta/models",
          { "x-goog-api-key": apiKey },
        );
      case "azure_openai":
      case "custom":
        if (!baseUrl) {
          return {
            ok: false,
            error: "A base URL is required to test this provider",
          };
        }
        return await pingUrl(`${baseUrl.replace(/\/$/, "")}/models`, {
          Authorization: `Bearer ${apiKey}`,
          "api-key": apiKey,
        });
    }
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

async function pingUrl(
  url: string,
  headers: Record<string, string>,
): Promise<HealthCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.ok) return { ok: true, error: null };
    return { ok: false, error: `Provider responded with HTTP ${res.status}` };
  } finally {
    clearTimeout(timeout);
  }
}

// Never surface a raw error object — it could echo request details. Keep it
// to a short, generic classification.
function friendlyError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "Timed out reaching the provider";
  }
  return "Could not reach the provider";
}
