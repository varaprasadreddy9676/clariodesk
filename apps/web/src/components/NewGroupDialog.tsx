import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ApiPhone } from "../api.js";
import { parseParticipantPhones } from "./new-conversation-utils.js";

export type NewGroupInput = {
  phoneInstanceId: string;
  title: string;
  participantPhoneNumbers: string[];
  initialMessage?: string;
};

export function NewGroupDialog({
  phones,
  onClose,
  onCreate,
}: {
  phones: ApiPhone[];
  onClose: () => void;
  onCreate: (input: NewGroupInput) => Promise<void>;
}) {
  const [phoneInstanceId, setPhoneInstanceId] = useState(phones[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const escape = (event: KeyboardEvent) =>
      event.key === "Escape" && !submitting && onClose();
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose, submitting]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const phoneNumbers = parseParticipantPhones(participants);
    if (!phoneNumbers.length) {
      setError("Add at least one valid international WhatsApp number");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        phoneInstanceId,
        title: title.trim(),
        participantPhoneNumbers: phoneNumbers,
        ...(message.trim() ? { initialMessage: message.trim() } : {}),
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create group",
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
        aria-labelledby="new-group-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <h2 id="new-group-title">New group</h2>
            <span>Create it directly in WhatsApp</span>
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
          Group name
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            required
          />
        </label>
        <label>
          Participants
          <textarea
            value={participants}
            onChange={(event) => setParticipants(event.target.value)}
            rows={3}
            required
            placeholder={"+919876543210\n+15551234567"}
          />
          <small>One number per line, including country code</small>
        </label>
        <label>
          First message <em>Optional</em>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Welcome to the group"
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
            disabled={submitting || !title.trim() || !phoneInstanceId}
          >
            {submitting ? "Creating..." : "Create group"}
          </button>
        </footer>
      </form>
    </div>
  );
}
