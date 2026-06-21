# Frontend Product Principles

ClarioDesk is a customer support desk for WhatsApp groups. The frontend must make
structured support operations feel as approachable as chat, while keeping safety,
ownership, tickets, permissions, auditability, and scale visible where they matter.

## Experience Promise

The product should feel like:

- WhatsApp for reading and replying.
- A shared support inbox for ownership and visibility.
- A helpdesk for tickets and accountability.
- An operations console for risk, permissions, and audit.
- A modern enterprise product for density, consistency, and trust.

The main rule is:

```text
No customer issue should be lost inside a WhatsApp group again.
```

Users should never feel they are filling a CRM before they can answer a client. The
conversation is the center of gravity; tickets, notes, assignments, mappings, media,
and analytics orbit around it.

The v1 experience must focus on the support loop:

```text
Open customer group -> understand context -> reply safely or add note -> create/link
ticket -> assign owner -> track status -> preserve audit.
```

## Design Bar

The UI must feel enterprise-grade and modern without becoming decorative.

Use:

- Dense, scannable layouts.
- Calm neutral surfaces.
- Precise spacing and alignment.
- Minimal shadows.
- Clear state language.
- Strong focus and keyboard behavior.
- Fast perceived performance.
- Real empty/error/loading states.

Avoid:

- Purple/blue AI-product gradients.
- Marketing-page hero layouts inside the app.
- Oversized cards and padding.
- Decorative blobs, bokeh, glass, or ornamental gradients.
- Hidden critical actions.
- Ambiguous destructive or outbound actions.
- Generic CRM metaphors when a WhatsApp/group metaphor is clearer.

## Product Personality

ClarioDesk should feel:

- Calm under pressure.
- Operationally serious.
- Direct and readable.
- Warm enough for chat, but not playful.
- Transparent about risk.
- Reliable for daily repeated use.

Copy should be short and concrete. Prefer "Message will send in 3 seconds" over
"Your communication is being processed."

## Safety Principles

Safety is a UI feature, not just backend policy.

Every external send must make these facts visible:

- Destination group/channel.
- Client/project mapping.
- Transport route.
- Phone/gateway status.
- Whether the message is delayed, queued, sent, failed, or cancelled.

Internal notes must be visually impossible to confuse with WhatsApp replies. The
composer must never use the same color treatment, icon, placeholder, or send button
for internal notes and external replies.

For mixed, unmapped, degraded, restricted, or syncing channels, the UI must explain
what is unsafe and what the user can still do.

## Complexity Strategy

The full product is large, but the UI should reveal complexity progressively:

```text
Default view: read and reply.
When needed: add note, ticket, assign, map, search.
When risky: expose policy, diagnostics, and confirmation.
When advanced: show automation, AI, analytics, compliance.
```

Do not put every feature on the primary screen. Put the next useful action in the
right place.

## AI-Native Principle

AI should be present wherever it reduces operator effort: catching up on a group,
drafting a reply, summarizing a ticket, transcribing media, detecting sensitive
data, explaining urgency, finding work, or preparing a handover. It should not feel
like a separate chatbot bolted onto the side of the product.

AI UI must be:

- Contextual.
- Suggestive by default.
- Editable and rejectable.
- Source-scoped.
- Permission-aware.
- Budget-aware.
- Auditable.
- Safe when provider keys are missing or exhausted.

The app must show useful non-AI fallbacks for every AI surface. A disconnected or
unconfigured model provider should degrade like any other service dependency, not
make the core inbox unusable.

## Reference Product Lessons

From WhatsApp:

- Familiar timeline scanning.
- Clear incoming/outgoing direction.
- Lightweight reply previews.
- Media-first message rendering.

From Frappe CRM:

- Record-level activity tabs.
- Resizable right context panel.
- Saved/pinned views.
- Strong list/table patterns.
- Mobile-specific record views.

From Evo CRM:

- Chat component decomposition.
- WebSocket status.
- Reply vs note mode.
- Channel diagnostics.
- Assignment and filter patterns.

ClarioDesk should adapt these patterns to customer WhatsApp group support. It should
not become a sales CRM, marketing platform, or generic automation builder before the
core WhatsApp group support workflow is excellent.

## Definition Of Excellent

The frontend is excellent when:

- A new user can connect a phone and map a group without documentation.
- An agent can reply safely without thinking about transport internals.
- An internal note cannot be accidentally sent externally.
- Permission boundaries are visible and enforced without confusing users.
- A degraded phone or failed webhook is obvious and actionable.
- AI suggestions are useful but never confuse users about what is human-authored,
  externally sent, internally noted, or policy-blocked.
- The same app works at 320px, 768px, 1024px, and 1440px.
- Loading, empty, error, permission, offline, and syncing states feel designed.
- Repeated daily use feels faster than using WhatsApp directly.
