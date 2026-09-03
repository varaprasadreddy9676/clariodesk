import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCompletion } from "./ai-completion.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateCompletion", () => {
  it("extracts the text block from an Anthropic response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Sure, happy to help!" }],
        }),
      }),
    );
    const result = await generateCompletion(
      "anthropic",
      "sk-test",
      null,
      null,
      "system",
      [{ role: "user", content: "Where is my order?" }],
    );
    expect(result).toEqual({ ok: true, text: "Sure, happy to help!" });
  });

  it("extracts the message content from an OpenAI-compatible response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "It ships tomorrow." } }],
        }),
      }),
    );
    const result = await generateCompletion(
      "openai",
      "sk-test",
      null,
      null,
      "system",
      [{ role: "user", content: "When does it ship?" }],
    );
    expect(result).toEqual({ ok: true, text: "It ships tomorrow." });
  });

  it("extracts the joined parts from a Google response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: "Got it, " }, { text: "thanks!" }] } },
          ],
        }),
      }),
    );
    const result = await generateCompletion(
      "google",
      "sk-test",
      null,
      null,
      "system",
      [{ role: "user", content: "Ok" }],
    );
    expect(result).toEqual({ ok: true, text: "Got it, thanks!" });
  });

  it("requires a base URL for custom/self-hosted providers", async () => {
    const result = await generateCompletion(
      "custom",
      "key",
      undefined,
      null,
      "system",
      [{ role: "user", content: "Hi" }],
    );
    expect(result).toEqual({
      ok: false,
      error: "This connection has no base URL configured",
    });
  });

  it("reports the HTTP status when the provider rejects the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    const result = await generateCompletion(
      "openai",
      "bad-key",
      null,
      null,
      "system",
      [{ role: "user", content: "Hi" }],
    );
    expect(result).toEqual({
      ok: false,
      error: "Provider responded with HTTP 401",
    });
  });

  it("never sends the API key in the URL — header only, for every provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "ok" }],
        choices: [{ message: { content: "ok" } }],
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    for (const provider of ["anthropic", "openai", "google"] as const) {
      fetchMock.mockClear();
      await generateCompletion(provider, "sk-secret", null, null, "system", [
        { role: "user", content: "Hi" },
      ]);
      const [url] = fetchMock.mock.calls[0] as [string, unknown];
      expect(url).not.toContain("sk-secret");
    }
  });

  it("does not throw the raw error back to the caller on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")),
    );
    const result = await generateCompletion(
      "openai",
      "sk-test",
      null,
      null,
      "system",
      [{ role: "user", content: "Hi" }],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("ENOTFOUND");
  });
});
