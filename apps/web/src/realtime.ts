import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { AuthSession } from "./api.js";

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

export type RealtimeEventType =
  | "message.received"
  | "message.updated"
  | "outbox.status_changed"
  | "ticket.created"
  | "ticket.updated"
  | "note.created"
  | "channel.updated"
  | "phone.status_changed";

export type RealtimeEvent = {
  type: RealtimeEventType;
  workspaceId: string;
  channelId?: string;
  ticketId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
};

export type RealtimeNotification = {
  id: string;
  type: RealtimeEventType;
  title: string;
  body: string;
  channelId?: string;
  ticketId?: string;
  createdAt: string;
  read: boolean;
};

type RealtimeFeedOptions = {
  onEvent?: (event: RealtimeEvent) => void;
};

const REALTIME_URL =
  import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";
const MAX_NOTIFICATIONS = 20;
const EVENT_TYPES: RealtimeEventType[] = [
  "message.received",
  "message.updated",
  "outbox.status_changed",
  "ticket.created",
  "ticket.updated",
  "note.created",
  "channel.updated",
  "phone.status_changed",
];

export function useRealtimeFeed(
  session: AuthSession | null,
  options: RealtimeFeedOptions = {},
) {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const [notifications, setNotifications] = useState<RealtimeNotification[]>(
    [],
  );
  const onEventRef = useRef(options.onEvent);

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  useEffect(() => {
    if (!session?.token) {
      setStatus("disconnected");
      setNotifications([]);
      return;
    }

    const socket = io(REALTIME_URL, {
      auth: { token: session.token },
      transports: ["websocket"],
      timeout: 8000,
      reconnection: true,
    });

    const handleEvent = (event: RealtimeEvent) => {
      onEventRef.current?.(event);
      const notification = toNotification(event);
      if (!notification) return;
      setNotifications((current) =>
        [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, MAX_NOTIFICATIONS),
      );
    };

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.io.on("reconnect", () => setStatus("connected"));
    for (const eventType of EVENT_TYPES) {
      socket.on(eventType, handleEvent);
    }

    return () => {
      for (const eventType of EVENT_TYPES) {
        socket.off(eventType, handleEvent);
      }
      socket.close();
      setStatus("disconnected");
    };
  }, [session?.token]);

  useEffect(() => {
    document.title = notifications.some((item) => !item.read)
      ? `(${notifications.filter((item) => !item.read).length}) ClarioDesk`
      : "ClarioDesk";
  }, [notifications]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  function markAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  }

  function markRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  }

  function clear() {
    setNotifications([]);
  }

  return {
    status,
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    clear,
    setNotifications,
  };
}

function toNotification(event: RealtimeEvent): RealtimeNotification {
  const now = new Date().toISOString();
  const channelSuffix = event.channelId ? ` · ${shortId(event.channelId)}` : "";
  switch (event.type) {
    case "message.received":
      return {
        id: eventKey(event),
        type: event.type,
        title: "New message received",
        body: `${event.payload?.isBackfill ? "Imported history" : "Live message"}${channelSuffix}`,
        channelId: event.channelId,
        createdAt: now,
        read: false,
      };
    case "message.updated":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Message updated",
        body: `Message ${shortId(String(event.payload?.messageId ?? eventKey(event)))} was updated${channelSuffix}`,
        channelId: event.channelId,
        createdAt: now,
        read: false,
      };
    case "outbox.status_changed":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Send queue updated",
        body: `${String(event.payload?.status ?? "updated")} · ${shortId(String(event.payload?.outboxId ?? eventKey(event)))}${channelSuffix}`,
        channelId: event.channelId,
        createdAt: now,
        read: false,
      };
    case "ticket.created":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Ticket created",
        body: `${String(event.payload?.title ?? "Untitled ticket")} · ${String(event.payload?.priority ?? "normal")}${channelSuffix}`,
        channelId: event.channelId,
        ticketId: event.ticketId,
        createdAt: now,
        read: false,
      };
    case "ticket.updated":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Ticket updated",
        body: `${summarizeChanges(event.payload)}${channelSuffix}`,
        channelId: event.channelId,
        ticketId: event.ticketId,
        createdAt: now,
        read: false,
      };
    case "note.created":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Internal note added",
        body: `Private note saved${channelSuffix}`,
        channelId: event.channelId,
        createdAt: now,
        read: false,
      };
    case "channel.updated":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Channel updated",
        body: `Group metadata changed${channelSuffix}`,
        channelId: event.channelId,
        createdAt: now,
        read: false,
      };
    case "phone.status_changed":
      return {
        id: eventKey(event),
        type: event.type,
        title: "Phone status changed",
        body: String(event.payload?.status ?? "Gateway state changed"),
        createdAt: now,
        read: false,
      };
  }
}

function summarizeChanges(payload?: Record<string, unknown>): string {
  if (!payload) return "Ticket updated";
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}:${String(value)}`);
  if (entries.length === 0) return "Ticket updated";
  return entries.slice(0, 3).join(" · ");
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function eventKey(event: RealtimeEvent): string {
  return `${event.type}:${event.workspaceId}:${event.channelId ?? "workspace"}:${event.ticketId ?? "ticket"}:${event.userId ?? "user"}:${JSON.stringify(event.payload ?? {})}`;
}
