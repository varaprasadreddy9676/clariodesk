import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-box" aria-busy="true" aria-label={label}>
      <Loader2 size={18} aria-hidden="true" className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state-box state-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

/**
 * The single shared empty-state primitive — replaces three prior ad-hoc
 * patterns (the local `Empty` in App.tsx, the `.setup-empty` markup used by
 * TicketsView/SetupEmpty, and each component's own `.empty-panel` div).
 * See docs/design/redesign-implementation-guide.md finding #1.
 *
 * `compact` drops the icon circle and page-scale heading for inline "no
 * results in this list" spots (channel list, notification panel, context
 * panel, search results) where a full illustration would be oversized.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  hint,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-state-compact" : ""}`} role="status">
      {compact ? null : (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
      )}
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
      {hint ? <span className="empty-state-hint">{hint}</span> : null}
    </div>
  );
}
