import {
  Lock,
  Paperclip,
  Send,
  Signature as SignatureIcon,
  Smile,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClarioApiClient } from "../api.js";
import type { Channel } from "../types.js";
import { AttachmentTray } from "./AttachmentTray.js";
import { CannedResponsePicker } from "./CannedResponsePicker.js";
import { EmojiPicker } from "./EmojiPicker.js";
import {
  insertAtSelection,
  validateComposerAttachment,
} from "./composer-utils.js";

type ComposerMode = "reply" | "note";
export type ComposerDraft = {
  mode: ComposerMode;
  body: string;
  nonce: number;
};

export function Composer({
  api,
  channel,
  draft,
  signature,
  onSendReply,
  onCreateNote,
}: {
  api: ClarioApiClient;
  channel: Channel;
  draft?: ComposerDraft | null;
  /** The current agent's reply signature (e.g. "L1 Team"), set in Settings. */
  signature?: string | null;
  onSendReply: (input: { body: string; attachment?: File }) => Promise<void>;
  onCreateNote: (body: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<ComposerMode>("reply");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [signOutbound, setSignOutbound] = useState(true);
  const [submitState, setSubmitState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyBlocked = channel.phoneStatus === "degraded";
  const canSubmit =
    submitState === "idle" &&
    (mode === "note"
      ? Boolean(body.trim())
      : Boolean(body.trim() || attachment)) &&
    !(mode === "reply" && replyBlocked);
  const helper = useMemo(() => {
    if (mode === "note") return "Private to your workspace";
    if (channel.phoneStatus === "degraded")
      return "Reconnect the phone to send";
    return `${channel.title} via Support Phone`;
  }, [channel, mode]);

  useEffect(() => {
    if (!draft) return;
    setMode(draft.mode);
    setBody(draft.body);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [draft]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [body]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitState("sending");
    try {
      if (mode === "reply") {
        const outboundBody =
          signature && signOutbound
            ? `*${signature}:*\n${body.trim()}`
            : body.trim();
        await onSendReply({
          body: outboundBody,
          ...(attachment ? { attachment } : {}),
        });
      } else {
        await onCreateNote(body.trim());
      }
      setBody("");
      setAttachment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitState("idle");
    }
  }

  function selectMode(nextMode: ComposerMode) {
    setMode(nextMode);
    setEmojiOpen(false);
    setQuickRepliesOpen(false);
    if (nextMode === "note") setAttachment(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? start;
    const next = insertAtSelection(body, emoji, start, end);
    setBody(next.value);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.caret, next.caret);
    });
  }

  function insertQuickReply(text: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? start;
    const next = insertAtSelection(body, text, start, end);
    setBody(next.value);
    setQuickRepliesOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.caret, next.caret);
    });
  }

  return (
    <section
      className={`composer composer-${mode}`}
      aria-label="Message composer"
    >
      <div className="composer-tabs" role="tablist" aria-label="Composer mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "reply"}
          className={mode === "reply" ? "is-active" : ""}
          onClick={() => selectMode("reply")}
        >
          WhatsApp
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "note"}
          className={mode === "note" ? "is-active" : ""}
          onClick={() => selectMode("note")}
        >
          Private Note
        </button>
      </div>
      <div className="composer-surface">
        {attachment ? (
          <AttachmentTray
            file={attachment}
            onRemove={() => setAttachment(null)}
          />
        ) : null}
        <div className="composer-input-row">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            rows={1}
            placeholder={mode === "reply" ? "Message" : "Add a private note"}
            aria-label={mode === "reply" ? "WhatsApp message" : "Private note"}
          />
          <button
            className="composer-send"
            type="button"
            aria-label={
              mode === "reply" ? "Send WhatsApp message" : "Save private note"
            }
            title={mode === "reply" ? "Send" : "Save private note"}
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {mode === "reply" ? <Send size={19} /> : <Lock size={18} />}
          </button>
        </div>
        <div className="composer-toolbar">
          {mode === "reply" ? (
            <>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/ogg,application/pdf,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const validationError = validateComposerAttachment(file);
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setAttachment(file);
                }}
              />
              <button
                type="button"
                aria-label="Attach file"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} />
              </button>
              <div className="composer-tool-popover">
                <button
                  type="button"
                  aria-label="Choose emoji"
                  title="Emoji"
                  aria-expanded={emojiOpen}
                  onClick={() => setEmojiOpen((value) => !value)}
                >
                  <Smile size={18} />
                </button>
                {emojiOpen ? (
                  <EmojiPicker
                    onSelect={insertEmoji}
                    onClose={() => setEmojiOpen(false)}
                  />
                ) : null}
              </div>
              <div className="composer-tool-popover">
                <button
                  type="button"
                  aria-label="Insert quick reply"
                  title="Quick replies"
                  aria-expanded={quickRepliesOpen}
                  onClick={() => setQuickRepliesOpen((value) => !value)}
                >
                  <Zap size={18} />
                </button>
                {quickRepliesOpen ? (
                  <CannedResponsePicker
                    api={api}
                    onSelect={insertQuickReply}
                    onClose={() => setQuickRepliesOpen(false)}
                  />
                ) : null}
              </div>
              {signature ? (
                <button
                  type="button"
                  aria-label={
                    signOutbound
                      ? `Signing as "${signature}" — click to send unsigned`
                      : `Not signing — click to sign as "${signature}"`
                  }
                  title={
                    signOutbound
                      ? `Signing as "${signature}"`
                      : `Sign as "${signature}"`
                  }
                  aria-pressed={signOutbound}
                  className={signOutbound ? "is-active" : ""}
                  onClick={() => setSignOutbound((value) => !value)}
                >
                  <SignatureIcon size={17} />
                </button>
              ) : null}
            </>
          ) : (
            <Lock size={16} aria-hidden="true" />
          )}
          <span className="composer-route">{helper}</span>
          {body ? (
            <button
              type="button"
              aria-label="Clear message"
              title="Clear"
              onClick={() => setBody("")}
            >
              <X size={17} />
            </button>
          ) : null}
        </div>
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}
        <span className="visually-hidden" aria-live="polite">
          {submitState === "sending" ? "Sending" : ""}
        </span>
      </div>
    </section>
  );
}
