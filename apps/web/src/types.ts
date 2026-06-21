import type { LucideIcon } from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
};

export type ChannelStatus =
  | "active"
  | "unmapped"
  | "mixed"
  | "muted"
  | "archived"
  | "degraded";
export type PhoneStatus = "connected" | "syncing" | "degraded" | "qr_required";
export type MessageKind =
  | "inbound"
  | "outbound"
  | "note"
  | "system"
  | "deleted";

export type Channel = {
  id: string;
  providerChatId: string;
  title: string;
  avatarUrl?: string;
  channelType: "group" | "direct" | "official_direct";
  clientId?: string;
  client: string;
  projectId?: string;
  project?: string;
  status: ChannelStatus;
  phoneStatus: PhoneStatus;
  lastActivityAt?: string | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
  isPinned: boolean;
  isMuted: boolean;
  isMarkedUnread: boolean;
  openTickets: number;
  awaitingResponseSince?: string;
};

export type Message = {
  id: string;
  kind: MessageKind;
  sender: string;
  body: string;
  media: Array<{
    id: string;
    mediaType: string;
    mimeType: string | null;
    fileName: string | null;
    storageStatus: string;
  }>;
  timestampAt: string;
  timestamp: string;
  ticketId?: string;
  status?: string;
};

export type Ticket = {
  id: string;
  title: string;
  status: "open" | "pending" | "closed";
  priority: "normal" | "high" | "urgent";
  owner: string;
};

export type OpsSummary = {
  connectedPhones: number;
  degradedPhones: number;
  unmappedGroups: number;
  awaitingResponses: number;
  failedOutbox: number;
};
