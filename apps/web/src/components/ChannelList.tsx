import { Search, User, Users } from "lucide-react";
import type { Channel } from "../types.js";
import { avatarColor, avatarInitials } from "../lib/avatar.js";
import { PhoneStatusPill, WaitingPill } from "./StatusBadge.js";

export type ChannelView = "all" | "groups" | "direct" | "unread";

export function ChannelList({
  channels,
  activeId,
  onSelect,
  onOpenMenu,
  query,
  onQueryChange,
  view,
  onViewChange,
}: {
  channels: Channel[];
  activeId: string;
  onSelect: (id: string) => void;
  onOpenMenu: (channel: Channel, x: number, y: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  view: ChannelView;
  onViewChange: (value: ChannelView) => void;
}) {
  const views: Array<{ id: ChannelView; label: string }> = [
    { id: "all", label: "All" },
    { id: "groups", label: "Groups" },
    { id: "direct", label: "Direct" },
    { id: "unread", label: "Unread" },
  ];

  return (
    <section className="channel-list" aria-label="Channels">
      <div className="panel-header">
        <div>
          <h1>Inbox</h1>
          <span>{channels.length} chats</span>
        </div>
      </div>

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
          <button
            key={channel.id}
            type="button"
            role="listitem"
            className={`channel-row ${activeId === channel.id ? "is-active" : ""}${channel.unread > 0 ? " is-unread" : ""}`}
            onClick={() => onSelect(channel.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenMenu(channel, event.clientX, event.clientY);
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
            </span>
            <span className="channel-row-body">
              <span className="channel-row-top">
                <strong className="channel-name">{channel.title}</strong>
                <span className="channel-time">{channel.lastTime}</span>
              </span>
              <span className="channel-row-bottom">
                <span className="channel-preview">{channel.lastMessage}</span>
                <span className="channel-counters">
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
        ))}
      </div>
    </section>
  );
}
