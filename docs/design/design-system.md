# ClarioDesk Design System

ClarioDesk is a **self-hosted WhatsApp team inbox** designed for teams to reply collaboratively, track conversations, manage ownership, and close tickets without giving up control of their data.

The UI should therefore feel:

**Calm · Fast · Familiar · Trustworthy · Premium · Operational**

The visual direction should be **Apple-inspired, not Apple-copied**: strong typography, generous whitespace, restrained color, subtle depth, excellent alignment, and interfaces that disappear behind the task.

---

# 1. Design philosophy

## 1.1 Quiet by default

ClarioDesk is an operational tool. Users may keep it open for 8+ hours.

Avoid:
* excessive gradients
* strong borders everywhere
* overly saturated colors
* heavy shadows
* decorative illustrations on working screens
* too many badges

Prefer:
* whitespace
* hierarchy
* subtle surfaces
* muted secondary text
* color only when it communicates meaning

## 1.2 Content before chrome

Conversation content should always dominate the UI. Navigation and controls should feel almost invisible until needed.

**Bad:** `[ BIG SIDEBAR ] [ BIG TOOLBAR ] [ BIG FILTER BAR ] Conversation`

**Preferred:** `Sidebar → Conversations → Messages`

## 1.3 Familiar WhatsApp interaction model

ClarioDesk intentionally provides a WhatsApp-native experience, including shared chats, groups, attachments, reactions, assignment, internal notes, and real-time updates. Keep familiar messaging patterns while making the surrounding workspace feel more professional.

---

# 2. Brand personality

ClarioDesk should feel like:

> **WhatsApp simplicity + Linear precision + Apple polish**

Not like: a traditional CRM, an admin dashboard, enterprise ERP software, a social-media app, or a WhatsApp clone.

The product should feel like a **modern communication workspace**.

---

# 3. Core visual language

Use four visual layers.

- **Layer 0 — Canvas** (application background): `#F5F5F7`
- **Layer 1 — Primary surface** (main panels): `#FFFFFF`
- **Layer 2 — Secondary surface** (hover states, filters, toolbars): `#F7F7F8`
- **Layer 3 — Elevated surface** (menus, popovers, dialogs): `rgba(255,255,255,.92)` with `backdrop-filter: blur(20px)`

---

# 4. Color system

## Primary brand

Use green sparingly.

| Token | Value | Usage |
|---|---|---|
| `brand-500` | `#17B26A` | Main actions |
| `brand-600` | `#079455` | Hover |
| `brand-700` | `#067647` | Pressed |
| `brand-100` | `#DDF8EA` | Selected backgrounds |
| `brand-50` | `#EFFCF5` | Soft highlights |

Primary CTA example: "Set up a phone" — background `#17B26A`.

---

# 5. Neutral colors

The majority of the application should use neutral colors.

```css
--gray-950: #101828;
--gray-900: #1D2939;
--gray-700: #344054;
--gray-600: #475467;
--gray-500: #667085;
--gray-400: #98A2B3;
--gray-300: #D0D5DD;
--gray-200: #EAECF0;
--gray-100: #F2F4F7;
--gray-50:  #F9FAFB;
```

- Primary text: `#101828`
- Secondary text: `#475467`
- Muted text: `#667085`
- Hairline border: `#EAECF0`

---

# 6. Semantic colors

Color must communicate state.

- Success: `#12B76A`
- Warning: `#F79009`
- Error: `#F04438`
- Information: `#2E90FA`

Never use semantic colors simply for decoration. Example: `● Connected` / `● Reconnecting` / `● Disconnected`.

---

# 7. Typography

Preferred: **Inter**

```css
font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "Segoe UI",
  sans-serif;
```

## Type scale

| Style | Size/Line-height | Weight | Notes |
|---|---|---|---|
| Display | 32px / 40px | 650 | Used rarely |
| Page heading | 24px / 32px | 650, letter-spacing -0.4px | e.g. "WhatsApp" |
| Section heading | 18px / 26px | 600 | |
| Card heading | 16px / 24px | 600 | |
| Body | 14px / 20px | 400 | |
| Secondary text | 13px / 18px | 400 | |
| Caption | 12px / 16px | 450 | |

