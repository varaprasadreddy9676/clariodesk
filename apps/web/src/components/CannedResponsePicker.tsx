import { useEffect, useRef, useState } from "react";
import type { ApiCannedResponse, ClarioApiClient } from "../api.js";

/** Popover listing the workspace's shared quick replies (canned responses). */
export function CannedResponsePicker({
  api,
  onSelect,
  onClose,
}: {
  api: ClarioApiClient;
  onSelect: (body: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ApiCannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .cannedResponses(query)
        .then((results) => {
          if (!cancelled) setItems(results);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, query]);

  return (
    <div
      className="canned-response-picker"
      role="dialog"
      aria-label="Insert a quick reply"
      ref={pickerRef}
    >
      <input
        type="text"
        placeholder="Search quick replies…"
        aria-label="Search quick replies"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      {loading ? (
        <div className="canned-response-empty">Loading…</div>
      ) : error ? (
        <div className="canned-response-empty">{error}</div>
      ) : items.length === 0 ? (
        <div className="canned-response-empty">
          {query ? "No matches" : "No quick replies yet"}
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.body)}>
                <span className="canned-response-title">{item.title}</span>
                <span className="canned-response-body">{item.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
