import { useState } from "react";
import type { ApiTeamMember, ClarioApiClient } from "../api.js";
import { Field } from "../components/Field.js";
import { PanelTitle } from "../components/PanelTitle.js";

export function TeamView({
  api,
  members,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  members: ApiTeamMember[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent" | "viewer">("agent");
  return (
    <section className="page-panel">
      <PanelTitle title="Team" subtitle={`${members.length} members`} />
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!email || !displayName || password.length < 8) return;
          void runAction(async () => {
            await api.createUser({ email, displayName, password, role });
            setEmail("");
            setDisplayName("");
            setPassword("");
            await onChanged();
          }, "Team member created");
        }}
      >
        <Field
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
          required
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Temporary password"
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="new-password"
          required
        />
        <label className="field">
          <span>Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="agent">Agent</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          className="primary-action"
          type="submit"
          disabled={!email || !displayName || password.length < 8}
        >
          Create user
        </button>
      </form>
      <div className="table-list">
        {members.map((member) => (
          <article className="data-row" key={member.userId}>
            <div>
              <strong>{member.displayName}</strong>
              <span>{member.email}</span>
            </div>
            <em>
              {member.role} / {member.status}
            </em>
          </article>
        ))}
      </div>
    </section>
  );
}
