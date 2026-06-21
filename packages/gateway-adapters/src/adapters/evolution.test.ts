import { describe, expect, it, vi } from "vitest";
import { EvolutionAdapter, normalizeEvolutionWebhook } from "./evolution.js";

const groupTextHook = {
  event: "messages.upsert",
  instance: "support",
  data: {
    key: {
      id: "MSG1",
      remoteJid: "120363000000@g.us",
      fromMe: false,
      participant: "919876543210@s.whatsapp.net",
    },
    pushName: "Client Ravi",
    messageTimestamp: 1717000000,
    message: { conversation: "The portal is down" },
  },
};

describe("normalizeEvolutionWebhook", () => {
  it("normalizes a group text message", () => {
    const [evt] = normalizeEvolutionWebhook(groupTextHook);
    expect(evt).toMatchObject({
      adapterType: "evolution",
      providerMessageId: "MSG1",
      providerChatId: "120363000000@g.us",
      channelType: "group",
      messageType: "text",
      direction: "inbound",
      body: "The portal is down",
      providerSenderId: "919876543210@s.whatsapp.net",
      providerTimestampMs: 1717000000_000,
      isHistorySync: false,
    });
  });

  it("converts second timestamps to milliseconds", () => {
    const [evt] = normalizeEvolutionWebhook(groupTextHook);
    expect(evt?.providerTimestampMs).toBe(1717000000 * 1000);
  });

  it("flags history-sync batches as backfill source", () => {
    const evts = normalizeEvolutionWebhook({
      event: "messaging-history.set",
      data: [groupTextHook.data],
    });
    expect(evts).toHaveLength(1);
    expect(evts[0]?.isHistorySync).toBe(true);
  });

  it("marks fromMe messages as outbound (ghost-agent echo)", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "messages.upsert",
      data: {
        ...groupTextHook.data,
        key: { ...groupTextHook.data.key, fromMe: true },
      },
    });
    expect(evt?.direction).toBe("outbound");
  });

  it("treats 1:1 chats as direct and uses remoteJid as sender", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "messages.upsert",
      data: {
        key: {
          id: "M2",
          remoteJid: "919999999999@s.whatsapp.net",
          fromMe: false,
        },
        messageTimestamp: 1717000001,
        message: { extendedTextMessage: { text: "hi" } },
      },
    });
    expect(evt?.channelType).toBe("direct");
    expect(evt?.providerSenderId).toBe("919999999999@s.whatsapp.net");
    expect(evt?.body).toBe("hi");
  });

  it("extracts image media with caption and stamps providerMediaId", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "messages.upsert",
      data: {
        key: {
          id: "IMG1",
          remoteJid: "120363@g.us",
          participant: "p@s.whatsapp.net",
        },
        messageTimestamp: 1717000002,
        message: {
          imageMessage: {
            caption: "see error",
            mimetype: "image/jpeg",
            fileLength: 1234,
            mediaKey: "KEY",
          },
        },
      },
    });
    expect(evt?.messageType).toBe("image");
    expect(evt?.body).toBe("see error");
    expect(evt?.media?.[0]).toMatchObject({
      mediaType: "image",
      mimeType: "image/jpeg",
      sizeBytes: 1234,
      providerMediaId: "IMG1",
      providerMediaKey: "KEY",
    });
  });

  it("classifies reactions distinctly so they can be excluded from SLA", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "messages.upsert",
      data: {
        key: {
          id: "R1",
          remoteJid: "120363@g.us",
          participant: "p@s.whatsapp.net",
        },
        messageTimestamp: 1717000003,
        message: { reactionMessage: { text: "👍" } },
      },
    });
    expect(evt?.messageType).toBe("reaction");
  });

  it("detects delete-for-everyone (REVOKE) and targets the original message", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "messages.upsert",
      data: {
        key: {
          id: "DEL1",
          remoteJid: "120363@g.us",
          participant: "p@s.whatsapp.net",
        },
        messageTimestamp: 1717000004,
        message: {
          protocolMessage: { type: "REVOKE", key: { id: "TARGET-MSG" } },
        },
      },
    });
    expect(evt?.messageType).toBe("deleted");
    expect(evt?.revokeTargetProviderMessageId).toBe("TARGET-MSG");
  });

  it("normalizes group title updates into metadata review events", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "GROUPS_UPDATE",
      timestamp: 1717000010,
      data: {
        id: "120363@g.us",
        subject: "Production Escalations",
      },
    });
    expect(evt).toMatchObject({
      adapterType: "evolution",
      providerChatId: "120363@g.us",
      channelType: "group",
      messageType: "system",
      direction: "inbound",
      providerTimestampMs: 1717000010_000,
      systemEventType: "groups.update",
      groupMetadata: {
        eventType: "subject_changed",
        newValue: "Production Escalations",
      },
    });
  });

  it("normalizes group participant updates into metadata review events", () => {
    const [evt] = normalizeEvolutionWebhook({
      event: "group-participants.update",
      data: {
        jid: "120363@g.us",
        participants: ["919000000000@s.whatsapp.net"],
        action: "remove",
      },
    });
    expect(evt).toMatchObject({
      providerChatId: "120363@g.us",
      messageType: "system",
      systemEventType: "group.participants.update",
      groupMetadata: {
        eventType: "participant_removed",
        newValue: "919000000000@s.whatsapp.net",
      },
    });
  });

  it("is total — never throws on malformed payloads", () => {
    expect(normalizeEvolutionWebhook(null)).toEqual([]);
    expect(normalizeEvolutionWebhook(undefined)).toEqual([]);
    expect(normalizeEvolutionWebhook({})).toEqual([]);
    expect(
      normalizeEvolutionWebhook({ event: "messages.upsert", data: {} }),
    ).toEqual([]);
    expect(
      normalizeEvolutionWebhook({ event: "x", data: { key: { id: "1" } } }),
    ).toEqual([]);
  });
});

describe("EvolutionAdapter", () => {
  it("fetches groups from Evolution and maps them into the gateway contract", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(
        JSON.stringify([
          { id: "120363000000@g.us", subject: "Client A Support", size: 14 },
          { id: "120363000001@g.us", subject: "Client B Implementation" },
          { subject: "missing id" },
        ]),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const adapter = new EvolutionAdapter({
      baseUrl: "https://evolution.example.com/",
      apiKey: "evo-secret",
      fetchFn,
    });

    await expect(
      adapter.fetchGroups({ providerInstanceId: "support-line" }),
    ).resolves.toEqual([
      {
        providerChatId: "120363000000@g.us",
        title: "Client A Support",
        channelType: "group",
        participantCount: 14,
      },
      {
        providerChatId: "120363000001@g.us",
        title: "Client B Implementation",
        channelType: "group",
      },
    ]);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://evolution.example.com/group/fetchAllGroups/support-line?getParticipants=false",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          apikey: "evo-secret",
        }),
      }),
    );
  });
});
