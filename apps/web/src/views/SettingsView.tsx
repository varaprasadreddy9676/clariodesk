import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type {
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
}) {
  const push = usePushSubscription(api);
  const [qrTitle, setQrTitle] = useState("");
  const [qrBody, setQrBody] = useState("");
  const [signature, setSignature] = useState(me?.signature ?? "");
  useEffect(() => {
    setSignature(me?.signature ?? "");
  }, [me?.signature]);

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
