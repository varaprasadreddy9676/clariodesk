# Component Architecture

Frontend code should be organized around product domains and shared primitives.
Components must be small, composable, and testable.

## Directory Shape

Recommended app structure:

```text
apps/web/src/
  app/
    routes/
    providers/
    app-shell/
  components/
    primitives/
    feedback/
    layout/
    data-display/
  domains/
    auth/
    ai/
    clients/
    channels/
    composer/
    contacts/
    media/
    messages/
    notes/
    phones/
    notifications/
    pwa/
    search/
    team/
    tickets/
    realtime/
    settings/
  lib/
    api/
    query/
    realtime/
    permissions/
    dates/
    formatting/
    storage/
    ai-policy/
  styles/
    tokens.css
    globals.css
```

Domain folders should colocate:

```text
components/
hooks/
api.ts
types.ts
utils.ts
*.test.tsx
*.stories.tsx where useful
```

## Component Rules

Prefer composition:

```tsx
<Panel>
  <PanelHeader />
  <PanelBody />
</Panel>
```

Avoid over-configured components with dozens of props.

Keep components focused:

- UI primitive: visual and accessibility behavior.
- Domain component: one product concept.
- Container: data fetching and orchestration.
- Hook: reusable stateful behavior.

Avoid components over 200 lines. Split by responsibility.

## Data Boundaries

Separate server state from UI state:

```text
Server state:
  React Query/SWR cache
  API response types
  realtime invalidation

URL state:
  selected channel
  filters
  search query
  ticket view

Local state:
  open menu
  composer draft
  hover/focus state
  active tab inside current panel

Global client state:
  auth/session
  theme
  workspace
  sidebar collapse
  realtime connection
```

## AI Domain Boundary

AI should have a dedicated frontend domain so provider settings, suggestions, audit,
and shared AI states do not leak into every feature module.

Recommended split:

```text
domains/ai/
  components/
    AiStatusBadge.tsx
    AiSuggestionPanel.tsx
    AiSourceScope.tsx
    AiPolicyBlockedState.tsx
    ProviderHealthBadge.tsx
  hooks/
    useAiFeaturePolicy.ts
    useAiSuggestion.ts
    useProviderHealth.ts
  api.ts
  types.ts
```

Product domains such as composer, messages, tickets, and search can consume the AI
domain, but should not call model/provider APIs directly.

Do not put server data into a global client store unless there is a strong reason.

## API Clients

Each domain should own a typed API client:

```text
channels/api.ts
messages/api.ts
tickets/api.ts
outbox/api.ts
phones/api.ts
search/api.ts
notifications/api.ts
push/api.ts
```

API clients should:

- Return typed data.
- Normalize error shapes.
- Avoid UI concerns.
- Use request IDs where available.
- Support abort signals for search/pagination.

## Realtime Pattern

Realtime events should not replace server fetching. They should update or invalidate
the smallest relevant query.

Examples:

```text
message.received -> append to active channel or invalidate channel timeline
outbox.status_changed -> update outbox/message status
ticket.updated -> update ticket detail + ticket list
phone.status_changed -> update phone badge + diagnostics
channel.mapped -> update channel list + context panel
notification.created -> update notification center + tab badge
```

## Notification And PWA Domain Boundary

Notification UI should be separate from realtime transport code.

Recommended split:

```text
domains/notifications/
  components/
    NotificationBell.tsx
    NotificationPanel.tsx
    NotificationRow.tsx
    NotificationPreferenceForm.tsx
    QuietHoursEditor.tsx
  hooks/
    useNotifications.ts
    useNotificationPreferences.ts
  api.ts
  types.ts

domains/pwa/
  components/
    PushSetupPanel.tsx
    DeviceSubscriptionList.tsx
    TestNotificationButton.tsx
    NotificationPrivacySelector.tsx
  hooks/
    useServiceWorkerRegistration.ts
    usePushSubscription.ts
    useAppBadge.ts
  service-worker/
    push-handler.ts
    notification-click-handler.ts
```

The service worker should only handle push payload display, notification click/action
handling, app badging, and narrow push action endpoints. It should not contain broad
product state or gateway logic.

## Message Component Family

Message rendering should be split:

```text
MessageRow
MessageBubble
MessageHeader
MessageBody
MessageFooter
MessageText
MessageImage
MessageVideo
MessageAudio
MessageDocument
MessageReaction
MessageLocation
MessageSystem
MessageDeleted
MessageReplyPreview
MessageStatus
TimelineMarker
```

All message components consume normalized message data. They must never inspect raw
gateway payloads.

## Composer State Machines

External reply and internal note should use separate state machines.

External reply states:

```text
idle
drafting
validating
waiting_delay
queued
sending
sent
failed
cancelled
policy_blocked
```

Internal note states:

```text
idle
drafting
saving
saved
failed
```

The UI should not share one generic "send" abstraction for both.

## Testing Strategy

Test at three levels:

- Unit: formatting, permission helpers, state machines.
- Component: message variants, composer states, empty/error/loading states.
- Flow: login, phone connection, channel mapping, reply, note, ticket, search.

Use Storybook or equivalent for:

- Message variants.
- Composer states.
- Badges.
- Empty/error/loading states.
- Mobile drawers.
- Diagnostic banners.

## Performance Rules

- Virtualize long message timelines.
- Paginate channel timelines by cursor.
- Avoid rendering hidden panels with heavy lists.
- Lazy-load admin/settings/analytics surfaces.
- Memoize expensive message formatting.
- Use image/video dimensions to avoid layout shift.
- Keep realtime updates targeted.

## Implementation Guardrails

- No arbitrary hex values inside components.
- No inline styles except dynamic sizing variables that cannot be tokenized.
- No raw HTML rendering unless sanitized through the approved utility.
- No direct gateway calls from frontend.
- No action-only color semantics; pair color with icon/text.
- No global data refetch on every realtime event.
