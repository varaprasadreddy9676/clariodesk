import { FileClock, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiAuditLogEntry, ClarioApiClient } from "../api.js";
import { EmptyState } from "../components/States.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { formatTime } from "../lib/ui-mappers.js";

const PAGE_SIZE = 50;

export function AuditLogView({ api }: { api: ClarioApiClient }) {
  const [entries, setEntries] = useState<ApiAuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function load() {
    setError(null);
    try {
      const rows = await api.auditLogs();
      setEntries(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load audit log");
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  async function loadMore() {
    const last = entries?.[entries.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await api.auditLogs({
        beforeCreatedAtMs: new Date(last.createdAt).getTime(),
      });
      setEntries((current) => [...(current ?? []), ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="page-panel">
      <PanelTitle
        title="Audit log"
        subtitle={entries ? `${entries.length} records` : "Loading…"}
      />
      <button
        className="primary-action"
        type="button"
        onClick={() => void load()}
      >
        <RefreshCcw size={15} /> Refresh
      </button>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {entries && entries.length === 0 ? (
        <div className="page-panel-empty">
          <EmptyState
            icon={FileClock}
            title="Nothing recorded yet"
            body="Every external send, note, ticket change, and mapping change will show up here."
          />
        </div>
      ) : entries ? (
        <>
          <div className="table-list">
            {entries.map((entry) => (
              <article className="data-row tall" key={entry.id}>
                <div>
                  <strong>{entry.action}</strong>
                  <span>
                    {entry.actorName ?? entry.actorEmail ?? "System"}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                    {" · "}
                    {formatTime(entry.createdAt)}
                  </span>
                  {entry.metadata ? (
                    <pre className="audit-log-metadata">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