Avoid excessive bold text. Hierarchy should come primarily from: 1) size, 2) spacing, 3) color, 4) weight.

---

# 8. Spacing system

Use a **4px base grid**: `4 8 12 16 20 24 32 40 48 64`

| Context | Spacing |
|---|---:|
| Icon → label | 8px |
| Label → secondary text | 4px |
| Controls inside toolbar | 8px |
| Card internal padding | 20–24px |
| Panel padding | 24–32px |
| Page horizontal padding | 32px |
| Major section gap | 32–40px |

Avoid random spacing such as 13px, 19px, 27px.

---

# 9. Border radius

Apple-inspired does **not** mean making everything extremely round.

```css
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;
```

- Buttons: 10px
- Inputs: 10px
- Cards: 14–16px
- Modals: 20px
- Status badges: 999px

---

# 10. Borders

Prefer **hairline borders** over visible containers.

```css
border: 1px solid rgba(16,24,40,.07);
```

Selected surfaces: `border-color: rgba(23,178,106,.18);`

Do not place borders around every UI element.

---

# 11. Shadows

Shadows should almost disappear.

- **Card:** `0 1px 2px rgba(16,24,40,.03), 0 4px 12px rgba(16,24,40,.04)`
- **Floating surface:** `0 8px 30px rgba(16,24,40,.10)`
- **Modal:** `0 24px 60px rgba(16,24,40,.16)`

Avoid heavy black shadows.

---

# 12. Application shell

```text
┌────────┬─────────────────────────────────────┬────────┐
│        │ Header                              │        │
│        ├─────────────────────────────────────┤        │
│ Main   │                                     │Quick   │
│ Nav    │             Workspace               │Tools   │
│        │                                     │        │
└────────┴─────────────────────────────────────┴────────┘
```

- Main navigation: 72px (expanded: 220–240px)
- Utility rail: 56–64px, must not visually compete with the workspace

---

# 13. Left navigation

- Icons: 20–22px
- Navigation target: 44×44px
- Active item: `background: #EFFCF5; color: #079455; border-radius: 12px;`
- Inactive: `color: #475467;`
- Hover: `background: #F2F4F7;`

Use tooltips for icon-only navigation.

---

# 14. Header

The header should communicate only: **Where am I?** and **What requires attention?**

```text
WhatsApp                            [↻] [🔔] [● Reconnecting]
Sync and manage your WhatsApp conversations.
```

Avoid placing large statistics directly inside the primary navigation bar.

---

# 15. Metric cards

For Phones / Waiting / Failed sends:

- Desktop: height 112–128px, radius 16px, padding 20px
- Structure: `[ icon ]  Phones` / `0`
- Use very soft semantic backgrounds around icons, e.g. `background: #EFFCF5;`
- Do not turn the full card green/red/blue

---

# 16. Buttons

**Primary** — use only for the strongest action (Set up a phone, Send, Create ticket, Assign):

```css
height: 40px;
padding: 0 16px;
border-radius: 10px;
font-weight: 600;
background: #17B26A;
color: white;
/* hover: background: #079455; */
```

**Secondary:**
```css
background: white;
border: 1px solid #EAECF0;
color: #344054;
```

**Tertiary:** No container until hovered (Cancel, View details, More).

**Destructive:** Use red only when destructive intent is clear (Delete phone, Remove agent, Delete conversation).

---

# 17. Icon buttons

- Standard: 36×36px, Large: 40×40px
- Icon: 18–20px
- Radius: 10px
- Never use unexplained icons without a tooltip

---

# 18. Status badges

- Height: 28–30px, padding 10–12px horizontal
- Reconnecting: `background: #FFFAEB; color: #B54708;`
- Connected: `background: #ECFDF3; color: #067647;`
- Failed: `background: #FEF3F2; color: #B42318;`

---

# 19. Empty states

```text
       Illustration
 No WhatsApp chats yet
Connect a phone to start syncing
your WhatsApp conversations.
     [ Set up a phone ]
    ◷ Takes about 1–2 minutes
```

- Illustration: 160–220px
- Headline: 20–24px
- Description max width: 420px
- CTA should be visible immediately
- Avoid enormous empty cards purely to fill the screen

