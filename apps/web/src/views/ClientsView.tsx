import { useState } from "react";
import type { ApiCustomer, ClarioApiClient } from "../api.js";
import { Field } from "../components/Field.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { EmptyState } from "../components/States.js";
import { useAsyncData } from "../hooks.js";

export function ClientsView({
  api,
  clients,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  clients: ApiCustomer[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <section className="page-panel">
      <PanelTitle title="Clients" subtitle={`${clients.length} accounts`} />
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void runAction(async () => {
            await api.createClient({ name });
            setName("");
            await onChanged();
          }, "Client created");
        }}
      >
        <Field label="Client name" value={name} onChange={setName} required />
        <button className="primary-action" type="submit" disabled={!name.trim()}>
          Create client
        </button>
      </form>
      <div className="table-list">
        {clients.length === 0 ? (
          <EmptyState
            compact
            title="No clients yet"
            body="Add a client above to start mapping WhatsApp chats to their conversations."
          />
        ) : null}
        {clients.map((client) => (
          <ClientRow key={client.id} api={api} client={client} />
        ))}
      </div>
    </section>
  );
}

function ClientRow({
  api,
  client,
}: {
  api: ClarioApiClient;
  client: ApiCustomer;
}) {
  const projects = useAsyncData(
    () => api.projects(client.id),
    [api, client.id],
  );
  const [projectName, setProjectName] = useState("");
  return (
    <article className="data-row tall">
      <div>
        <strong>{client.name}</strong>
        <span>{client.status}</span>
        <div className="mini-list">
          {(projects.data ?? []).map((project) => (
            <em key={project.id}>{project.name}</em>
          ))}
        </div>
      </div>
      <form
        className="inline-form compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!projectName.trim()) return;
          void (async () => {
            await api.createProject({
              clientId: client.id,
              name: projectName,
            });
            setProjectName("");
            await projects.refresh();
          })();
        }}
      >
        <Field
          label="Project name"
          value={projectName}
          onChange={setProjectName}
        />
        <button type="submit" disabled={!projectName.trim()}>
          Add project
        </button>
      </form>
    </article>
  );
}
