import { Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ApiContactSummary, ApiPhone } from "../api.js";
import { AttachmentTray } from "./AttachmentTray.js";
import { normalizePhoneInput } from "./new-conversation-utils.js";
import { validateComposerAttachment } from "./composer-utils.js";

export type NewChatInput = {
  phoneInstanceId: string;
  phoneNumber: string;
  initialMessage: string;
  attachment?: File;
};

export function NewChatDialog({
  phones,
  onClose,
  onCreate,
  onSearchContacts,
}: {
  phones: ApiPhone[];
  onClose: () => void;
  onCreate: (input: NewChatInput) => Promise<void>;
  onSearchContacts: (query: string) => Promise<ApiContactSummary[]>;
}) {
  const [phoneInstanceId, setPhoneInstanceId] = useState(phones[0]?.id ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ApiContactSummary[]>([]);
  const [selectedContact, setSelectedContact] =
    useState<ApiContactSummary | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose, submitting]);

  useEffect(() => {
    const trimmed = contactQuery.trim();
    if (!trimmed) {
      setContactResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await onSearchContacts(trimmed);
        if (!cancelled) setContactResults(results);
      } catch {
        if (!cancelled) setContactResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contactQuery, onSearchContacts]);

  function pickContact(contact: ApiContactSummary) {
    setSelectedContact(contact);
    setPhoneNumber(contact.primaryPhone);
    setContactQuery("");
    setContactResults([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizePhoneInput(phoneNumber);
    if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
      setError("Enter a valid international number, for example +919876543210");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        phoneInstanceId,
        phoneNumber: normalized,
        initialMessage: message.trim(),
        ...(attachment ? { attachment } : {}),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create chat",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !submitting && onClose()
      }
    >
      <form
        className="conversation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <h2 id="new-chat-title">New chat</h2>
            <span>Send the first WhatsApp message</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {phones.length > 1 ? (
          <label>
            Phone route
            <select
              value={phoneInstanceId}
              onChange={(event) => setPhoneInstanceId(event.target.value)}
            >
              {phones.map((phone) => (
                <option key={phone.id} value={phone.id}>
                  {phone.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Find a contact
          <input
            ref={firstInputRef}
            value={contactQuery}
            onChange={(event) => setContactQuery(event.target.value)}
            placeholder="Search by name or number"
          />
        </label>
        {contactResults.length > 0 ? (
          <ul className="contact-picker-results" role="listbox">
            {contactResults.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedContact?.id === contact.id}
                  onClick={() => pickContact(contact)}
                >
                  <strong>{contact.canonicalName}</strong>
                  <span>{contact.primaryPhone}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selectedContact ? (
          <div className="contact-picker-selected">
            Starting chat with <strong>{selectedContact.canonicalName}</strong>{" "}
            ({selectedContact.primaryPhone})
            <button
              type="button"
              onClick={() => {
                setSelectedContact(null);
                setPhoneNumber("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <label>
            WhatsApp number
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+919876543210"
              inputMode="tel"
              required
            />
          </label>
        )}
        <label>
          First message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            required
            placeholder="Type the first message"
          />
        </label>
        {attachment ? (
          <AttachmentTray
            file={attachment}
            onRemove={() => setAttachment(null)}
          />
        ) : null}
        <label className="dialog-file-button">
          <Paperclip size={16} />
          Attach file
          <input
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/ogg,application/pdf,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const validationError = validateComposerAttachment(file);
              if (validationError) setError(validationError);
              else {
                setAttachment(file);
                setError(null);
              }
            }}
          />
        </label>
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-action"
            type="submit"
            disabled={submitting || !message.trim() || !phoneInstanceId}
          >
            {submitting ? "Creating..." : "Start chat"}
          </button>
        </footer>
      </form>
    </div>
  );
}
