import {
  AlertCircle,
  Bell,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
} from "lucide-react";
import type { OpsSummary } from "../types.js";

export function OpsBar({
  summary,
  realtimeStatus,
  notificationCount,
  onOpenNotifications,
  theme,
  onToggleTheme,
}: {
  summary: OpsSummary;
  realtimeStatus: "connected" | "reconnecting" | "disconnected";
  notificationCount: number;
  onOpenNotifications: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const items = [
    {
      label: "Phones",
      value: summary.connectedPhones,
      detail: summary.degradedPhones > 0 ? `${summary.degradedPhones} at risk` : null,
      icon: Smartphone,
      tone: summary.degradedPhones > 0 ? "warn" : "ok",
    },
    {
      label: "Waiting",
      value: summary.awaitingResponses,
      detail: null,
      icon: RefreshCw,
      tone: summary.awaitingResponses > 0 ? "info" : "ok",
    },
    {
      label: "Failed sends",
      value: summary.failedOutbox,
      detail: null,
      icon: AlertCircle,
      tone: summary.failedOutbox > 0 ? "danger" : "ok",
    },
  ];
  return (
    <section className="ops-bar" aria-label="Operational status">
      <strong className="mobile-brand">ClarioDesk</strong>
      <div className="ops-metrics">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className={`ops-item ops-${item.tone}`} key={item.label}>
              <Icon size={14} aria-hidden="true" />
              <span className="ops-item-label">{item.label}</span>
              <strong>{item.value}</strong>
              {item.detail ? <em className="ops-item-detail">{item.detail}</em> : null}
            </div>
          );
        })}
      </div>
      <div className="ops-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className="icon-button ops-notification-button"
          aria-label={`Notifications, ${notificationCount} unread`}
          onClick={onOpenNotifications}
        >
          <Bell size={16} aria-hidden="true" />
          {notificationCount > 0 ? (
            <strong className="notification-badge">{notificationCount}</strong>
          ) : null}
        </button>
        <span
          className={`realtime-pill realtime-${realtimeStatus}`}
          role="status"
        >
          <span className="realtime-dot" aria-hidden="true" />
          {realtimeStatus === "connected"
            ? "Connected"
            : realtimeStatus === "reconnecting"
              ? "Reconnecting"
              : "Disconnected"}
        </span>
      </div>
    </section>
  );
}