---

# 20. Inbox layout

Three-column architecture, built around shared WhatsApp chats, assignment, internal notes, private replies, and tickets:

```text
┌─────────────┬────────────────────────────┬─────────────────┐
│Conversation │         Messages           │ Contact /       │
│List         │                            │ Ticket Context  │
└─────────────┴────────────────────────────┴─────────────────┘
```

Widths: Conversation list 320–360px, message area flexible, context panel 300–340px.

---

# 21. Conversation row

```text
[Avatar]  Acme Support                  10:42
          Can you please check this?      2
          ● Assigned to Sai
```

- Height: 68–76px
- Selected: `background: #F2F4F7;`
- Unread: stronger name, small green indicator, unread count
- Avoid WhatsApp's bright-green full-row selection

---

# 22. Message bubbles

- **Incoming:** `background: #F2F4F7; color: #101828;`
- **Outgoing:** `background: #E7F8EF; color: #101828;`
- Max width: 65–70%
- Radius: 16px
- Timestamp: 11px, `#667085`
- Do not use saturated WhatsApp green for entire outgoing messages

---

# 23. Internal notes

Must be immediately distinguishable from customer messages.

```css
background: #FFFAEB;
border: 1px solid #FEDF89;
```

Label: "Internal note". Never rely on color alone — add an icon (🔒 Internal note).

---

# 24. Ticket UI

States: `Open · In progress · Waiting · Resolved · Closed`

Prefer compact chips over large colored boxes:
```text
#1042  Payment not received
High · Open · Sai
```

---

# 25. Composer

```text
┌──────────────────────────────────────────────┐
│ Write a reply…                               │
│ 📎  🙂                           [ Send ↑ ]   │
└──────────────────────────────────────────────┘
```

- Height: 48px minimum, expandable up to 160px
- Enter = Send, Shift+Enter = new line
- Internal-note mode should visually transform the composer

---

# 26. Search

- Placeholder: "Search conversations…"
- Keyboard shortcut: ⌘K
- Command palette: search conversation, go to inbox, create ticket, assign conversation, open settings, connect phone

---

# 27. Forms

- Input height: 40px
- Text area: 96px minimum
- Label: 13px/18px, weight 500
- Input radius: 10px
- Border: `#D0D5DD`
- Focus: `box-shadow: 0 0 0 3px rgba(23,178,106,.12); border-color: #17B26A;`

---

# 28. Tables

Use tables only for structured administrative data: team members, connected phones, audit events, broadcasts, integrations.

- Row height: 52px
- Header: `background: #F9FAFB;`
- Avoid strong grid lines — use horizontal separators

---

# 29. Dialogs

- Small: 420px, Standard: 520px, Large: 720px
- Radius: 20px
- Overlay: `rgba(16,24,40,.35)`, blur 4–8px

---

# 30. Toasts

- Position: bottom-right
- Examples: "✓ Conversation assigned", "⚠ Phone disconnected", "✕ Message failed"
- Maximum 3 visible
- Auto-dismiss normal messages; persistent for errors requiring action

---

# 31. Loading states

Prefer skeletons over spinners. Use spinners only for: button operations, authentication, short blocking operations. Conversation lists should skeleton-load.

---

# 32. Motion

Motion should communicate relationships, not decorate the UI.

- Standard: 150ms
- Panel: 200–250ms
- Modal: 220ms
- Easing: `cubic-bezier(.2,.8,.2,1)`
- hover → 120ms, menu open → 160ms, panel slide → 220ms

Avoid bouncing animations.

---

# 33. Accessibility

- Minimum contrast: WCAG AA
- Interactive target: 44×44px preferred
- Keyboard support required for: navigation, conversation switching, search, reply, assignment, ticket actions, dialogs
- Never communicate state using only color

---

# 34. Dark mode

```css
--bg: #101214;
--surface-1: #17191C;
--surface-2: #1D2024;
--surface-3: #25282D;
--text-primary: #F5F5F7;
--text-secondary: #B8BCC4;
--border: rgba(255,255,255,.08);
```

Do not simply invert the light theme. Reduce shadows and rely more on surface separation.

---

# 35. Responsive behaviour

