import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  Eye,
  FileText,
  Inbox,
  Lock,
  MessageSquarePlus,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  RefreshCw,
  Reply,
  SmilePlus,
  Ticket,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Channel, Message } from "../types.js";
import { avatarColor, avatarInitials } from "../lib/avatar.js";
import { PhoneStatusPill, RiskPill, WaitingPill } from "./StatusBadge.js";

type MessageMenuAction =
  | "react"
  | "view-attachment"
  | "download-attachment"
  | "create-ticket"
  | "mark-internal"
  | "reply"
  | "reply-private"
  | "copy"
  | "refresh"
  | "copy-id";

type MessageMenuState = {
  message: Message;
  x: number;
  y: number;
};

type ReactionPickerState = MessageMenuState;

type AttachmentPreviewState = {
  url: string;
  fileName: string;
  mimeType: string;
  mediaType: string;
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
  onReact,
  contextOpen,
  onToggleContext,
  onBack,
  onOpenMenu,
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
  onReact: (message: Message, reaction: string) => Promise<void>;
  contextOpen: boolean;
  onToggleContext: () => void;
  onBack?: () => void;
  onOpenMenu?: (e: React.MouseEvent) => void;
}) {
  const [menu, setMenu] = useState<MessageMenuState | null>(null);
  const [reactionPicker, setReactionPicker] =
    useState<ReactionPickerState | null>(null);
  const [attachmentPreview, setAttachmentPreview] =
    useState<AttachmentPreviewState | null>(null);

  function openMenu(message: Message, x: number, y: number) {
    setMenu({
      message,
      x: Math.max(8, Math.min(x, window.innerWidth - 232)),
      y: Math.max(8, Math.min(y, window.innerHeight - 410)),
    });
  }

  async function handleMenuAction(action: MessageMenuAction, message: Message) {
    switch (action) {
      case "react":
        if (menu) setReactionPicker(menu);
        setMenu(null);
        return;
      case "view-attachment":
        await viewAttachment(message);
        break;
      case "download-attachment":
        await downloadAttachment(message);
        break;
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
      case "refresh":
        onRefresh();
        break;
      default:
        break;
    }
    setMenu(null);
  }

  async function viewAttachment(message: Message) {
    const media = message.media.find(
      (item) => item.storageStatus === "downloaded",
    );
    if (!media) return;
    const result = await onResolveMediaUrl(media.id);
    setAttachmentPreview({
      url: result.url,
      fileName: result.fileName ?? media.fileName ?? "Attachment",
      mimeType: result.mimeType ?? media.mimeType ?? "",
      mediaType: media.mediaType,
    });
  }

  async function downloadAttachment(message: Message) {
    const media = message.media.find(
      (item) => item.storageStatus === "downloaded",
    );
    if (!media) return;
    const result = await onResolveMediaUrl(media.id);
    const name = result.fileName ?? media.fileName ?? null;
    const mime = result.mimeType ?? media.mimeType ?? null;
    await downloadFromUrl(result.url, resolveDownloadName(name, mime));
  }

  function resolveDownloadName(
    fileName: string | null | undefined,
    mimeType: string | null | undefined,
  ): string {
    const extMap: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/3gpp": ".3gp",
      "audio/ogg": ".ogg",
      "audio/mpeg": ".mp3",
      "audio/aac": ".aac",
      "audio/opus": ".opus",
      "application/pdf": ".pdf",
      "application/zip": ".zip",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        ".docx",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        ".xlsx",
      "text/plain": ".txt",
      "text/csv": ".csv",
    };
    if (fileName && /\.[a-z0-9]{1,5}$/i.test(fileName)) return fileName;
    const ext = mimeType ? (extMap[mimeType] ?? "") : "";
    const base = fileName ?? "attachment";
    return ext ? `${base}${ext}` : base;
  }

  async function downloadFromUrl(url: string, fileName: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Attachment download failed");
    const blob = await response.blob();
    // Use the server's content-type if the resolved name still has no extension
    const serverMime = response.headers.get("content-type")?.split(";")[0];
    const finalName = /\.[a-z0-9]{1,5}$/i.test(fileName)
      ? fileName
      : resolveDownloadName(fileName, serverMime);
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = finalName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
  }

  return (
    <section className="timeline" aria-label={`${channel.title} timeline`}>
      <header className="timeline-header">
        {onBack ? (
          <button
            className="icon-button mobile-back"
            type="button"
            aria-label="Back to chats"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>
        ) : null}
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
            {channel.avatarUrl ? (
              <img
                src={channel.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : null}
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
          {onOpenMenu ? (
            <button
              className="icon-button timeline-more-btn"
              type="button"
              aria-label="Chat options"
              onClick={onOpenMenu}
            >
              <MoreVertical size={19} />
            </button>
          ) : null}
          <button
            className="icon-button timeline-panel-btn"
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
            showAuthor={channel.channelType === "group"}
          />
        ))}
      </div>
      {menu ? (
        <MessageContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onAction={(action, message) => void handleMenuAction(action, message)}
        />
      ) : null}
      {reactionPicker ? (
        <ReactionPicker
          state={reactionPicker}
          onClose={() => setReactionPicker(null)}
          onSelect={async (reaction) => {
            await onReact(reactionPicker.message, reaction);
            setReactionPicker(null);
          }}
        />
      ) : null}
      {attachmentPreview ? (
        <AttachmentViewer
          preview={attachmentPreview}
          onClose={() => setAttachmentPreview(null)}
          onDownload={() =>
            downloadFromUrl(attachmentPreview.url, attachmentPreview.fileName)
          }
        />
      ) : null}
    </section>
  );
}

