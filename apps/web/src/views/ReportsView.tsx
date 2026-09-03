import { RefreshCcw } from "lucide-react";
import type { ApiOpsSummary } from "../api.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { formatTime } from "../lib/ui-mappers.js";

export function ReportsView({
  ops,
  onRefresh,
}: {
  ops: ApiOpsSummary | null;
  onRefresh: () => void;
}) {
  return (
    <section className="page-panel">
      <PanelTitle
        title="Reports"
        subtitle={
          ops ? `Generated ${formatTime(ops.generatedAt)}` : "No summary loaded"
        }
      />
      <button className="primary-action" type="button" onClick={onRefresh}>
        <RefreshCcw size={15} /> Refresh
      </button>
      <div className="metric-grid">
        <Metric label="Open tickets" value={ops?.tickets.open ?? 0} />
        <Metric label="Pending tickets" value={ops?.tickets.pending ?? 0} />
        <Metric label="Unmapped groups" value={ops?.channels.unmapped ?? 0} />
        <Metric
          label="Failed outbox"
          value={ops?.outbox.byStatus.failed ?? 0}
        />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
