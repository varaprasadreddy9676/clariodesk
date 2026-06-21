import { AlertTriangle, CheckCircle2, Clock3, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Channel, Ticket } from "../types.js";
import { ChannelStatusBadge, PhoneStatusPill } from "./StatusBadge.js";

type ContextTab = "Ticket" | "Channel" | "People" | "Events";

export function ContextPanel({
  channel,
  tickets,
  onClose,
  initialTab = "Ticket",
}: {
  channel: Channel;
  tickets: Ticket[];
  onClose: () => void;
  initialTab?: ContextTab;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, channel.id]);

  return (
    <aside className="context-panel" aria-label="Context panel">
      <div className="panel-header">
        <div>
          <h2>Context</h2>
          <span>{channel.client}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Close context panel" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="context-tabs" role="tablist" aria-label="Context tabs">
        {(["Ticket", "Channel", "People", "Events"] as ContextTab[]).map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Ticket" ? (
        <section className="context-section">
          <h3>Open Tickets</h3>
          <div className="ticket-stack">
            {tickets.length === 0 ? (
              <div className="empty-panel compact">
                <strong>No open tickets</strong>
                <span>Create one from an inbound message.</span>
              </div>
            ) : null}
            {tickets.map((ticket) => (
              <article className={`ticket-row priority-${ticket.priority}`} key={ticket.id}>
                <div>
                  <strong>{ticket.id}</strong>
                  <span>{ticket.title}</span>
                </div>
                <em>{ticket.owner}</em>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "Channel" ? (
        <section className="context-section">
          <h3>Channel Health</h3>
          <div className="facts">
            <div>
              <span>Status</span>
              <ChannelStatusBadge status={channel.status} />
            </div>
            <div>
              <span>Phone</span>
              <PhoneStatusPill status={channel.phoneStatus} />
            </div>
            <div>
              <span>Open tickets</span>
              <strong>{channel.openTickets}</strong>
            </div>
            <div>
              <span>Unread</span>
              <strong>{channel.unread}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "People" ? (
        <section className="context-section">
          <h3>People</h3>
          <div className="facts">
            <div>
              <span>Client</span>
              <strong>{channel.client}</strong>
            </div>
            <div>
              <span>Project</span>
              <strong>{channel.project ?? "Not selected"}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "Events" ? (
        <section className="context-section">
          <h3>Guardrails</h3>
          <ul className="guardrail-list">
            <li><CheckCircle2 size={15} aria-hidden="true" /> Send delay active</li>
            <li><Clock3 size={15} aria-hidden="true" /> First-response timer visible</li>
            <li><AlertTriangle size={15} aria-hidden="true" /> Mixed conversations are tracked for admin review</li>
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