function AttachmentViewer({
  preview,
  onClose,
  onDownload,
}: {
  preview: AttachmentPreviewState;
  onClose: () => void;
  onDownload: () => Promise<void>;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isImage =
    preview.mimeType.startsWith("image/") || preview.mediaType === "image";
  const isVideo =
    preview.mimeType.startsWith("video/") || preview.mediaType === "video";
  const isAudio =
    preview.mimeType.startsWith("audio/") || preview.mediaType === "audio";
  const isPdf = preview.mimeType === "application/pdf";

  return (
    <div
      className="attachment-viewer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="attachment-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`View ${preview.fileName}`}
      >
        <header className="attachment-viewer-header">
          <div>
            <strong>{preview.fileName}</strong>
            <span>{preview.mimeType || preview.mediaType}</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Download attachment"
            title="Download"
            onClick={() => void onDownload()}
          >
            <Download size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close attachment viewer"
            title="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="attachment-viewer-body">
          {isImage ? (
            <img src={preview.url} alt={preview.fileName} />
          ) : isVideo ? (
            <video src={preview.url} controls />
          ) : isAudio ? (
            <audio src={preview.url} controls />
          ) : isPdf ? (
            <iframe src={preview.url} title={preview.fileName} />
          ) : (
            <div className="attachment-viewer-fallback">
              <FileText size={34} aria-hidden="true" />
              <strong>Preview unavailable</strong>
              <span>{preview.fileName}</span>
              <button
                type="button"
                className="primary-action"
                onClick={() => void onDownload()}
              >
                <Download size={15} /> Download
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MessageBubble({
  message,
  onCreateTicket,
  onOpenMenu,
  onResolveMediaUrl,
  showAuthor,
}: {
  message: Message;
  onCreateTicket: (message: Message) => void;
  onOpenMenu: (message: Message, x: number, y: number) => void;
  onResolveMediaUrl: (mediaId: string) => Promise<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
  }>;
  showAuthor: boolean;
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
  const emojiOnly =
    message.media.length === 0 && isEmojiOnlyMessage(message.body);
  return (
    <article
      className={`message-bubble message-${message.kind}${emojiOnly ? " message-emoji-only" : ""}`}
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
      {message.kind === "inbound" && showAuthor ? (
        <span className="message-author">{message.sender}</span>
      ) : null}
      {message.body ? <MessageBody body={message.body} /> : null}
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

function isEmojiOnlyMessage(body: string): boolean {
  const value = body.trim();
  if (!value) return false;
  const emojiPattern =
    /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\p{Emoji_Modifier})?)*)/gu;
  const emojis = value.match(emojiPattern);
  if (!emojis?.length) return false;
  return value.replace(emojiPattern, "").trim().length === 0;
}

function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/gi);
  return (
    <p>
      {parts.map((part, index) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
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
  const hasAttachment = state.message.media.some(
    (item) => item.storageStatus === "downloaded",
  );
  type MenuItem =
    | { kind: "separator" }
    | {
        kind: "action";
        action: MessageMenuAction;
        label: string;
        icon: typeof SmilePlus;
      };
  const items: MenuItem[] = [
    // WhatsApp-order: Reply, React, attachment, Copy — then ClarioDesk-specific
    ...(!isNote
      ? ([
          {
            kind: "action",
            action: "reply",
            label: "Reply",
            icon: Reply,
          },
        ] satisfies MenuItem[])
      : []),
    { kind: "action", action: "react", label: "React", icon: SmilePlus },
    ...(hasAttachment
      ? ([
          {
            kind: "action",
            action: "view-attachment",
            label: "View",
            icon: Eye,
          },
          {
            kind: "action",
            action: "download-attachment",
            label: "Download",
            icon: Download,
          },
        ] as const)
      : []),
    { kind: "action", action: "copy", label: "Copy", icon: Copy },
    // ClarioDesk-specific actions
    ...(!isNote
      ? ([
          { kind: "separator" },
          {
            kind: "action",
            action: "create-ticket",
            label: "Create ticket",
            icon: Ticket,
          },
          {
            kind: "action",
            action: "mark-internal",
            label: "Mark as internal",
            icon: Lock,
          },
          {
            kind: "action",
            action: "reply-private",
            label: "Private note",
            icon: MessageSquarePlus,
          },
        ] satisfies MenuItem[])
      : []),
    { kind: "separator" },
    { kind: "action", action: "refresh", label: "Refresh", icon: RefreshCw },
    { kind: "action", action: "copy-id", label: "Copy message ID", icon: Clipboard },
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
            onClick={() => onAction(item.action, state.message)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReactionPicker({
  state,
  onClose,
  onSelect,
}: {
  state: ReactionPickerState;
  onClose: () => void;
  onSelect: (reaction: string) => Promise<void>;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) onClose();
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
      ref={pickerRef}
      className="reaction-picker"
      role="menu"
      aria-label="React to message"
      style={{
        left: Math.max(8, Math.min(state.x, window.innerWidth - 270)),
        top: Math.max(8, Math.min(state.y, window.innerHeight - 60)),
      }}
    >
      {reactions.map((reaction) => (
        <button
          key={reaction}
          type="button"
          role="menuitem"
          disabled={sending}
          aria-label={`React with ${reaction}`}
          onClick={() => {
            setSending(true);
            void onSelect(reaction).finally(() => setSending(false));
          }}
        >
          {reaction}
        </button>
      ))}
    </div>
  );
}
