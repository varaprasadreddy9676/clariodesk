import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { ChannelStatus, PhoneStatus } from "../types.js";

type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "info";

const channelTone: Record<ChannelStatus, BadgeTone> = {
  active: "ok",
  unmapped: "warn",
  mixed: "info",
  muted: "neutral",
  degraded: "danger",
};

const phoneTone: Record<PhoneStatus, BadgeTone> = {
  connected: "ok",
  syncing: "info",
  degraded: "danger",
  qr_required: "warn",
};

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={`status-badge status-${tone}`}>
      <span aria-hidden="true" className="status-dot" />
      {label}
    </span>
  );
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  return <StatusBadge label={status.replace("_", " ")} tone={channelTone[status]} />;
}

export function PhoneStatusPill({ status }: { status: PhoneStatus }) {
  const Icon =
    status === "connected"
      ? CheckCircle2
      : status === "syncing"
        ? RefreshCw
        : status === "degraded"
          ? ShieldAlert
          : HelpCircle;
  return (
    <span className={`phone-pill status-${phoneTone[status]}`}>
      <Icon size={13} aria-hidden="true" />
      {status.replace("_", " ")}
    </span>
  );
}

export function RiskPill({ children }: { children: string }) {
  return (
    <span className="risk-pill">
      <AlertTriangle size={13} aria-hidden="true" />
      {children}
    </span>
  );
}

export function WaitingPill({ since }: { since?: string }) {
  if (!since) return null;
  return (
    <span className="waiting-pill">
      <Clock3 size={13} aria-hidden="true" />
      Waiting since {since}
    </span>
  );
}
