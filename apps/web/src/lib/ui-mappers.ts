import type {
  ApiChannel,
  ApiMessage,
  ApiOpsSummary,
  ApiPhone,
  ApiTeamMember,
  ApiTicket,
} from "../api.js";
import type {
  Channel,
  Message,
  OpsSummary,
  Ticket as UiTicket,
} from "../types.js";
import type { ChannelView } from "./whatsapp-sort.js";
import { filterChannelsByView } from "./whatsapp-sort.js";

export function toUiOps(ops: ApiOpsSummary | null): OpsSummary {
  return {
    connectedPhones: ops?.phones.byStatus.connected ?? 0,
    degradedPhones: ops?.phones.byStatus.degraded ?? 0,
    unmappedGroups: ops?.channels.unmapped ?? 0,
    awaitingResponses: ops?.channels.awaitingResponse ?? 0,
    failedOutbox: ops?.outbox.byStatus.failed ?? 0,
  };
}

export function toUiChannels(
  channels: ApiChannel[],
  tickets: ApiTicket[],
  phones: ApiPhone[],
): Channel[] {
  const phoneStatus =
    phones.find((phone) => phone.status === "connected")?.status ??
    phones.find((phone) => phone.status === "syncing")?.status ??
    phones.find((phone) => phone.status === "degraded")?.status ??
    "qr_required";
  return channels.map((channel) => ({
    id: channel.id,
    providerChatId: channel.providerChatId,
    title:
      channel.title ??
      (channel.channelType === "group" ? "WhatsApp group" : "Unknown contact"),
    avatarUrl: channel.avatarUrl ?? undefined,
    channelType: channel.channelType,
    clientId: channel.clientId ?? undefined,
    client: channel.clientName ?? "",
    projectId: channel.projectId ?? undefined,
    project: channel.projectName ?? undefined,
    status: channel.status,
    isPinned: channel.isPinned,
    isMuted: channel.isMuted,
    isMarkedUnread: channel.isMarkedUnread,
    phoneStatus:
      phoneStatus === "connected" ||
      phoneStatus === "syncing" ||
      phoneStatus === "degraded"
        ? phoneStatus
        : "qr_required",
    lastActivityAt:
      channel.lastMessageAt ?? channel.awaitingResponseSince ?? null,
    lastMessage: channel.awaitingResponseSince
      ? "Waiting for support response"
      : (channel.lastMessage ? collapsePreview(channel.lastMessage) : null) ||
        (channel.lastMessageType
          ? messageTypePreview(channel.lastMessageType)
          : "No messages yet"),
    lastTime: channel.lastMessageAt
      ? formatTime(channel.lastMessageAt)
      : "No messages",
    unread: channel.isMarkedUnread || channel.awaitingResponseSince ? 1 : 0,
    openTickets: tickets.filter(
      (ticket) => ticket.channelId === channel.id && ticket.status !== "closed",
    ).length,
    awaitingResponseSince: channel.awaitingResponseSince
      ? formatTime(channel.awaitingResponseSince)
      : undefined,
  }));
}

export function toUiMessage(message: ApiMessage): Message {
  const media = message.media ?? [];
  // A caption-less media message (the common case for photos/videos/docs)
  // has no body at all -- let the media render on its own rather than
  // showing a raw "[image]"/"[document]" placeholder above it. Only a
  // truly bodyless, medialess message (a type the gateway couldn't
  // classify) gets a friendly type label instead of an empty bubble.
  const body =
    message.body ??
    (media.length > 0 ? "" : messageTypePreview(message.messageType));
  return {
    id: message.id,
    kind: message.status === "deleted" ? "deleted" : message.direction,
    sender:
      message.senderName ??
      (message.sentByType === "dashboard_agent"
        ? "Support agent"
        : message.sentByType === "client_user"
          ? "Customer"
          : "WhatsApp user"),
    body,
    media,
    timestampAt: message.providerTimestamp,
    timestamp: formatTime(message.providerTimestamp),
    status: message.status,
  };
}

export function toUiTicket(
  ticket: ApiTicket,
  members: ApiTeamMember[],
): UiTicket {
  return {
    id: ticket.id.slice(0, 8),
    channelId: ticket.channelId,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority === "low" ? "normal" : ticket.priority,
    owner: ticket.assignedUserId
      ? memberName(members, ticket.assignedUserId)
      : "Unassigned",
  };
}

export function filterChannels(
  channels: Channel[],
  query: string,
  view: ChannelView,
): Channel[] {
  const q = query.trim().toLowerCase();
  return filterChannelsByView(channels, view).filter((channel) => {
    const matchesQuery =
      !q ||
      `${channel.title} ${channel.client} ${channel.project ?? ""}`
        .toLowerCase()
        .includes(q);
    return matchesQuery;
  });
}

export function memberName(
  members: ApiTeamMember[],
  id: string | null,
): string {
  if (!id) return "Unassigned";
  return (
    members.find((member) => member.userId === id)?.displayName ??
    id.slice(0, 8)
  );
}

// Chat-list preview for a message with no text body (media, or a type the
// gateway couldn't fully classify) — never surface a raw internal type
// token like "[unknown]" or "[sticker]" to the user.
const MESSAGE_TYPE_PREVIEW: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎵 Voice message",
  document: "📄 Document",
  sticker: "Sticker",
  location: "📍 Location",
  vcard: "👤 Contact",
};

export function messageTypePreview(type: string): string {
  return MESSAGE_TYPE_PREVIEW[type] ?? "Message";
}

// Chat-list previews render on a single truncated line — collapse embedded
// newlines/whitespace and strip WhatsApp's *bold*/_italic_/~strike~
// markdown so the raw formatting characters don't show up as literal
// asterisks/underscores in a one-line preview.
export function collapsePreview(text: string): string {
  return text.replaceAll(/[*_~]/g, "").replaceAll(/\s+/g, " ").trim();
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