- **Desktop** (≥1200px): three-column inbox
- **Tablet** (768–1199px): hide context panel until requested
- **Mobile** (<768px): bottom navigation; flow is Inbox → Conversation → Contact/ticket sheet

ClarioDesk is designed to be mobile-responsive and installable as a PWA, so mobile interactions should be treated as a first-class experience rather than a compressed desktop layout.

---

# 36. Iconography

Use one icon family everywhere: **Lucide**. Stroke 1.7–2px, sizes 18/20/24. Do not mix Lucide, Material Icons, Font Awesome, or custom SVG styles inside one interface.

---

# 37. Avatar system

Sizes: 24 / 32 / 40 / 48 / 64px. Conversation avatar: 40px. Team avatar: 28–32px. Fallback initials (e.g. "SP", "AR"). Use deterministic background colors.

---

# 38. Notification philosophy

The product should prioritize attention rather than produce more noise. Since ClarioDesk already avoids duplicate push notifications when a user is actively online, that same philosophy should extend to visual notifications inside the product.

Levels: Informational · Action required · Critical. Avoid red badges for low-priority events.

---

# 39. AI components

Future versions plan smart replies, conversation summaries, sentiment tagging, and AI ticket classification. AI should visually feel integrated rather than like a separate chatbot. Use a subtle icon: `✦` (e.g. "✦ Summarize", "✦ Suggest reply", "✦ Classify"). AI-generated content should always remain editable before sending.

---

# 40. Component hierarchy

```text
Primitives: Button, IconButton, Input, Badge, Avatar, Tooltip, Divider, Surface
Components: ConversationRow, MessageBubble, MessageComposer, TicketCard,
            MetricCard, PhoneStatus, EmptyState, AssignmentMenu
Patterns: Inbox, TicketWorkflow, PhoneSetup, Search, Settings
```

---

# 41. Suggested CSS tokens

```css
:root {
  --brand: #17B26A;
  --brand-hover: #079455;
  --brand-soft: #EFFCF5;
  --bg: #F5F5F7;
  --surface: #FFFFFF;
  --surface-secondary: #F7F7F8;
  --text-primary: #101828;
  --text-secondary: #475467;
  --text-muted: #667085;
  --border: rgba(16, 24, 40, 0.07);
  --success: #12B76A;
  --warning: #F79009;
  --danger: #F04438;
  --info: #2E90FA;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --shadow-card: 0 1px 2px rgba(16,24,40,.03), 0 4px 12px rgba(16,24,40,.04);
  --shadow-floating: 0 8px 30px rgba(16,24,40,.10);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px;
}
```

**Note:** ClarioDesk's current live `styles.css` uses a WhatsApp-teal brand (`#00a884`) rather than the `#17B26A` green specified here. Do not silently swap the brand color in existing screens — flag the discrepancy and confirm with the user before a site-wide rebrand; apply the rest of this system (spacing, radius, motion, elevation, component rules) immediately.

---

# 42. Golden rules

Every new ClarioDesk screen should pass these checks.

**Visual:**
- One obvious primary action
- Maximum 1–2 accent colors visible prominently
- Consistent icon family
- Consistent 4px spacing grid
- Subtle borders and shadows
- No unnecessary containers
- Comfortable whitespace

**UX:**
- User always knows where they are
- User always knows connection state
- Actions provide immediate feedback
- Errors explain recovery
- Keyboard actions work
- Nothing important relies only on color

**Product:** The interface must always reinforce ClarioDesk's core promise:

> A calm, fast workspace for teams to manage WhatsApp conversations together — without giving up ownership of their data.

---

# Library-First UI Policy

ClarioDesk should **not build common UI patterns from scratch when a mature, lightweight, maintainable library already solves them well**.

Preferred order:
```text
1. Proven open-source library
2. Reusable headless primitive
3. Small ClarioDesk wrapper/component
4. Custom implementation only when necessary
```

## Core principle

> **Use libraries for behavior. Use the ClarioDesk design system for appearance.**

Library provides: behavior, accessibility, keyboard interaction, focus management, animation engine, positioning, virtualization.

ClarioDesk provides: colors, radius, typography, spacing, shadows, interaction language, visual hierarchy.

