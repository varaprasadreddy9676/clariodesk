import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAiProviderHealth } from "./ai-provider-health.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkAiProviderHealth", () => {
  it("reports ok when the provider responds successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    const result = await checkAiProviderHealth("anthropic", "sk-test");
    expect(result).toEqual({ ok: true, error: null });
  });

  it("reports the HTTP status when the provider rejects the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const result = await checkAiProviderHealth("openai", "bad-key");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });

  it("never sends the API key in the URL — header only, for every provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    for (const provider of ["anthropic", "openai", "google"] as const) {
      fetchMock.mockClear();
      await checkAiProviderHealth(provider, "sk-secret");
      const [url] = fetchMock.mock.calls[0] as [string, unknown];
      expect(url).not.toContain("sk-secret");
    }
  });

  it("requires a base URL for custom/self-hosted providers", async () => {
    const result = await checkAiProviderHealth("custom", "key", undefined);
    expect(result).toEqual({
      ok: false,
      error: "A base URL is required to test this provider",
    });
  });

  it("does not throw the raw error back to the caller on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")),
    );
    const result = await checkAiProviderHealth("openai", "sk-test");
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("ENOTFOUND");
  });
});
