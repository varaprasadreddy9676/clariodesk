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
        avatarUrl: null,
      },
    ]);
  });

  it("fetches all chats from the owned gateway contract", async () => {
    const fetchFn = vi.fn(async () =>
      json([
        { id: "120363@g.us", name: "Client Support", participantsCount: 9 },
        {
          id: "9199@c.us",
          name: "Client Owner",
          avatarUrl: "https://example.test/avatar.jpg",
        },
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
        avatarUrl: null,
      },
      {
        providerChatId: "9199@c.us",
        title: "Client Owner",
        channelType: "direct",
        participantCount: undefined,
        avatarUrl: "https://example.test/avatar.jpg",
      },
    ]);
  });

  it("fetches confirmed metadata for one chat", async () => {
    const fetchFn = vi.fn(async () =>
      json({
        id: "120363@g.us",
        name: "Client Support",
        channelType: "group",
        avatarUrl: null,
        participantsCount: 9,
        isPinned: true,
        isMuted: false,
        isArchived: false,
      }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.fetchChat?.({
        providerInstanceId: "phone-1",
        providerChatId: "120363@g.us",
      }),
    ).resolves.toEqual({
      providerChatId: "120363@g.us",
      title: "Client Support",
      channelType: "group",
      avatarUrl: null,
      participantCount: 9,
      isPinned: true,
      isMuted: false,
      isArchived: false,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/chats/120363%40g.us",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each([
    [{ action: "pin", pinned: true }],
    [{ action: "mute", muted: false }],
    [{ action: "archive", archived: true }],
    [{ action: "mark_unread", markedUnread: true }],
  ] as const)("sets a confirmed chat target state for %o", async (action) => {
    const fetchFn = vi.fn(async () =>
      json({
        id: "120363@g.us",
        name: "Client Support",
        channelType: "group",
        isPinned: action.action === "pin" ? action.pinned : false,
        isMuted: action.action === "mute" ? action.muted : false,
        isArchived: action.action === "archive" ? action.archived : false,
      }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await adapter.setChatState?.({
      providerInstanceId: "phone-1",
      providerChatId: "120363@g.us",
      ...action,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/chats/120363%40g.us/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(action),
      }),
    );
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

  it("resolves a WhatsApp number through the owned gateway", async () => {
    const fetchFn = vi.fn(async () =>
      json({ registered: true, providerContactId: "919876543210@c.us" }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.resolveNumber?.({
        providerInstanceId: "phone-1",
        phoneNumber: "+91 98765 43210",
      }),
    ).resolves.toEqual({
      registered: true,
      providerContactId: "919876543210@c.us",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/contacts/resolve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phoneNumber: "+91 98765 43210" }),
      }),
    );
  });

  it("creates a WhatsApp group through the owned gateway", async () => {
    const fetchFn = vi.fn(async () =>
      json({ providerChatId: "120363000000@g.us" }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.createGroup?.({
        providerInstanceId: "phone-1",
        title: "Acme Support",
        participantIds: ["919876543210@c.us"],
      }),
    ).resolves.toEqual({ providerChatId: "120363000000@g.us" });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/groups",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Acme Support",
          participantIds: ["919876543210@c.us"],
        }),
      }),
    );
  });

  it("reacts to a message through the owned gateway endpoint", async () => {
    const fetchFn = vi.fn(async () =>
      json({ ok: true }),
    ) as unknown as typeof fetch;
    const adapter = new ClarioGatewayAdapter({
      baseUrl: "http://gateway",
      apiKey: "key",
      fetchFn,
    });

    await expect(
      adapter.reactToMessage?.({
        providerInstanceId: "phone-1",
        providerChatId: "120363@g.us",
        providerMessageId: "MSG-1",
        reaction: "👍",
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://gateway/sessions/phone-1/messages/react",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"reaction":"👍"'),
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
