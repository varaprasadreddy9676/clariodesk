import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import type { ClarioApiClient } from "../api.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { SearchResultGroup } from "../components/SearchResultGroup.js";
import { formatTime } from "../lib/ui-mappers.js";

export function SearchView({
  api,
  onOpenChannel,
  onOpenTicket,
}: {
  api: ClarioApiClient;
  onOpenChannel: (channelId: string) => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Awaited<
    ReturnType<ClarioApiClient["search"]>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError(null);
    setLoading(true);
    try {
      setResult(await api.search(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="page-panel">
      <PanelTitle title="Search" subtitle="Messages and tickets" />
      <form
        className="inline-form page-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {/* Visible label, not just a placeholder — see
            docs/design/redesign-implementation-guide.md finding #2. Icon +
            input visual style reused from ChannelList's `.search-box`. */}
        <label className="page-search-field">
          <span>Search</span>
          <span className="search-input-shell">
            <SearchIcon size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages and tickets"
            />
          </span>
        </label>
        <button
          className="primary-action"
          type="submit"
          disabled={!query.trim() || loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error ? <div className="form-error">{error}</div> : null}
      {result ? (
        <div className="split-list">
          <SearchResultGroup
            title="Messages"
            items={result.messages.map((item) => ({
              id: item.id,
              body: item.body ?? item.id,
              channelId: item.channelId,
              meta: formatTime(item.providerTimestamp),
            }))}
            emptyBody="Try a different search phrase."
            onOpen={(channelId) => onOpenChannel(channelId)}
          />
          <SearchResultGroup
            title="Tickets"
            items={result.tickets.map((item) => ({
              id: item.id,
              body: item.title,
              channelId: item.channelId,
              meta: item.status,
            }))}
            emptyBody="No tickets match this search."
            onOpen={(ticketId) => onOpenTicket(ticketId)}
          />
        </div>
      ) : null}
    </section>
  );
}
