import { describe, expect, it, vi } from "vitest";
import { ClarioGatewayAdapter } from "./clario-gateway.js";

describe("ClarioGatewayAdapter", () => {
  it("maps gateway status into connection info", async () => {
    const fetchFn = vi.fn(async () => {
      return json({
        id: "phone-1",
        name: "Support",
        status: "ready",
        phone: "919533322607",
        pushName: "Sai",
      });
    }) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.getConnectionInfo({ providerInstanceId: "phone-1" }),
    ).resolves.toEqual({
      status: "connected",
      phoneNumber: "919533322607",
      displayName: "Sai",
    });
  });

  it("fetches groups from the owned gateway contract", async () => {
    const fetchFn = vi.fn(async () =>
      json([
        { id: "120363@g.us", name: "Client Support", participantsCount: 9 },
        { name: "missing id" },
      ]),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway/",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.fetchGroups({ providerInstanceId: "phone-1" }),
    ).resolves.toEqual([
      {
        providerChatId: "120363@g.us",
        title: "Client Support",
        channelType: "group",
        participantCount: 9,
      },
    ]);
  });

  it("fetches all chats from the owned gateway contract", async () => {
    const fetchFn = vi.fn(async () =>
      json([
        { id: "120363@g.us", name: "Client Support", participantsCount: 9 },
        { id: "9199@c.us", name: "Client Owner" },
      ]),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway/",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.fetchChats?.({ providerInstanceId: "phone-1" }),
    ).resolves.toEqual([
      {
        providerChatId: "120363@g.us",
        title: "Client Support",
        channelType: "group",
        participantCount: 9,
      },
      {
        providerChatId: "9199@c.us",
        title: "Client Owner",
        channelType: "direct",
        participantCount: undefined,
      },
    ]);
  });

  it("fetches chat messages and maps timestamps/direction", async () => {
    const fetchFn = vi.fn(async () =>
      json([
        {
          id: "MSG1",
          chatId: "120363@g.us",
          senderId: "9199@c.us",
          body: "Need help",
          type: "chat",
          timestamp: 1781360000,
          fromMe: false,
        },
      ]),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.fetchMessages?.({
        providerInstanceId: "phone-1",
        providerChatId: "120363@g.us",
        limit: 20,
      }),
    ).resolves.toEqual([
      {
        providerMessageId: "MSG1",
        providerChatId: "120363@g.us",
        providerSenderId: "9199@c.us",
        body: "Need help",
        messageType: "text",
        direction: "inbound",
        providerTimestampMs: 1781360000000,
        quotedProviderMessageId: null,
        hasMedia: false,
      },
    ]);
  });

  it("normalizes media messages with an opaque downloadable media handle", () => {
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
    });

    const [event] = adapter.normalizeWebhook({
      providerInstanceId: "phone-1",
      payload: {
        event: "message.received",
        message: {
          id: "MSG-MEDIA",
          chatId: "120363@g.us",
          senderId: "9199@c.us",
          type: "image",
          timestamp: 1781360000,
          hasMedia: true,
        },
      },
    });

    expect(event).toEqual(
      expect.objectContaining({
        messageType: "image",
        media: [
          expect.objectContaining({
            mediaType: "image",
            providerMediaId: expect.any(String),
          }),
        ],
      }),
    );
  });

  it("downloads media through the owned gateway media endpoint", async () => {
    const handle = Buffer.from(
      JSON.stringify({ chatId: "120363@g.us", messageId: "MSG-MEDIA" }),
      "utf8",
    ).toString("base64url");
    const fetchFn = vi.fn(async () =>
      json({
        data: Buffer.from("hello-media").toString("base64"),
        mimeType: "image/png",
        fileName: "proof.png",
      }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.downloadMedia({
        providerInstanceId: "phone-1",
        providerMediaId: handle,
      }),
    ).resolves.toEqual({
      bytes: Uint8Array.from(Buffer.from("hello-media")),
      mimeType: "image/png",
      fileName: "proof.png",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/chats/120363%40g.us/messages/MSG-MEDIA/media",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends media through the owned gateway media endpoint", async () => {
    const fetchFn = vi.fn(async () =>
      json({ messageId: "OUT-MEDIA" }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.sendMedia({
        providerInstanceId: "phone-1",
        providerChatId: "120363@g.us",
        mediaBase64: Buffer.from("hello").toString("base64"),
        mimeType: "image/png",
        fileName: "hello.png",
        caption: "Attached",
      }),
    ).resolves.toEqual({ providerMessageId: "OUT-MEDIA" });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/messages/send-media",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"chatId":"120363@g.us"'),
      }),
    );
  });

  it("normalizes live gateway webhooks", () => {
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
    });

    expect(
      adapter.normalizeWebhook({
        providerInstanceId: "phone-1",
        payload: {
          event: "message.received",
          message: {
            id: "MSG1",
            chatId: "120363@g.us",
            senderId: "9199@c.us",
            body: "Need help",
            type: "chat",
            timestamp: 1781360000,
            fromMe: false,
          },
        },
      }),
    ).toEqual([
      expect.objectContaining({
        adapterType: "clario_gateway",
        providerMessageId: "MSG1",
        providerChatId: "120363@g.us",
        providerSenderId: "9199@c.us",
        channelType: "group",
        messageType: "text",
        direction: "inbound",
        body: "Need help",
        providerTimestampMs: 1781360000000,
        isHistorySync: false,
      }),
    ]);
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 });
}
