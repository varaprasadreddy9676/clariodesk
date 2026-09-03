import { Ticket } from "lucide-react";
import type { ApiTeamMember, ApiTicket, ClarioApiClient } from "../api.js";
import { EmptyState } from "../components/States.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { memberName } from "../lib/ui-mappers.js";

export function TicketsView({
  api,
  tickets,
  members,
  onChanged,
}: {
  api: ClarioApiClient;
  tickets: ApiTicket[];
  members: ApiTeamMember[];
  onChanged: () => Promise<void>;
}) {
  async function update(id: string, status: "open" | "pending" | "closed") {
    await api.updateTicket(id, { status });
    await onChanged();
  }
  return (
    <section className="page-panel">
      <PanelTitle title="Tickets" subtitle={`${tickets.length} records`} />
      {tickets.length === 0 ? (
        <div className="page-panel-empty">
          <EmptyState
            icon={Ticket}
            title="No tickets yet"
            body="Convert an inbound WhatsApp message into a ticket to track it here."
          />
        </div>
      ) : (
        <div className="table-list">
          {tickets.map((ticket) => (
            <article className="data-row" key={ticket.id}>
              <div>
                <strong>{ticket.title}</strong>
                <span>
                  {ticket.priority} priority / assigned to{" "}
                  {memberName(members, ticket.assignedUserId)}
                </span>
              </div>
              <select
                aria-label={`Status for ${ticket.title}`}
                value={ticket.status}
                onChange={(event) =>
                  void update(
                    ticket.id,
                    event.target.value as "open" | "pending" | "closed",
                  )
                }
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
