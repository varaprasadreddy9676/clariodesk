# Message Rendering

Message rendering must be accurate, safe, fast, and familiar. The timeline is the
center of the product.

## Message Types

Support these as first-class variants:

- Text.
- Image.
- Video.
- Audio.
- Document.
- Sticker.
- Reaction.
- Location.
- Contact card.
- Poll.
- System.
- Deleted.
- Unknown.

Unknown messages should still render as a clear placeholder with raw details hidden
from normal users.

## Bubble Anatomy

Each message row may include:

- Sender identity.
- Direction.
- Body/media.
- Reply preview.
- Timestamp.
- Delivery status.
- Ticket badges.
- Suppression/backfill flags where relevant.
- Actions menu.

Keep the default bubble compact. Put secondary details in hover/focus actions or
the context panel.

## Timeline Markers

System markers are required for:

- Date boundaries.
- Backfill boundary.
- Mapping changes.
- Group rename/metadata changes.
- Ticket created/linked.
- Assignment changed.
- Phone disconnected/reconnected.
- Retention/deletion states.

Markers should be visually quieter than messages but still scannable.

## Message Formatting

WhatsApp-style formatting:

- Bold.
- Italic.
- Strikethrough.
- Inline code.
- Code block.
- Quote.
- Basic list rendering.

Implementation must parse and sanitize. Never inject raw gateway HTML.

## Media

Media preview behavior:

- Images: thumbnail with click-to-preview.
- Videos: poster/thumbnail and controlled playback.
- Audio: compact player.
- Documents: file card with type, size, and download.
- Missing/expired media: clear unavailable state.
- Backfill media pending: lazy-download state.

Signed URLs must be requested only after permission checks.

## Delivery States

Outgoing states:

- Pending.
- Waiting delay.
- Queued.
- Sending.
- Sent.
- Delivered.
- Read.
- Failed.
- Cancelled.
- Policy blocked.

State should include icon + label/tooltip, not color alone.

## Actions

P1 actions:

- Reply.
- Create ticket.
- Link to ticket.
- Add internal note.
- Copy text.
- Download media.

P2 actions:

- React where gateway supports.
- Retry failed send.
- Pin message.
- Mark important.
- Add label.

P3 actions:

- Start virtual thread.
- Summarize around message.
- Create incident.
- Flag sensitive media.

P4 actions:

- Compliance hold.
- Export audit bundle.
- Enterprise review workflow.

## Accessibility

Message rows must be keyboard reachable. Action menus must be usable without a
mouse. Time/status information should be available as accessible text.

For screen readers, avoid reading every decorative detail. Provide meaningful row
labels like:

```text
Incoming message from Meera, 10:42 AM, linked to ticket T-102.
```

## Performance

- Virtualize long timelines.
- Avoid layout shift by reserving media dimensions.
- Memoize formatting.
- Append live messages without re-rendering the full timeline.
- Keep message action menus lazy.

## Full-Product Growth

P1:

- Core message variants.
- Media previews.
- Reply previews.
- Delivery status.
- Backfill/deleted markers.

P2:

- Better filters.
- Reactions.
- Richer failed media states.
- Message pins.

P3:

- Virtual threading.
- AI summaries.
- Storm bundles.
- Sensitive-data indicators.

P4:

- Compliance annotations.
- Data residency/export indicators.
- Enterprise audit evidence views.
