import { Bell, CheckCheck, Clock3, Phone, Ticket, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { RealtimeNotification, RealtimeStatus } from "../realtime.js";

export function NotificationCenter({
  open,
  status,
  notifications,
  unreadCount,
  onClose,
  onMarkAllRead,
  onClear,
  onMarkRead,
  onOpenChannel,
  onOpenTickets,
}: {
  open: boolean;
  status: RealtimeStatus;
  notifications: RealtimeNotification[];
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onMarkRead: (id: string) => void;
  onOpenChannel: (channelId: string) => void;
  onOpenTickets: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside ref={panelRef} className="notification-panel" aria-label="Notifications" role="dialog" aria-modal="false">
      <div className="notification-panel-header">
        <div>
          <strong>Notifications</strong>
          <span>
            {unreadCount} unread · {status}
          </span>
        </div>
        <button className="icon-button" type="button" aria-label="Close notifications" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="notification-panel-actions">
        <button type="button" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={14} aria-hidden="true" />
          Mark all read
        </button>
        <button type="button" onClick={onClear} disabled={notifications.length === 0}>
          Clear
        </button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="empty-panel compact">
            <strong>No realtime events yet</strong>
            <span>Messages, tickets, notes, and phone events will appear here.</span>
          </div>
        ) : null}
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`notification-row ${notification.read ? "" : "is-unread"}`}
            onClick={() => {
              onMarkRead(notification.id);
              if (notification.channelId) onOpenChannel(notification.channelId);
              else if (notification.ticketId) onOpenTickets();
            }}
          >
            <div className="notification-row-icon" aria-hidden="true">
              {notification.type === "message.received" ? <Bell size={15} /> : null}
              {notification.type === "ticket.created" || notification.type === "ticket.updated" ? <Ticket size={15} /> : null}
              {notification.type === "phone.status_changed" ? <Phone size={15} /> : null}
              {notification.type === "note.created" || notification.type === "outbox.status_changed" || notification.type === "channel.updated" ? (
                <Clock3 size={15} />
              ) : null}
            </div>
            <div className="notification-row-body">
              <strong>{notification.title}</strong>
              <span>{notification.body}</span>
              <em>{formatNotificationTime(notification.createdAt)}</em>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
