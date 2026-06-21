import { describe, expect, it, vi } from "vitest";
import { OpenWaAdapter } from "./openwa.js";

describe("OpenWaAdapter", () => {
  it("maps a ready session to connected status", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          { id: "session-1", name: "customer-support", status: "ready" },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const adapter = new OpenWaAdapter({
      baseUrl: "http://openwa.example",
      apiKey: "openwa-key",
      fetchFn,
    });

    await expect(
      adapter.getConnectionStatus({ providerInstanceId: "customer-support" }),
    ).resolves.toBe("connected");
  });

  it("fetches OpenWA groups and maps them into the gateway contract", async () => {
    const fetchFn = vi.fn(async (url: string | URL) => {
      const path = String(url);
      if (path.endsWith("/api/sessions")) {
        return new Response(
          JSON.stringify([
            { id: "session-1", name: "customer-support", status: "ready" },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          { id: "120363000000@g.us", name: "Client A Support" },
          { id: "120363000001@g.us", name: "Client B Implementation" },
          { name: "missing id" },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const adapter = new OpenWaAdapter({
      baseUrl: "http://openwa.example/",
      apiKey: "openwa-key",
      fetchFn,
    });

    await expect(
      adapter.fetchGroups({ providerInstanceId: "customer-support" }),
    ).resolves.toEqual([
      {
        providerChatId: "120363000000@g.us",
        title: "Client A Support",
        channelType: "group",
      },
      {
        providerChatId: "120363000001@g.us",
        title: "Client B Implementation",
        channelType: "group",
      },
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "http://openwa.example/api/sessions/session-1/groups",
      expect.objectContaining({
        method: "GET",
        headers: { "x-api-key": "openwa-key" },
      }),
    );
  });

  it("sends text through the resolved OpenWA session", async () => {
    const fetchFn = vi.fn(async (url: string | URL) => {
      const path = String(url);
      if (path.endsWith("/api/sessions")) {
        return new Response(
          JSON.stringify([
            { id: "session-1", name: "customer-support", status: "ready" },
          ]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ messageId: "MSG1", timestamp: 1 }), {
        status: 201,
      });
    }) as unknown as typeof fetch;

    const adapter = new OpenWaAdapter({
      baseUrl: "http://openwa.example",
      apiKey: "openwa-key",
      fetchFn,
    });

    await expect(
      adapter.sendText({
        providerInstanceId: "customer-support",
        providerChatId: "120363000000@g.us",
        body: "Hello",
      }),
    ).resolves.toEqual({ providerMessageId: "MSG1" });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://openwa.example/api/sessions/session-1/messages/send-text",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chatId: "120363000000@g.us", text: "Hello" }),
      }),
    );
  });
});