## Preferred UI architecture

```text
Third-party primitive → ClarioDesk wrapper → Design tokens → Feature components → Application screen
```

Example: `Radix Dialog` → `<ClarioDialog />` → `radius-lg` + `shadow-floating` + tokens → `PhoneSetupDialog`. Feature code should generally consume `<ClarioDialog />` rather than importing the primitive directly everywhere.

## Lottie — motion & illustration

Use **Airbnb `lottie-web`** (`npm install lottie-web`) directly.

> **Session note (2026-08-27):** `lottie-react`'s v3 package ships a non-standard reimplementation, not a thin wrapper over `lottie-web` — it corrupted animated multi-keyframe `scale` transforms into an exploded matrix (`-9999x`) independent of keyframe count, starting value, or layer `ind` ordering. Root-caused by direct isolated JSON inspection after ruling out those variables. Fix: use `lottie-web`'s `loadAnimation()` API directly via a small ref-based React wrapper (see `apps/web/src/components/LottiePlayer.tsx`) — do not reach for `lottie-react` again for this project.

Good use cases: phone connection, QR scan success, WhatsApp synchronization, empty inbox, message sending, connection recovery, setup completion, ticket resolved, upload processing, import complete, AI processing states, first-run onboarding.

Motion rule: Lottie should enhance the state, not distract from it.
- Empty state: loop allowed
- Success / failure: play once
- Connecting: loop
- Background decoration: avoid
- Normal inbox: almost none

### Performance policy

Prefer the **SVG renderer**. Target animation JSON size: ideal <100KB, acceptable <250KB, avoid >500KB. Lazy-load large animation assets (e.g. `lazy(() => import("./PhoneSetupAnimation"))`); don't ship onboarding animation assets in the primary inbox bundle.

### Respect reduced motion

Every animated component must respect `@media (prefers-reduced-motion: reduce)` — fallback to the static final frame. Never require motion to understand application state.

## Beautiful UI

Use as a pattern/component source for ClarioDesk's AI functionality (chat, prompt bars, streaming text, tool chips, task rows, approval cards, context cards, search, sidebar nav, tables, flowcharts, insight cards, diff tables) — MIT licensed.

Mapping to ClarioDesk AI features:
- **AI Assistant** ← Beautiful UI Chat → `<AiAssistant />`
- **Smart Reply** ← Recommendation Card → "✦ Suggested reply" with [Insert] [Regenerate]
- **AI processing** ← Task Rows → "✦ Analyzing conversation" checklist
- **AI reasoning/status** ← Thinking (simplified — show "✦ Analyzing conversation…", not internal model reasoning)
- **AI approvals** ← Approval Card → "Assign this conversation to Rahul?" [Cancel] [Assign]
- **AI-generated changes** ← Diff Table → contact updates, bulk ticket updates, CRM sync

**Styling rule:** Do not copy Beautiful UI components visually 1:1. Re-skin with ClarioDesk tokens: `Beautiful UI → interaction pattern → ClarioDesk design tokens → ClarioDesk component`. The result should still unmistakably look like ClarioDesk.

## Recommended library stack

| Need | Preferred |
|---|---|
| Animations | **lottie-web** |
| AI patterns | **Beautiful UI** |
| Accessible primitives | **Radix UI** |
| Icons | **Lucide React** |
| Toasts | **Sonner** |
| Command palette | **cmdk** |
| Positioning/popovers | **Floating UI / Radix** |
| Forms | **React Hook Form** |
| Validation | **Zod** |
| Tables | **TanStack Table** |
| Virtualized lists | **TanStack Virtual** |
| Server state | **TanStack Query** |
| Dates | **date-fns** |
| Drag/drop | **dnd-kit** |
| Rich text if needed | **Tiptap** |
| Charts | **Recharts** |
| Lightweight motion | **Motion / Framer Motion** |
| Complex illustrations | **Lottie** |

