import { describe, expect, it, vi } from "vitest";
import { GatewaySession } from "./session-manager.js";

function readySession(client: Record<string, unknown>) {
  const session = new GatewaySession({
    id: "phone-1",
    name: "Support",
    dataDir: "/tmp/clario-gateway-tests",
    puppeteerArgs: [],
  });
  Object.assign(session as unknown as Record<string, unknown>, {
    client,
    status: "ready",
  });
  return session;
}

describe("GatewaySession conversation operations", () => {
  it("normalizes and resolves a registered WhatsApp number", async () => {
    const getNumberId = vi.fn(async () => ({
      _serialized: "919876543210@c.us",
    }));
    const session = readySession({ getNumberId });

    await expect(session.resolveNumber("+91 98765-43210")).resolves.toEqual({
      registered: true,
      providerContactId: "919876543210@c.us",
    });
    expect(getNumberId).toHaveBeenCalledWith("919876543210");
  });

  it("reports an unregistered WhatsApp number", async () => {
    const session = readySession({ getNumberId: vi.fn(async () => null) });

    await expect(session.resolveNumber("+15551234567")).resolves.toEqual({
      registered: false,
      providerContactId: null,
    });
  });

  it("creates a group and normalizes the provider group id", async () => {
    const createGroup = vi.fn(async () => ({
      gid: { _serialized: "120363000000@g.us" },
    }));
    const session = readySession({ createGroup });

    await expect(
      session.createGroup("Acme Support", ["919876543210@c.us"]),
    ).resolves.toEqual({ providerChatId: "120363000000@g.us" });
    expect(createGroup).toHaveBeenCalledWith("Acme Support", [
      "919876543210@c.us",
    ]);
  });

  it("rejects group creation without participants", async () => {
    const session = readySession({ createGroup: vi.fn() });

    await expect(session.createGroup("Acme Support", [])).rejects.toThrow(
      "At least one participant is required",
    );
  });

  it("returns confirmed chat metadata", async () => {
    const chat = fakeChat({ pinned: true, isMuted: true, archived: false });
    const session = readySession({
      getChatById: vi.fn(async () => chat),
      getProfilePicUrl: vi.fn(async () => "https://example.test/avatar.jpg"),
    });

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
    const chat = fakeChat({ pinned: false });
    const session = readySession({
      getChatById: vi.fn(async () => chat),
      getProfilePicUrl: vi.fn(async () => undefined),
    });

    await session.setChatState("120363@g.us", {
      action: "pin",
      pinned: true,
    });
    await session.setChatState("120363@g.us", {
      action: "pin",
      pinned: true,
    });

    expect(chat.pin).toHaveBeenCalledOnce();
    expect(chat.unpin).not.toHaveBeenCalled();
  });

  it("reaches mute and archive target states in both directions", async () => {
    const chat = fakeChat({ isMuted: false, archived: false });
    const session = readySession({
      getChatById: vi.fn(async () => chat),
      getProfilePicUrl: vi.fn(async () => undefined),
    });

    await session.setChatState("120363@g.us", {
      action: "mute",
      muted: true,
    });
    await session.setChatState("120363@g.us", {
      action: "mute",
      muted: false,
    });
    await session.setChatState("120363@g.us", {
      action: "archive",
      archived: true,
    });
    await session.setChatState("120363@g.us", {
      action: "archive",
      archived: false,
    });

    expect(chat.mute).toHaveBeenCalledOnce();
    expect(chat.unmute).toHaveBeenCalledOnce();
    expect(chat.archive).toHaveBeenCalledOnce();
    expect(chat.unarchive).toHaveBeenCalledOnce();
  });

  it("marks a chat unread through WhatsApp", async () => {
    const chat = fakeChat();
    const session = readySession({
      getChatById: vi.fn(async () => chat),
      getProfilePicUrl: vi.fn(async () => undefined),
    });

    await session.setChatState("120363@g.us", {
      action: "mark_unread",
      markedUnread: true,
    });

    expect(chat.markUnread).toHaveBeenCalledOnce();
  });

  it("rejects unsupported chat operations", async () => {
    const chat = fakeChat();
    delete (chat as { pin?: unknown }).pin;
    const session = readySession({
      getChatById: vi.fn(async () => chat),
      getProfilePicUrl: vi.fn(async () => undefined),
    });

    await expect(
      session.setChatState("120363@g.us", {
        action: "pin",
        pinned: true,
      }),
    ).rejects.toThrow("does not support pin");
  });
});

function fakeChat(
  state: { pinned?: boolean; isMuted?: boolean; archived?: boolean } = {},
) {
  const chat = {
    id: { _serialized: "120363@g.us" },
    name: "Client Support",
    isGroup: true,
    participants: [{}, {}],
    pinned: state.pinned ?? false,
    isMuted: state.isMuted ?? false,
    archived: state.archived ?? false,
    fetchMessages: vi.fn(async () => []),
    pin: vi.fn(async () => {
      chat.pinned = true;
      return true;
    }),
    unpin: vi.fn(async () => {
      chat.pinned = false;
      return false;
    }),
    mute: vi.fn(async () => {
      chat.isMuted = true;
      return { isMuted: true, muteExpiration: 0 };
    }),
    unmute: vi.fn(async () => {
      chat.isMuted = false;
      return { isMuted: false, muteExpiration: 0 };
    }),
    archive: vi.fn(async () => {
      chat.archived = true;
    }),
    unarchive: vi.fn(async () => {
      chat.archived = false;
    }),
    markUnread: vi.fn(async () => undefined),
  };
  return chat;
}
