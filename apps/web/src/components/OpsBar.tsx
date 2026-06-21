import {
  AlertCircle,
  Bell,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Wifi,
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
      value: `${summary.connectedPhones} up / ${summary.degradedPhones} risk`,
      icon: Smartphone,
      tone: summary.degradedPhones > 0 ? "warn" : "ok",
    },
    {
      label: "Waiting",
      value: String(summary.awaitingResponses),
      icon: RefreshCw,
      tone: summary.awaitingResponses > 0 ? "info" : "ok",
    },
    {
      label: "Failed sends",
      value: String(summary.failedOutbox),
      icon: AlertCircle,
      tone: summary.failedOutbox > 0 ? "danger" : "ok",
    },
  ];
  return (
    <section className="ops-bar" aria-label="Operational status">
      <div className="ops-metrics">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className={`ops-item ops-${item.tone}`} key={item.label}>
              <Icon size={15} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
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
          className="ops-notification-button"
          onClick={onOpenNotifications}
        >
          <Bell size={15} aria-hidden="true" />
          <span>Notifications</span>
          <strong>{notificationCount}</strong>
        </button>
        <span className={`realtime-pill realtime-${realtimeStatus}`}>
          <Wifi size={14} aria-hidden="true" />
          {realtimeStatus}
        </span>
      </div>
    </section>
  );
}
