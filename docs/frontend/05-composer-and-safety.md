# Composer And Safety

The composer is the highest-risk UI in the product. A mistaken external reply can
leak internal information into a client WhatsApp group. The UI must prevent that
by design.

## Composer Modes

There are two primary composers:

- External Reply: sends to WhatsApp through the outbox.
- Internal Note: saves inside ClarioDesk only.

They must be visually distinct:

```text
External Reply:
  green-tinted treatment
  Send to WhatsApp button
  destination group visible
  send-delay countdown

Internal Note:
  amber or slate-blue note treatment
  lock/private icon
  Save internal note button
  explicit "not sent to WhatsApp" label
```

Never use the same primary action copy, icon, or color for both.

## External Reply Requirements

External reply must show:

- Destination channel.
- Client/project mapping.
- Phone/transport route.
- Gateway/phone status.
- Quoted message preview if replying to a message.
- Attachment preview if present.
- Send-delay countdown after submit.
- Cancel button during delay.
- Policy block reason if blocked.

The frontend sends only to the API outbox. It never calls a gateway directly.

## Internal Note Requirements

Internal notes must show:

- Private label.
- Author.
- Optional linked message/ticket.
- Mentions.
- Attachment support where enabled.

Internal notes never enter outbox, gateway adapters, or WhatsApp transports.

## Risk States

Composer behavior by state:

```text
Unmapped:
  external reply disabled
  internal note allowed
  admin mapping action visible if permitted

Mixed:
  external reply allowed with warning
  ticket client selection required where relevant
  automation/SLA disabled by default

Phone disconnected:
  external reply disabled or queued only if policy allows
  diagnostic shown

Phone syncing:
  external reply allowed only if live route safe
  stale/backfill warning visible

Restricted phone:
  external reply disabled
  reason shown

Route unavailable:
  external reply disabled
  exact missing capability shown
```

## Send Delay

After send:

```text
Message queued
Sending in 3...
Cancel
```

The countdown should be visible in the composer and reflected in the timeline as
a pending outgoing message. Cancel should be reachable by mouse and keyboard.

Use "send delay", not "undo send". Once dispatched to WhatsApp, true undo is not
guaranteed.

## Attachments

Attachment picker should support:

- Document.
- Image.
- Video.
- Audio.
- Future: voice note.

Before send, show:

- File name.
- Type.
- Size.
- Client/project context.
- Cross-client risk state when implemented.

P3 asset protection should block or warn if a file from one client is being sent
to another client.

## Quick Replies And Templates

P2 quick replies:

- Plain text snippets.
- Scoped by workspace/team/client/category.
- Variables for client, ticket, agent, pending side.

P4 official templates:

- Separate from quick replies.
- Governed by official API approval status.
- Show language, category, cost, and approval state.

Do not mix official WhatsApp templates with internal quick replies in one generic
picker.

## Keyboard Behavior

Recommended:

- Enter sends when enabled.
- Shift+Enter inserts newline.
- Escape clears reply preview or closes menu.
- Cmd/Ctrl+K opens command menu.
- Tab order moves through attachment, emoji, composer, send/cancel.

Enter-to-send should be configurable or clearly taught, because accidental sends
are costly.

## Full-Product Growth

P1:

- Text reply.
- Internal note.
- Send delay.
- Quoted reply preview.
- Basic attachments/media.

P2:

- Quick replies.
- Failed-send retry.
- Mentions in notes.
- Handover-aware composer context.

P3:

- Draft approvals.
- AI suggested replies.
- Cross-client attachment blocking.
- Virtual-thread-targeted replies.
- Voice transcription before send.

P4:

- Official template governance.
- Compliance review.
- Enterprise approval policies.
- BYO AI controls for suggestions.
