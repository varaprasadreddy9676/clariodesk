import { EmptyState } from "./States.js";

export function SearchResultGroup({
  title,
  items,
  emptyBody,
  onOpen,
}: {
  title: string;
  items: Array<{ id: string; body: string; channelId: string; meta: string }>;
  emptyBody: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="context-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <EmptyState compact title="No results" body={emptyBody} />
      ) : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="search-result-row"
          onClick={() => onOpen(item.channelId)}
        >
          <div>
            <strong>{item.body}</strong>
          </div>
          <em>{item.meta}</em>
        </button>
      ))}
    </section>
  );
}
