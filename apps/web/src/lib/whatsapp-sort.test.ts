import { describe, expect, it } from "vitest";
import type { Channel, Message } from "../types.js";
import {
  filterChannelsByView,
  sortChannelsLikeWhatsApp,
  sortMessagesLikeWhatsApp,
} from "./whatsapp-sort.js";

function channel(
  over: Partial<Channel> &
    Pick<
      Channel,
      | "id"
      | "title"
      | "client"
      | "status"
      | "phoneStatus"
      | "lastMessage"
      | "lastTime"
      | "unread"
      | "openTickets"
    >,
): Channel {
  return {
    id: over.id,
    title: over.title,
    channelType: over.channelType ?? "group",
    client: over.client,
    status: over.status,
    phoneStatus: over.phoneStatus,
    lastActivityAt: over.lastActivityAt,
    lastMessage: over.lastMessage,
    lastTime: over.lastTime,
    unread: over.unread,
    openTickets: over.openTickets,
    clientId: over.clientId,
    projectId: over.projectId,
    project: over.project,
    awaitingResponseSince: over.awaitingResponseSince,
    providerChatId: over.providerChatId ?? `${over.id}@c.us`,
    isPinned: over.isPinned ?? false,
    isMuted: over.isMuted ?? false,
    isMarkedUnread: over.isMarkedUnread ?? false,
  };
}

function message(id: string, timestamp: string): Message {
  return {
    id,
    kind: "inbound",
    sender: "client",
    body: "hello",
    timestampAt: timestamp,
    timestamp,
    media: [],
  };
}

describe("WhatsApp-style sort helpers", () => {
  it("places pinned channels first and then sorts by latest activity", () => {
    const input = [
      channel({
        id: "a",
        title: "Client A",
        client: "Client A",
        status: "active",
        phoneStatus: "connected",
        lastMessage: "Old",
        lastTime: "2026-06-13T10:00:00.000Z",
        unread: 0,
        openTickets: 0,
        lastActivityAt: "2026-06-13T10:00:00.000Z",
      }),
      channel({
        id: "b",
        title: "Client B",
        client: "Client B",
        status: "active",
        phoneStatus: "connected",
        lastMessage: "New",
        lastTime: "2026-06-13T11:00:00.000Z",
        unread: 2,
        openTickets: 0,
        lastActivityAt: "2026-06-13T11:00:00.000Z",
      }),
      channel({
        id: "c",
        title: "Client C",
        client: "Client C",
        status: "active",
        phoneStatus: "connected",
        lastMessage: "Waiting",
        lastTime: "2026-06-13T09:00:00.000Z",
        unread: 0,
        openTickets: 0,
        awaitingResponseSince: "2026-06-13T09:30:00.000Z",
        lastActivityAt: "2026-06-13T09:00:00.000Z",
        isPinned: true,
      }),
    ];

    expect(sortChannelsLikeWhatsApp(input).map((item) => item.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("uses the channel id as a stable tie-breaker", () => {
    const base = {
      title: "Same",
      client: "",
      status: "active" as const,
      phoneStatus: "connected" as const,
      lastMessage: "Same",
      lastTime: "Same",
      lastActivityAt: "2026-06-13T11:00:00.000Z",
      unread: 0,
      openTickets: 0,
    };
    expect(
      sortChannelsLikeWhatsApp([
        channel({ ...base, id: "b" }),
        channel({ ...base, id: "a" }),
      ]).map((item) => item.id),
    ).toEqual(["a", "b"]);
  });

  it("keeps archived and unread views explicit", () => {
    const base = {
      client: "",
      phoneStatus: "connected" as const,
      lastMessage: "",
      lastTime: "",
      unread: 0,
      openTickets: 0,
    };
    const inbox = channel({
      ...base,
      id: "inbox",
      title: "Inbox",
      status: "active",
    });
    const unread = channel({
      ...base,
      id: "unread",
      title: "Unread",
      status: "active",
      isMarkedUnread: true,
    });
    const archived = channel({
      ...base,
      id: "archived",
      title: "Archived",
      status: "archived",
    });

    expect(filterChannelsByView([inbox, unread, archived], "unread")).toEqual([
      unread,
    ]);
    expect(
      filterChannelsByView([inbox, unread, archived], "archived"),
    ).toEqual([archived]);
  });

  it("renders messages oldest-to-newest in the visible thread", () => {
    const input = [
      message("new", "2026-06-13T11:00:00.000Z"),
      message("old", "2026-06-13T10:00:00.000Z"),
    ];

    expect(sortMessagesLikeWhatsApp(input).map((item) => item.id)).toEqual([
      "old",
      "new",
    ]);
  });
});
