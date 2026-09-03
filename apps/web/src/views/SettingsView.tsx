import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ApiAiConnection,
  ApiCannedResponse,
  ApiMe,
  AuthSession,
  ClarioApiClient,
} from "../api.js";
import { Field } from "../components/Field.js";
import { PanelTitle } from "../components/PanelTitle.js";
import { EmptyState } from "../components/States.js";
import {
  usePushSubscription,
  type PushPermissionState,
} from "../usePushSubscription.js";

export function SettingsView({
  session,
  api,
  onSignOut,
  onRefresh,
  cannedResponses,
  onCannedResponsesChanged,
  runAction,
  me,
  onMeChanged,
  aiConnections,
  onAiConnectionsChanged,
}: {
  session: AuthSession;
  api: ClarioApiClient;
  onSignOut: () => void;
  onRefresh: () => void;
  cannedResponses: ApiCannedResponse[];
  onCannedResponsesChanged: () => void;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
  me: ApiMe | null;
  onMeChanged: () => void;
  aiConnections: ApiAiConnection[];
  onAiConnectionsChanged: () => void;
}) {
  const push = usePushSubscription(api);
  const [qrTitle, setQrTitle] = useState("");
  const [qrBody, setQrBody] = useState("");
  const [signature, setSignature] = useState(me?.signature ?? "");
  useEffect(() => {
    setSignature(me?.signature ?? "");
  }, [me?.signature]);
  const [aiProvider, setAiProvider] =
    useState<ApiAiConnection["provider"]>("anthropic");
  const [aiLabel, setAiLabel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const needsBaseUrl = aiProvider === "custom" || aiProvider === "azure_openai";

  return (
    <section className="page-panel">
      <PanelTitle
        title="Settings"
        subtitle={`Workspace ${session.workspaceId}`}
      />
      <div className="table-list">
        <article className="data-row">
          <div>
            <strong>Session</strong>
            <span>
              {session.role} user {session.userId}
            </span>
          </div>
          <div className="row-actions">
            <button type="button" onClick={onRefresh}>
              Refresh data
            </button>
            <button type="button" onClick={onSignOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </article>
        <article className="data-row">
          <div>
            <strong>Notifications</strong>
            <span>{notificationStatusText(push.state)}</span>
            {push.error ? (
              <span className="form-error">{push.error}</span>
            ) : null}
          </div>
          <div className="row-actions">
            {push.state === "unsupported" ? null : push.state === "denied" ? (
              <span>Blocked in browser settings</span>
            ) : push.state === "granted-on" ? (
              <button
                type="button"
                disabled={push.busy}
                onClick={() => void push.disable()}
              >
                Turn off
              </button>
            ) : (
              <button
                type="button"
                disabled={push.busy}
                onClick={() => void push.enable()}
              >
                Turn on
              </button>
            )}
          </div>
        </article>
        {session.role !== "viewer" ? (
          <article className="data-row">
            <div>
              <strong>Reply signature</strong>
              <span>
                Prepended to your WhatsApp replies, e.g. "L1 Team" or
                "Functional Expert" — matches how the team already signs
                shared-number replies by hand.
              </span>
            </div>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(async () => {
                  await api.updateMySignature(signature.trim() || null);
                  onMeChanged();
                }, "Signature updated");
              }}
            >
              <Field
                label="Signature"
                value={signature}
                onChange={setSignature}
                placeholder="e.g. L1 Team"
              />
              <button className="primary-action" type="submit">
                Save
              </button>
            </form>
          </article>
        ) : null}
      </div>
      <PanelTitle
        title="Quick replies"
        subtitle="Shared team responses agents can insert into the composer"
      />
      {session.role !== "viewer" ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!qrTitle.trim() || !qrBody.trim()) return;
            void runAction(async () => {
              await api.createCannedResponse({
                title: qrTitle.trim(),
                body: qrBody.trim(),
              });
              setQrTitle("");
              setQrBody("");
              onCannedResponsesChanged();
            }, "Quick reply created");
          }}
        >
          <Field
            label="Title"
            value={qrTitle}
            onChange={setQrTitle}
            placeholder="e.g. Refund policy"
          />
          <Field
            label="Reply text"
            value={qrBody}
            onChange={setQrBody}
            placeholder="Reply text"
          />
          <button
            className="primary-action"
            type="submit"
            disabled={!qrTitle.trim() || !qrBody.trim()}
          >
            Add quick reply
          </button>
        </form>
      ) : null}
      <div className="table-list">
        {cannedResponses.length === 0 ? (
          <EmptyState
            compact
            title="No quick replies yet"
            body="Add one above so the whole team can reuse it in the composer."
          />
        ) : (
          cannedResponses.map((item) => (
            <article className="data-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
              {session.role !== "viewer" ? (
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(async () => {
                        await api.deleteCannedResponse(item.id);
                        onCannedResponsesChanged();
                      }, "Quick reply deleted")
                    }
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
      {session.role === "admin" ? (
        <>
          <PanelTitle
            title="AI providers (BYOK)"
            subtitle="Bring your own model-provider key — no ClarioDesk feature is locked to one vendor"
          />
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!aiLabel.trim() || !aiApiKey.trim()) return;
              void runAction(async () => {
                await api.createAiConnection({
                  provider: aiProvider,
                  label: aiLabel.trim(),
                  apiKey: aiApiKey.trim(),
                  ...(aiBaseUrl.trim() ? { baseUrl: aiBaseUrl.trim() } : {}),
                  ...(aiModel.trim() ? { model: aiModel.trim() } : {}),
                });
                setAiLabel("");
                setAiApiKey("");
                setAiBaseUrl("");
                setAiModel("");
                onAiConnectionsChanged();
              }, "Provider connection saved");
            }}
          >
            <label className="field">
              <span>Provider</span>
              <select
                value={aiProvider}
                onChange={(event) =>
                  setAiProvider(
                    event.target.value as ApiAiConnection["provider"],
                  )
                }
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="azure_openai">Azure OpenAI</option>
                <option value="custom">Custom / self-hosted</option>
              </select>
            </label>
            <Field
              label="Label"
              value={aiLabel}
              onChange={setAiLabel}
              placeholder="e.g. Anthropic (prod)"
            />
            <Field
              label="API key"
              value={aiApiKey}
              onChange={setAiApiKey}
              type="password"
              autoComplete="off"
              placeholder="sk-..."
            />
            {needsBaseUrl ? (
              <Field
                label="Base URL"
                value={aiBaseUrl}
                onChange={setAiBaseUrl}
                placeholder="https://..."
              />
            ) : null}
            <Field
              label="Model (optional)"
              value={aiModel}
              onChange={setAiModel}
              placeholder="e.g. claude-sonnet-5"
            />
            <button
              className="primary-action"
              type="submit"
              disabled={!aiLabel.trim() || !aiApiKey.trim()}
            >
              Connect
            </button>
          </form>
          <div className="table-list">
            {aiConnections.length === 0 ? (
              <EmptyState
                compact
                title="No providers connected yet"
                body="Connect any model provider above — nothing in ClarioDesk requires a specific one."
              />
            ) : (
              aiConnections.map((conn) => (
                <article className="data-row" key={conn.id}>
                  <div>
                    <strong>{conn.label}</strong>
                    <span>
                      {conn.provider}
                      {conn.model ? ` · ${conn.model}` : ""} ·{" "}
                      {conn.status === "active" ? "Active" : "Disabled"}
                      {conn.lastHealthCheckAt
                        ? conn.lastHealthCheckOk
                          ? " · Connection OK"
                          : ` · ${conn.lastHealthCheckError ?? "Connection failed"}`
                        : ""}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(async () => {
                          await api.testAiConnection(conn.id);
                          onAiConnectionsChanged();
                        }, "Connection tested")
                      }
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(async () => {
                          await api.updateAiConnection(conn.id, {
                            status:
                              conn.status === "active" ? "disabled" : "active",
                          });
                          onAiConnectionsChanged();
                        }, "Connection updated")
                      }
                    >
                      {conn.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(async () => {
                          await api.deleteAiConnection(conn.id);
                          onAiConnectionsChanged();
                        }, "Connection removed")
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function notificationStatusText(state: PushPermissionState): string {
  switch (state) {
    case "unsupported":
      return "Not supported in this browser";
    case "denied":
      return "Permission denied";
    case "granted-on":
      return "On — you'll get notified of new messages when the app is closed";
    case "granted-off":
      return "Off";
    default:
      return "Get notified of new messages when the app is closed";
  }
}
