import { Smartphone } from "lucide-react";
import { EmptyState } from "../components/States.js";

export function SetupEmpty({ onGoPhones }: { onGoPhones: () => void }) {
  return (
    <section className="page-panel center-panel">
      <EmptyState
        icon={Smartphone}
        title="No WhatsApp chats yet"
        body="Connect a phone to start syncing your WhatsApp conversations."
        hint="Takes about 1–2 minutes"
        action={
          <button className="primary-action" type="button" onClick={onGoPhones}>
            Set up a phone
          </button>
        }
      />
    </section>
  );
}
