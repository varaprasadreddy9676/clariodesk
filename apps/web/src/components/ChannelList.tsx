import {
  BellOff,
  MoreVertical,
  PenSquare,
  Pin,
  RefreshCcw,
  Search,
  User,
  Users,
} from "lucide-react";
import { useRef } from "react";
import type { Channel } from "../types.js";
import type { ChannelView } from "../lib/whatsapp-sort.js";
import { avatarColor, avatarInitials } from "../lib/avatar.js";
import { PhoneStatusPill, WaitingPill } from "./StatusBadge.js";

export type { ChannelView } from "../lib/whatsapp-sort.js";

export function ChannelList({
  channels,
  activeId,
  onSelect,
  onOpenMenu,
  query,
  onQueryChange,
  view,
  onViewChange,
  syncing = false,
}: {
  channels: Channel[];
  activeId: string;
  onSelect: (id: string) => void;
  onOpenMenu: (channel: Channel, x: number, y: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  view: ChannelView;
  onViewChange: (value: ChannelView) => void;
  syncing?: boolean;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function startLongPress(channel: Channel, e: React.TouchEvent) {
    longPressFired.current = false;
    const touch = e.touches[0];
    if (!touch) return;
    const { clientX: x, clientY: y } = touch;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onOpenMenu(channel, x, y);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  const views: Array<{ id: ChannelView; label: string }> = [
    { id: "all", label: "All" },
    { id: "groups", label: "Groups" },
    { id: "direct", label: "Direct" },
    { id: "unread", label: "Unread" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <section className="channel-list" aria-label="Channels">
      <div className="panel-header">
        <h1>Chats</h1>
        <button
          type="button"
          className="icon-button"
          aria-label="New chat"
          title="New chat"
        >
          <PenSquare size={19} />
        </button>
      </div>

      {syncing ? (
        <div className="channel-sync-status" role="status" aria-live="polite">
          <RefreshCcw size={14} aria-hidden="true" />
          <span>
            <strong>Syncing WhatsApp</strong>
            Chats and recent messages will appear automatically.
          </span>
        </div>
      ) : null}

      <label className="search-box">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search chats or clients"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="view-tabs" role="tablist" aria-label="Inbox views">
        {views.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="channel-rows" role="list">
        {channels.length === 0 ? (
          <div className="empty-panel">
            <strong>No channels match</strong>
            <span>Sync chats from a connected phone or clear the filter.</span>
          </div>
        ) : null}
        {channels.map((channel) => (
          <div
            key={channel.id}
            role="listitem"
            className={`channel-row ${activeId === channel.id ? "is-active" : ""}${channel.unread > 0 ? " is-unread" : ""}`}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenMenu(channel, event.clientX, event.clientY);
            }}
          >
            <button
              type="button"
              className="channel-row-select"
              onClick={() => {
                if (longPressFired.current) {
                  longPressFired.current = false;
                  return;
                }
                onSelect(channel.id);
              }}
              onTouchStart={(e) => startLongPress(channel, e)}
              onTouchEnd={cancelLongPress}
              onTouchMove={cancelLongPress}
              onTouchCancel={cancelLongPress}
              onKeyDown={(event) => {
                if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenMenu(channel, rect.right - 12, rect.top + 12);
              }}
            >
            <span
              className="channel-avatar"
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
            <span className="channel-row-body">
              <span className="channel-row-top">
                <strong className="channel-name">{channel.title}</strong>
                <span className="channel-time">{channel.lastTime}</span>
              </span>
              <span className="channel-row-bottom">
                <span className="channel-preview">{channel.lastMessage}</span>
                <span className="channel-counters">
                  {channel.isMuted ? (
                    <BellOff size={13} aria-label="Muted" />
                  ) : null}
                  {channel.isPinned ? <Pin size={13} aria-label="Pinned" /> : null}
                  {channel.unread > 0 ? (
                    <span className="channel-badge">{channel.unread}</span>
                  ) : null}
                </span>
              </span>
              <span className="channel-meta">
                <span className="channel-kind">
                  {channel.channelType === "group" ? "Group" : "Direct"}
                  {channel.client ? ` · ${channel.client}` : ""}
                </span>
                <PhoneStatusPill status={channel.phoneStatus} />
                <WaitingPill since={channel.awaitingResponseSince} />
                {channel.openTickets > 0 ? (
                  <em className="channel-tickets">
                    {channel.openTickets} tickets
                  </em>
                ) : null}
              </span>
            </span>
            </button>
            <button
              type="button"
              className="channel-row-menu"
              aria-label={`More actions for ${channel.title}`}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenMenu(channel, rect.right - 8, rect.bottom + 4);
              }}
            >
              <MoreVertical size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
