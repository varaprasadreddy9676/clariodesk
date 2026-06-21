# Design System

The ClarioDesk design system should support high-density enterprise workflows while
keeping chat interactions simple and familiar. It must not look like a generic AI
dashboard.

## Visual Direction

Keywords:

```text
calm
precise
dense
trustworthy
modern
chat-native
enterprise-grade
```

The product should use restrained surfaces, crisp typography, and semantic state
colors. Visual drama belongs only to risk, not decoration.

## Color Strategy

Use semantic tokens, not raw colors in components.

Recommended palette direction:

```text
Base:
  canvas
  surface
  surface-raised
  surface-muted
  border
  border-strong

Text:
  text-primary
  text-secondary
  text-muted
  text-inverse

Brand:
  brand
  brand-hover
  brand-subtle
  brand-border

Semantic:
  success
  warning
  danger
  info
  neutral

AI:
  ai-available
  ai-generating
  ai-review
  ai-disabled
  ai-policy-blocked
  ai-cost-warning

Chat:
  message-inbound
  message-outbound
  message-note
  message-system
  message-deleted
```

Suggested color personality:

- Brand: deep teal or green-blue, connected to WhatsApp familiarity without copying it.
- Inbound messages: neutral/white.
- External outgoing replies: soft green tint.
- Internal notes: warm amber or muted slate-blue, clearly distinct from outgoing replies.
- System events: quiet gray.
- Risk states: red/orange only when there is real operational risk.
- AI available: subtle teal/green-blue accent, never a separate purple theme.
- AI review needed: amber with clear text and action.
- AI disabled/no-provider: neutral gray with setup or fallback action.

Avoid:

- Purple/indigo as dominant brand.
- Large gradients.
- One-note green everywhere.
- Color as the only state indicator.
- Decorative dark-mode-only aesthetic.

## Message Color Rules

Messages are the most important visual language in the app.

```text
Inbound client message:
  neutral surface
  clear sender name
  normal border

Dashboard external reply:
  subtle green-tinted surface
  delivery status visible
  sent-by agent visible where useful

Internal note:
  distinct note color
  lock/private icon
  "Internal note" label
  never reuses external reply send button treatment

Ghost-agent / external-device reply:
  separate badge: External device
  not styled as dashboard agent reply

System event:
  compact centered or inline gray row
  no bubble unless it carries detailed content

Deleted-on-WhatsApp:
  muted message shell
  explicit deleted text
```

## Typography

Recommended fonts:

- Primary: Inter, Geist Sans, or a similarly neutral enterprise UI font.
- Mono: Geist Mono, JetBrains Mono, or system mono for IDs, payload snippets, and logs.

Type hierarchy:

```text
Page title: 20-24px / semibold
Panel title: 15-17px / semibold
Section label: 12-13px / medium
Body: 14px
Dense list: 13px
Metadata: 12px
Tiny timestamp/counter: 11px
```

Rules:

- Do not scale fonts with viewport width.
- Do not use negative letter spacing.
- Use compact headings inside panels.
- Reserve large type for page-level titles only.

## Spacing

Use a 4px scale.

```text
2px  micro alignment only
4px  icon/text gap
8px  compact control padding
12px standard gap
16px panel padding
20px spacious panel padding
24px page section gap
```

Operator screens should be dense but breathable. Avoid 32px+ padding except on
empty states, onboarding, and narrow marketing-free setup screens.

## Radius And Borders

Use modest radii:

```text
4px  small controls, badges
6px  inputs, buttons, message bubbles
8px  panels, popovers, modals
12px rare: large drawers or onboarding panels
```

Cards inside cards are not allowed. Page sections should not be decorative cards.
Use cards only for repeated records, modals, popovers, and specific framed tools.

## Shadows

Prefer borders and surface contrast. Use shadows sparingly:

- Popovers.
- Modals.
- Floating composer on mobile.
- Drag previews.

Do not use shadow-heavy card grids.

## Icons

Use lucide icons where possible.

Common icon mapping:

```text
send: Send
internal note: Lock or StickyNote
ticket: Ticket
channel/group: MessagesSquare or Users
phone: Smartphone
syncing: RefreshCw
warning: TriangleAlert
restricted: ShieldAlert
search: Search
filter: SlidersHorizontal
assignment: UserPlus
private: Lock
media: Paperclip
download: Download
retry: RotateCw
cancel: X
```

Icon-only buttons need accessible labels and tooltips.

## Component Primitives

Core primitives:

```text
Button
IconButton
Input
Textarea
Select
Combobox
Checkbox
Switch
Tabs
SegmentedControl
Badge
StatusBadge
Tooltip
Popover
Menu
Modal
Drawer
Toast
Skeleton
EmptyState
ErrorState
Banner
InlineAlert
Avatar
UserStack
Table
VirtualList
ResizablePanel
CommandMenu
```

Domain components:

```text
AppShell
Sidebar
ChannelList
ChannelListItem
InboxHeader
PhoneStatusBadge
GatewayDiagnosticBanner
Timeline
MessageBubble
MessageMedia
MessageReplyPreview
MessageStatus
TimelineMarker
ExternalReplyComposer
InternalNoteComposer
SendDelayCountdown
TicketPanel
MappingPanel
ParticipantList
SearchResultRow
PermissionGate
```

## States

Every component with remote data needs:

- Loading.
- Empty.
- Error.
- Permission denied.
- Offline/reconnecting where relevant.
- Stale/syncing where relevant.

Use skeletons for content loading. Use spinners only for small inline actions.

## Motion

Motion should be fast and functional:

```text
100-150ms: hover/focus/control state
150-200ms: menu/popover
200-250ms: drawer/panel
```

Avoid long, bouncy, decorative animation. Respect reduced-motion settings.

## Accessibility Requirements

Minimum:

- WCAG 2.1 AA contrast.
- Full keyboard navigation.
- Visible focus ring.
- Semantic buttons/links.
- Labels for every input.
- ARIA labels for icon-only controls.
- Focus trap in modal/drawer.
- Escape closes popovers/modals where appropriate.
- Screen-reader text for critical status changes.

Message timeline should support keyboard movement between messages and actions.

## Internationalization

Design for:

- UTF-8 messages.
- Emoji.
- Long names.
- Right-to-left text in message bubbles.
- Workspace/user timezone display.
- Future UI translation.

Do not hard-code layout assumptions based on English text length.

## AI Components

AI UI should reuse shared primitives:

- `AiStatusBadge`.
- `AiGenerationSkeleton`.
- `AiSuggestionPanel`.
- `AiSourceScope`.
- `AiCostHint`.
- `AiReviewActions`.
- `AiPolicyBlockedState`.
- `ProviderHealthBadge`.

AI loading should usually be a small inline skeleton or queued state. Do not block
the inbox, composer, ticket panel, or timeline while a model response is pending.

AI suggestions must be visually distinct from saved human content until accepted or
edited. Suggested external replies should enter the composer as drafts and keep a
link to the source suggestion for audit.

## Design QA Checklist

Before accepting a screen:

- It works at 320px, 768px, 1024px, 1440px.
- Text does not overflow buttons, badges, or panels.
- There is no purple-gradient AI aesthetic.
- Loading, empty, error, permission, and offline states exist.
- AI disabled, no-provider, budget-exceeded, and policy-blocked states exist where
  AI features are exposed.
- External reply and internal note are impossible to confuse.
- Risk states include icon + text, not just color.
- Keyboard-only use is possible.
- All icons have labels/tooltips where needed.
- The screen remains useful with realistic long client/channel names.
