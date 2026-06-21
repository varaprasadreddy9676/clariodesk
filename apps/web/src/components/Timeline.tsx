import {
  CheckCheck,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  Copy,
  Download,
  Edit3,
  Flag,
  Forward,
  Info,
  Inbox,
  ListChecks,
  Lock,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Pin,
  RefreshCw,
  Reply,
  Sparkles,
  Ticket,
  Trash2,
  User,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Channel, Message } from "../types.js";
import { avatarColor, avatarInitials } from "../lib/avatar.js";
import { PhoneStatusPill, RiskPill, WaitingPill } from "./StatusBadge.js";

type MessageMenuAction =
  | "info"
  | "react"
  | "download"
  | "pin"
  | "create-task"
  | "create-ticket"
  | "attach-ticket"
  | "mark-internal"
  | "unflag"
  | "remove-flag"
  | "forward"
  | "reply"
  | "reply-private"
  | "reply-ai"
  | "attach-team-chat"
  | "edit"
  | "select"
  | "copy"
  | "refresh"
  | "copy-id"
  | "delete";

type MessageMenuState = {
  message: Message;
  x: number;
  y: number;
};

export function Timeline({
  channel,
  messages,
  onCreateTicket,
  onReply,
  onPrivateNote,
  onCopy,
  onRefresh,
  onResolveMediaUrl,
  contextOpen,
  onToggleContext,
}: {
  channel: Channel;
  messages: Message[];
  onCreateTicket: (message: Message) => void;
  onReply: (message: Message) => void;
  onPrivateNote: (message: Message) => void;
  onCopy: (text: string, label: string) => void;
  onRefresh: () => void;
  onResolveMediaUrl: (mediaId: string) => Promise<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
  }>;
  contextOpen: boolean;
  onToggleContext: () => void;
}) {
  const [menu, setMenu] = useState<MessageMenuState | null>(null);

  function openMenu(message: Message, x: number, y: number) {
    setMenu({
      message,
      x: Math.min(x, window.innerWidth - 300),
      y: Math.min(y, window.innerHeight - 520),
    });
  }

  function handleMenuAction(action: MessageMenuAction, message: Message) {
    switch (action) {
      case "create-ticket":
        onCreateTicket(message);
        break;
      case "mark-internal":
      case "reply-private":
        onPrivateNote(message);
        break;
      case "reply":
        onReply(message);
        break;
      case "copy":
        onCopy(message.body, "Message copied");
        break;
      case "copy-id":
        onCopy(message.id, "Message ID copied");
        break;
      case "info":
        onCopy(
          `${message.sender} / ${message.timestamp} / ${message.id}`,
          "Message info copied",
        );
        break;
      case "refresh":
        onRefresh();
        break;
      default:
        break;
    }
    setMenu(null);
  }

  return (
    <section className="timeline" aria-label={`${channel.title} timeline`}>
      <header className="timeline-header">
        <div className="timeline-peer">
          <span
            className="timeline-avatar"
            style={{ background: avatarColor(channel.title) }}
            aria-hidden="true"
          >
            {channel.channelType === "group" ? (
              <Users size={20} />
            ) : avatarInitials(channel.title) === "#" ? (
              <User size={20} />
            ) : (
              avatarInitials(channel.title)
            )}
          </span>
          <div className="timeline-title">
            <h2>{channel.title}</h2>
            <div className="timeline-meta">
              <span>
                {channel.client ||
                  (channel.channelType === "group" ? "Group" : "Direct chat")}
                {channel.project ? ` / ${channel.project}` : ""}
              </span>
              <PhoneStatusPill status={channel.phoneStatus} />
              <WaitingPill since={channel.awaitingResponseSince} />
            </div>
          </div>
        </div>
        <div className="timeline-actions">
          <button
            className="icon-button"
            type="button"
            aria-label={
              contextOpen ? "Hide context panel" : "Show context panel"
            }
            onClick={onToggleContext}
          >
            {contextOpen ? (
              <PanelRightClose size={17} />
            ) : (
              <PanelRightOpen size={17} />
            )}
          </button>
        </div>
      </header>

      {channel.status === "muted" ? (
        <div className="inline-banner banner-warn">
          <RiskPill>Channel archived from latest gateway sync</RiskPill>
        </div>
      ) : null}

      <div className="message-scroll" role="log" aria-live="polite">
        {messages.length > 0 ? (
          <div className="day-divider">
            <span>Today</span>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="conversation-empty">
            <Inbox size={28} aria-hidden="true" />
            <strong>No messages imported for this chat yet</strong>
            <span>
              Chat discovery is working. Recent history will load automatically
              when the gateway supports it; live messages appear here in real
              time.
            </span>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCreateTicket={onCreateTicket}
            onOpenMenu={openMenu}
            onResolveMediaUrl={onResolveMediaUrl}
          />
        ))}
      </div>
      {menu ? (
        <MessageContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onAction={handleMenuAction}
        />
      ) : null}
    </section>
  );
}

