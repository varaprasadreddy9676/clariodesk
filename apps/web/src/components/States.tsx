import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

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

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}
