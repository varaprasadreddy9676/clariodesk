import { FileText, X } from "lucide-react";

export function AttachmentTray({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className="composer-attachment" aria-label={`Attached ${file.name}`}>
      <FileText size={17} aria-hidden="true" />
      <span>
        <strong>{file.name}</strong>
        <small>{formatBytes(file.size)}</small>
      </span>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
