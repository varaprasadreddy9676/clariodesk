import { Lock, Send, StickyNote, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Channel } from "../types.js";

type ComposerMode = "reply" | "note";
export type ComposerDraft = {
  mode: ComposerMode;
  body: string;
  nonce: number;
};

export function Composer({
  channel,
  draft,
  onSendReply,
  onCreateNote,
}: {
  channel: Channel;
  draft?: ComposerDraft | null;
  onSendReply: (body: string) => Promise<void>;
  onCreateNote: (body: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [body, setBody] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const replyBlocked = channel.status === "muted" || channel.phoneStatus === "degraded";
  const sendLabel = mode === "reply" ? "Send to WhatsApp" : "Save internal note";
  const helper = useMemo(() => {
    if (mode === "note") return "Private to workspace";
    if (channel.status === "muted") return "Channel archived from latest gateway sync";
    if (channel.phoneStatus === "degraded") return "Phone route degraded";
    return `${channel.title} via Support Phone`;
  }, [channel, mode]);

  useEffect(() => {
    if (!draft) return;
    setMode(draft.mode);
    setBody(draft.body);
  }, [draft]);

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submitState === "sending") return;
    setError(null);
    setSubmitState("sending");
    try {
      if (mode === "reply") {
        await onSendReply(trimmed);
      } else {
        await onCreateNote(trimmed);
      }
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitState("idle");
    }
  }

  return (
    <section className={`composer composer-${mode}`} aria-label="Message composer">
      <div className="composer-tabs" role="tablist" aria-label="Composer mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "reply"}
          className={mode === "reply" ? "is-active" : ""}
          onClick={() => setMode("reply")}
        >
          <Send size={14} aria-hidden="true" />
          Reply
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "note"}
          className={mode === "note" ? "is-active" : ""}
          onClick={() => setMode("note")}
        >
          <StickyNote size={14} aria-hidden="true" />
          Note
        </button>
      </div>
      <div className="composer-body">
        <div className="composer-route">
          {mode === "note" ? <Lock size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          <span>{helper}</span>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder={mode === "reply" ? "Reply to the WhatsApp group" : "Add an internal note"}
        />
        {error ? <div className="form-error">{error}</div> : null}
        <div className="composer-actions">
          {body ? (
            <button className="icon-button" type="button" aria-label="Clear composer" onClick={() => setBody("")}>
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
          <button
            className="primary-action"
            type="button"
          disabled={!body.trim() || submitState === "sending" || (mode === "reply" && replyBlocked)}
          onClick={() => void handleSubmit()}
        >
            {mode === "reply" ? <Send size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
            {submitState === "sending" ? "Working..." : sendLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