> **Status note:** as of the 2026-08-27 session, ClarioDesk's frontend does not yet use Radix, Sonner, cmdk, TanStack (Table/Virtual/Query), React Hook Form, dnd-kit, Tiptap, or Recharts — the current UI uses hand-rolled equivalents (native toasts wrapped in Framer Motion, plain `<table>`-less list rendering, manual fetch + `useAsyncData`). Zod is already in use (`@clariodesk/schemas`). Framer Motion and `lottie-web` were adopted this session. Treat the stack table as the target direction for new/rebuilt screens, not a description of what exists today — don't assume a library is already wired in without checking.

Use Radix primitives (Dialog, Dropdown Menu, Popover, Tooltip, Tabs, Context Menu, Scroll Area, Switch, Checkbox, Radio, Select, Avatar, Collapsible) skinned with ClarioDesk tokens, e.g. wrap `<Dialog.Root>` as `<ClarioDialog>`.

Use Lucide as the only icon library (18px normal controls, 20px navigation, 24px large actions, stroke 1.75–2). Don't introduce another icon library unless Lucide genuinely lacks an icon.

Use Sonner via a ClarioDesk wrapper (`clarioToast.success(...)`, `clarioToast.error(...)`) rather than the library directly.

Use TanStack Table for structured admin data (contacts, tickets, team members, phone sessions, broadcast recipients, audit logs, integrations) instead of hand-rolling sorting/filtering/pagination/selection.

Use TanStack Virtual for the inbox conversation list once it needs to scale past what renders comfortably unvirtualized (thousands of conversations/messages/contacts): `Conversation API → TanStack Query → TanStack Virtual → ConversationRow`.

Use TanStack Query for server-state fetching (`/conversations`, `/messages`, `/tickets`, `/contacts`, `/phones`, `/team`), with WebSocket events invalidating/updating cached data, instead of a hand-rolled generic request cache.

Use cmdk for the global ⌘K command/search experience (search conversations, new chat, create ticket, connect phone, assign conversation, open settings, switch workspace).

Use dnd-kit only where drag-and-drop is genuinely useful (reordering inbox views, moving ticket status, reordering custom fields, campaign/automation flow builders) — not where a normal menu is clearer.

### Motion rule of thumb

```text
CSS       → microinteraction (hover, focus, menu fade, button press, panel change)
Motion    → UI choreography (shared layout, side panels, command palette transitions, drag, stacked cards)
Lottie    → animated illustration
```

## Components we should NOT build ourselves

Date picker, dropdown, tooltip, popover positioning, dialog focus trapping, command palette, virtual scrolling, drag-and-drop engine, table sorting engine, toast system, keyboard shortcut engine, animation renderer, rich text editor. These are mature solved problems.

## Components we SHOULD build

ClarioDesk-specific domain components: `<ConversationRow />`, `<MessageBubble />`, `<MessageComposer />`, `<InternalNote />`, `<PhoneConnectionStatus />`, `<TicketBadge />`, `<TicketPanel />`, `<AssignmentPicker />`, `<ContactSidebar />`, `<WhatsAppAccountCard />`, `<AIReplySuggestion />`, `<ConversationSummary />`. Libraries provide the primitives beneath them.

## Library acceptance checklist

Before introducing a dependency, verify:
- [ ] Actively maintained
- [ ] Good TypeScript support
- [ ] Compatible with React/Vite
- [ ] Reasonable bundle size
- [ ] Accessible where applicable
- [ ] License compatible with ClarioDesk
- [ ] Can be visually customized
- [ ] Does not lock core business logic to the library
- [ ] SSR assumptions don't break the app
- [ ] Doesn't duplicate an existing dependency

## Dependency rule

Avoid installing a package for a trivial function (one string formatter, one CSS effect, one icon). Good reasons: Lottie → animation engine, Radix → accessible primitives, TanStack → table/query/virtualization, dnd-kit → drag/drop engine. The maintenance benefit should justify the dependency.

## Design review rule

Before building any new screen, ask in order:
1. Is this already in our component library?
2. Is there a high-quality open-source primitive?
3. Is there a pattern in Beautiful UI we can adapt?
4. Can Lottie improve the state meaningfully?
5. Only then: do we need a custom implementation?

## Frontend philosophy

> Don't reinvent solved interaction problems. Compose proven libraries into a distinctly ClarioDesk experience.

```text
Libraries give us engineering maturity.
Tokens give us visual consistency.
Domain components give us product identity.
```
