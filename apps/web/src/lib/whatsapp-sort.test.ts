import { describe, expect, it } from "vitest";
import type { Channel, Message } from "../types.js";
import {
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
  it("places unread channels before read channels and then sorts by latest activity", () => {
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
      }),
    ];

    expect(sortChannelsLikeWhatsApp(input).map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
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