function MessageBubble({
  message,
  onCreateTicket,
  onOpenMenu,
  onResolveMediaUrl,
}: {
  message: Message;
  onCreateTicket: (message: Message) => void;
  onOpenMenu: (message: Message, x: number, y: number) => void;
  onResolveMediaUrl: (mediaId: string) => Promise<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
  }>;
}) {
  if (message.kind === "system") {
    return <div className="system-row">{message.body}</div>;
  }
  const Icon =
    message.kind === "note"
      ? Lock
      : message.kind === "deleted"
        ? Trash2
        : message.ticketId
          ? Ticket
          : Paperclip;
  const isOutbound = message.kind === "outbound";
  const isRead = (message.status ?? "").toLowerCase() === "read";
  return (
    <article
      className={`message-bubble message-${message.kind}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(message, event.clientX, event.clientY);
      }}
    >
      <button
        className="message-menu-trigger"
        type="button"
        aria-label="Message actions"
        onClick={(event) => onOpenMenu(message, event.clientX, event.clientY)}
      >
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {message.kind === "inbound" ? (
        <span className="message-author">{message.sender}</span>
      ) : null}
      {message.body ? <p>{message.body}</p> : null}
      {message.media.length > 0 ? (
        <div className="message-media-stack">
          {message.media.map((media) => (
            <MessageMedia
              key={media.id}
              media={media}
              onResolveMediaUrl={onResolveMediaUrl}
            />
          ))}
        </div>
      ) : null}
      <div className="message-foot">
        {message.kind === "note" ? (
          <span className="message-tag">
            <Icon size={12} aria-hidden="true" /> Internal note
          </span>
        ) : message.kind === "deleted" ? (
          <span className="message-tag">
            <Icon size={12} aria-hidden="true" /> Deleted
          </span>
        ) : message.ticketId ? (
          <span className="message-tag">
            <Icon size={12} aria-hidden="true" /> {message.ticketId}
          </span>
        ) : null}
        {message.kind === "inbound" ? (
          <button
            className="message-action"
            type="button"
            onClick={() => onCreateTicket(message)}
          >
            <MessageSquarePlus size={12} aria-hidden="true" />
            Ticket
          </button>
        ) : null}
        <span className="message-time">
          {message.timestamp}
          {isOutbound ? (
            <CheckCheck
              className={`message-ticks${isRead ? " is-read" : ""}`}
              size={15}
              aria-hidden="true"
            />
          ) : null}
        </span>
      </div>
    </article>
  );
}

function MessageMedia({
  media,
  onResolveMediaUrl,
}: {
  media: Message["media"][number];
  onResolveMediaUrl: (mediaId: string) => Promise<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
  }>;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | {
        kind: "ready";
        url: string;
        mimeType: string | null;
        fileName: string | null;
      }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (media.storageStatus !== "downloaded") return;
    let cancelled = false;
    setState({ kind: "loading" });
    onResolveMediaUrl(media.id)
      .then((result) => {
        if (!cancelled) {
          setState({
            kind: "ready",
            url: result.url,
            mimeType: result.mimeType,
            fileName: result.fileName,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Media unavailable",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [media.id, media.storageStatus, onResolveMediaUrl]);

  const label = media.fileName || media.mediaType;
  if (media.storageStatus !== "downloaded") {
    return (
      <div className="message-media-card">
        <Paperclip size={15} aria-hidden="true" />
        <span>{label}</span>
        <em>{media.storageStatus}</em>
      </div>
    );
  }
  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div className="message-media-card">
        <Paperclip size={15} aria-hidden="true" />
        <span>{label}</span>
        <em>Loading...</em>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="message-media-card">
        <Paperclip size={15} aria-hidden="true" />
        <span>{label}</span>
        <em>{state.message}</em>
      </div>
    );
  }
  const mimeType = state.mimeType ?? media.mimeType ?? "";
  if (mimeType.startsWith("image/") || media.mediaType === "image") {
    return (
      <img
        className="message-media-preview"
        src={state.url}
        alt={state.fileName ?? label}
      />
    );
  }
  if (mimeType.startsWith("video/") || media.mediaType === "video") {
    return <video className="message-media-preview" src={state.url} controls />;
  }
  if (mimeType.startsWith("audio/") || media.mediaType === "audio") {
    return <audio className="message-audio-preview" src={state.url} controls />;
  }
  return (
    <a
      className="message-media-card"
      href={state.url}
      target="_blank"
      rel="noreferrer"
    >
      <Download size={15} aria-hidden="true" />
      <span>{state.fileName ?? label}</span>
      <em>Open</em>
    </a>
  );
}

function MessageContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: MessageMenuState;
  onClose: () => void;
  onAction: (action: MessageMenuAction, message: Message) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isNote = state.message.kind === "note";
  const items: Array<
    | { kind: "separator" }
    | {
        kind: "action";
        action: MessageMenuAction;
        label: string;
        icon: typeof Info;
        disabled?: boolean;
      }
  > = [
    { kind: "action", action: "info", label: "Info", icon: Info },
    {
      kind: "action",
      action: "react",
      label: "React",
      icon: Sparkles,
      disabled: true,
    },
    {
      kind: "action",
      action: "download",
      label: "Download",
      icon: Download,
      disabled: true,
    },
    { kind: "action", action: "pin", label: "Pin", icon: Pin, disabled: true },
    { kind: "separator" },
    {
      kind: "action",
      action: "create-task",
      label: "Create task",
      icon: ListChecks,
      disabled: true,
    },
    {
      kind: "action",
      action: "create-ticket",
      label: "Create ticket",
      icon: Ticket,
      disabled: isNote,
    },
    {
      kind: "action",
      action: "attach-ticket",
      label: "Attach to ticket",
      icon: Paperclip,
      disabled: true,
    },
    {
      kind: "action",
      action: "mark-internal",
      label: "Mark as internal",
      icon: UserRoundCheck,
      disabled: isNote,
    },
    { kind: "separator" },
    {
      kind: "action",
      action: "unflag",
      label: "Unflag message",
      icon: ClipboardCheck,
      disabled: true,
    },
    {
      kind: "action",
      action: "remove-flag",
      label: "Remove flag",
      icon: Flag,
      disabled: true,
    },
    { kind: "separator" },
    {
      kind: "action",
      action: "forward",
      label: "Forward",
      icon: Forward,
      disabled: true,
    },
    {
      kind: "action",
      action: "reply",
      label: "Reply",
      icon: Reply,
      disabled: isNote,
    },
    {
      kind: "action",
      action: "reply-private",
      label: "Reply privately",
      icon: Reply,
    },
    {
      kind: "action",
      action: "reply-ai",
      label: "Reply with AI",
      icon: Sparkles,
      disabled: true,
    },
    {
      kind: "action",
      action: "attach-team-chat",
      label: "Attach to team chat",
      icon: Users,
      disabled: true,
    },
    {
      kind: "action",
      action: "edit",
      label: "Edit",
      icon: Edit3,
      disabled: true,
    },
    { kind: "separator" },
    {
      kind: "action",
      action: "select",
      label: "Select",
      icon: ListChecks,
      disabled: true,
    },
    { kind: "action", action: "copy", label: "Copy", icon: Copy },
    { kind: "action", action: "refresh", label: "Refresh", icon: RefreshCw },
    { kind: "action", action: "copy-id", label: "Copy ID", icon: Clipboard },
    {
      kind: "action",
      action: "delete",
      label: "Delete",
      icon: Trash2,
      disabled: true,
    },
  ];

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="message-context-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
      aria-label="Message actions"
    >
      {items.map((item, index) => {
        if (item.kind === "separator")
          return (
            <div
              key={`sep-${index}`}
              className="menu-separator"
              role="separator"
            />
          );
        const Icon = item.icon;
        return (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => onAction(item.action, state.message)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
