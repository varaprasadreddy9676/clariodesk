import { describe, expect, it, vi } from "vitest";
import { GatewaySession } from "./session-manager.js";

function readySession(
  socket: Record<string, unknown>,
  chatMeta?: Record<string, unknown>,
) {
  const session = new GatewaySession({
    id: "phone-1",
    name: "Support",
    dataDir: "/tmp/clario-gateway-tests",
  });
  const internals = session as unknown as Record<string, unknown>;
  Object.assign(internals, { socket, status: "ready" });
  if (chatMeta) {
    (internals.chatMeta as Map<string, unknown>).set("120363@g.us", chatMeta);
  }
  return session;
}

describe("GatewaySession conversation operations", () => {
  it("normalizes and resolves a registered WhatsApp number", async () => {
    const onWhatsApp = vi.fn(async () => [
      { jid: "919876543210@s.whatsapp.net", exists: true },
    ]);
    const session = readySession({ onWhatsApp });

    await expect(session.resolveNumber("+91 98765-43210")).resolves.toEqual({
      registered: true,
      providerContactId: "919876543210@s.whatsapp.net",
    });
    expect(onWhatsApp).toHaveBeenCalledWith("919876543210");
  });

  it("reports an unregistered WhatsApp number", async () => {
    const session = readySession({
      onWhatsApp: vi.fn(async () => [{ jid: "", exists: false }]),
    });

    await expect(session.resolveNumber("+15551234567")).resolves.toEqual({
      registered: false,
      providerContactId: null,
    });
  });

  it("creates a group and normalizes the provider group id", async () => {
    const groupCreate = vi.fn(async () => ({
      id: "120363000000@g.us",
      subject: "Acme Support",
      owner: undefined,
    }));
    const session = readySession({ groupCreate });

    await expect(
      session.createGroup("Acme Support", ["919876543210@s.whatsapp.net"]),
    ).resolves.toEqual({ providerChatId: "120363000000@g.us" });
    expect(groupCreate).toHaveBeenCalledWith("Acme Support", [
      "919876543210@s.whatsapp.net",
    ]);
  });

  it("rejects group creation without participants", async () => {
    const session = readySession({ groupCreate: vi.fn() });

    await expect(session.createGroup("Acme Support", [])).rejects.toThrow(
      "At least one participant is required",
    );
  });

  it("returns confirmed chat metadata", async () => {
    const session = readySession(
      {
        profilePictureUrl: vi.fn(async () => "https://example.test/avatar.jpg"),
      },
      {
        id: "120363@g.us",
        isGroup: true,
        name: "Client Support",
        participantsCount: 2,
        pinned: true,
        muted: true,
        archived: false,
      },
    );

    await expect(session.chat("120363@g.us")).resolves.toEqual({
      id: "120363@g.us",
      name: "Client Support",
      avatarUrl: "https://example.test/avatar.jpg",
      participantsCount: 2,
      channelType: "group",
      isPinned: true,
      isMuted: true,
      isArchived: false,
    });
  });

  it("pins only when the confirmed state differs", async () => {
    const chatModify = vi.fn(async () => undefined);
    const session = readySession(
      { chatModify, profilePictureUrl: vi.fn(async () => undefined) },
      {
        id: "120363@g.us",
        isGroup: true,
        name: null,
        pinned: false,
        muted: false,
        archived: false,
      },
    );

    await session.setChatState("120363@g.us", { action: "pin", pinned: true });

    expect(chatModify).toHaveBeenCalledOnce();
    expect(chatModify).toHaveBeenCalledWith({ pin: true }, "120363@g.us");
  });

  it("reaches mute and archive target states in both directions", async () => {
    const chatModify = vi.fn(async () => undefined);
    const session = readySession(
      { chatModify, profilePictureUrl: vi.fn(async () => undefined) },
      {
        id: "120363@g.us",
        isGroup: true,
        name: null,
        pinned: false,
        muted: false,
        archived: false,
      },
    );

    await session.setChatState("120363@g.us", { action: "mute", muted: true });
    await session.setChatState("120363@g.us", { action: "mute", muted: false });
    await session.setChatState("120363@g.us", {
      action: "archive",
      archived: true,
    });
    await session.setChatState("120363@g.us", {
      action: "archive",
      archived: false,
    });

    expect(chatModify).toHaveBeenCalledTimes(4);
    expect(chatModify).toHaveBeenNthCalledWith(
      2,
      { mute: null },
      "120363@g.us",
    );
    expect(chatModify).toHaveBeenNthCalledWith(
      3,
      { archive: true, lastMessages: [] },
      "120363@g.us",
    );
  });

  it("marks a chat unread through WhatsApp", async () => {
    const chatModify = vi.fn(async () => undefined);
    const session = readySession(
      { chatModify, profilePictureUrl: vi.fn(async () => undefined) },
      {
        id: "120363@g.us",
        isGroup: true,
        name: null,
        pinned: false,
        muted: false,
        archived: false,
      },
    );

    await session.setChatState("120363@g.us", {
      action: "mark_unread",
      markedUnread: true,
    });

    expect(chatModify).toHaveBeenCalledWith(
      { markRead: false, lastMessages: [] },
      "120363@g.us",
    );
  });
});

describe("GatewaySession.chats / groups", () => {
  function withChatMeta(
    session: ReturnType<typeof readySession>,
    id: string,
    meta: Record<string, unknown>,
  ) {
    const internals = session as unknown as {
      chatMeta: Map<string, unknown>;
    };
    internals.chatMeta.set(id, meta);
  }

  it("actively fetches a group's subject when the cache doesn't have it", async () => {
    const groupMetadata = vi.fn(async () => ({ subject: "Real Group Name" }));
    const session = readySession({ groupMetadata });
    withChatMeta(session, "999@g.us", {
      id: "999@g.us",
      isGroup: true,
      name: null,
      pinned: false,
      muted: false,
      archived: false,
    });

    const groups = await session.groups();

    expect(groupMetadata).toHaveBeenCalledWith("999@g.us");
    expect(groups).toEqual([
      { id: "999@g.us", name: "Real Group Name", avatarUrl: null },
    ]);
  });

  it("leaves the name null when the metadata fetch fails, without breaking the sync", async () => {
    const groupMetadata = vi.fn(async () => {
      throw new Error("not a participant");
    });
    const session = readySession({ groupMetadata });
    withChatMeta(session, "999@g.us", {
      id: "999@g.us",
      isGroup: true,
      name: null,
      pinned: false,
      muted: false,
      archived: false,
    });

    const groups = await session.groups();

    expect(groups).toEqual([{ id: "999@g.us", name: null, avatarUrl: null }]);
  });

  it("does not re-fetch a group whose name is already known", async () => {
    const groupMetadata = vi.fn(async () => ({
      subject: "Should not be used",
    }));
    const session = readySession({ groupMetadata });
    withChatMeta(session, "999@g.us", {
      id: "999@g.us",
      isGroup: true,
      name: "Already Known",
      pinned: false,
      muted: false,
      archived: false,
    });

    const groups = await session.groups();

    expect(groupMetadata).not.toHaveBeenCalled();
    expect(groups[0]?.name).toBe("Already Known");
  });

  it("chats() — the method 'Sync now' actually calls — also resolves an unnamed group's subject", async () => {
    const groupMetadata = vi.fn(async () => ({
      subject: "Resolved via chats()",
    }));
    const session = readySession({ groupMetadata });
    withChatMeta(session, "999@g.us", {
      id: "999@g.us",
      isGroup: true,
      name: null,
      pinned: false,
      muted: false,
      archived: false,
    });

    const chats = await session.chats();

    expect(groupMetadata).toHaveBeenCalledWith("999@g.us");
    expect(chats[0]?.name).toBe("Resolved via chats()");
  });

  it("chats() never actively fetches a direct chat's name (no group metadata to resolve)", async () => {
    const groupMetadata = vi.fn(async () => ({ subject: "Unused" }));
    const session = readySession({ groupMetadata });
    withChatMeta(session, "919876543210@s.whatsapp.net", {
      id: "919876543210@s.whatsapp.net",
      isGroup: false,
      name: null,
      pinned: false,
      muted: false,
      archived: false,
    });

    await session.chats();

    expect(groupMetadata).not.toHaveBeenCalled();
  });
});

describe("GatewaySession message normalization", () => {
  function waMessage(over: Record<string, unknown> = {}) {
    return {
      key: { remoteJid: "120363@g.us", id: "MSG1", fromMe: false },
      message: { conversation: "Hi there" },
      messageTimestamp: 1_700_000_000,
      ...over,
    };
  }

  it("attaches the chat's already-known name as chatTitle on a new message", async () => {
    const session = readySession(
      {},
      {
        id: "120363@g.us",
        isGroup: true,
        name: "Acme Support Group",
        pinned: false,
        muted: false,
        archived: false,
      },
    );
    const internals = session as unknown as {
      recordMessage: (
        message: unknown,
        isHistory: boolean,
        persist?: boolean,
      ) => Promise<{ chatTitle: string | null } | null>;
    };

    const normalized = await internals.recordMessage(waMessage(), false, false);

    expect(normalized?.chatTitle).toBe("Acme Support Group");
  });

  it("leaves chatTitle null when the chat's name isn't known yet", async () => {
    const session = readySession({});
    const internals = session as unknown as {
      recordMessage: (
        message: unknown,
        isHistory: boolean,
        persist?: boolean,
      ) => Promise<{ chatTitle: string | null } | null>;
    };

    const normalized = await internals.recordMessage(
      waMessage({ key: { remoteJid: "999@g.us", id: "MSG2", fromMe: false } }),
      false,
      false,
    );

    expect(normalized?.chatTitle).toBeNull();
  });
});
