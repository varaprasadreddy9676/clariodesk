
# ClarioDesk Apple/macOS-inspired redesign — progress checklist

Tracks the multi-session redesign requested 2026-09-03: bring the whole app to
one consistent "premium enterprise, Apple/macOS-inspired, Linear-precision"
design language, screen by screen, without changing functionality, workflows,
permissions, or business logic. Full brief: see the `/loop` command that
started this effort (also summarized in `docs/design/design-system.md`,
which this pass supersedes/refines where they conflict — this checklist's
token values win).

**Handing this off to another agent?** Read
[`docs/design/redesign-implementation-guide.md`](./redesign-implementation-guide.md)
first — it has concrete file/line-level findings and per-screen instructions
for everything still unchecked below, produced by actually reading this
codebase rather than generic advice. Update this checklist's checkboxes and
add a session-log entry as you complete each item.

**Ground rules for every screen touched:**
- Preserve all fields, actions, navigation destinations, and business logic.
- No font size above what's specified below just to "look modern" — normal
  text stays 13–14px.
- Reuse the shared primitives (once built in Step 2/3) — don't hand-roll a
  new button/input/badge style per screen.
- Verify (typecheck/lint/vitest) after every screen, before moving to the
  next.

## Step 1 — Audit (done 2026-09-03)

**Screens** (`apps/web/src/App.tsx`, now `apps/web/src/views/*.tsx`):
- [x] Inbox shell (three-column: ChannelList / Timeline / ContextPanel)
- [x] TicketsView
- [x] SearchView
- [x] PhonesView
- [x] ClientsView
- [x] TeamView
- [x] ReportsView
- [x] SettingsView

**Shared components** (`apps/web/src/components/`):
- [x] ChannelList.tsx — redone earlier (virtualized, new row/avatar
      sizing, selected-state accent bar); empty-state migrated to shared
      `EmptyState` 2026-09-03 (session 2)
- [x] Timeline.tsx — redone earlier (canvas bg, centered column,
      bubble radius/no-tail, sticker chrome, redundant status pill removed)
- [x] Composer.tsx — redone earlier (floating card, segmented tabs,
      private-note tint)
- [x] Sidebar.tsx (main left nav)
- [x] OpsBar.tsx (top status bar) — glass treatment done; pill styling
      (`.ops-item`, `.realtime-pill`) reviewed 2026-09-03, already used
      restrained neutral/semantic tones consistent with section 13, no
      change needed
- [x] ContextPanel.tsx — tab strip radius/font-size token pass done
      2026-09-03; empty-state migrated to shared `EmptyState`; panel header
      intentionally left sharing `.timeline-header`'s 19px (Timeline is a
      completed/verified screen — not touched to avoid regressing it)
- [x] NewChatDialog.tsx / NewGroupDialog.tsx — shared `.conversation-dialog`
      CSS token pass done 2026-09-03 (control-height/radius-sm on
      inputs/footer buttons/close button, glass-border on the dialog
      border); both already shared one consistent header/footer markup, no
      JSX changes needed
- [x] NotificationCenter.tsx — token pass + glass treatment done
      2026-09-03 (radius-md → radius-lg, glass-bg/blur added since it's a
      floating popover per brief section 4); empty-state migrated to
      shared `EmptyState`
- [x] StatusBadge.tsx (shared badge primitives) — reviewed against brief
      section 13 2026-09-03: badge shell stays neutral for every tone,
      only the dot/text carry the semantic color — already correct,
      token pass only (radius-pill, text-meta)
- [x] States.tsx (empty/loading/error primitives) — `EmptyState` extended
      2026-09-03 with `icon`/`hint`/`compact` props to become the one
      shared empty-state component (see Step 3)
- [x] Toast.tsx — token pass done 2026-09-03 (font-size → --text-body-secondary;
      radius/shadow were already token-based)
- [x] AttachmentTray.tsx — reviewed, already token-consistent, no change
- [x] EmojiPicker.tsx — reviewed, already token-consistent (radius-lg,
      shadow-floating), no change
- [x] NewConversationFab.tsx — reviewed, already token-consistent, no
      change

**Known duplicate/inconsistent patterns found in audit** (fixed via shared
primitives in Step 3, not per-screen overrides):
- [x] Three ad-hoc "empty state" implementations consolidated into one
      `<EmptyState>` primitive (`components/States.tsx`) — see Step 3.
- [x] Button sizing/padding unified: the shared 6px-radius rule
      (`.nav-item, .icon-button, .primary-action, .view-tabs button,
      .composer-tabs button, .context-tabs button`) bumped to
      `var(--radius-sm)` (8px), plus every other hardcoded 6px
      button/input radius in the screens this pass touched
      (`.secondary-action`, `.segmented button`, `.row-actions button`,
      `.inline-form button`, `.data-row select`, `.mapping-form select`,
      `.mapping-actions button`, `.search-result-row`,
      `.conversation-dialog` inputs/footer buttons/close button,
      `.notification-panel-actions button`). Hardcoded 6px radii left
      alone: Timeline's `.reaction-picker button` (already-completed,
      verified screen), `CannedResponsePicker`/`.composer-attachment`
      (Composer-adjacent, concurrent feature, not in this pass's scope),
      `.password-input`/`.auth-submit` (AuthScreen, not in this pass's
      screen list).
- [x] Tables/table-like rows for Team, Phones, and Clients reviewed:
      `.data-row` is already one shared, consistently-specified primitive
      (58px min-height, `--radius-md`, uniform hover/selected treatment)
      used identically by TicketsView/TeamView/ClientsView/SettingsView —
      given judgment call in the guide (these are simple 2-column
      key-value rows, not sortable/paginated grids), a full `<table>`
      rebuild would be disproportionate. Font-size hardcoded values in
      `.data-row strong`/`.data-row span` swapped for
      `--text-body`/`--text-body-secondary` tokens (values unchanged,
      13px/14px already matched).

## Step 2 — Global design tokens (`apps/web/src/styles.css` `:root`) — done 2026-09-03

- [x] Typography scale tokens added: `--text-page-title` (22px),
      `--text-section-heading` (17px), `--text-card-heading` (15px),
      `--text-body` (14px), `--text-body-secondary` (13px),
      `--text-label` (12px), `--text-meta` (11px). Progressively applied
      to every screen/component touched in Step 5 (session 2) — search
      results, notification rows, context tabs, toast, data-row, status
      badges, dialog headers. Still not applied to untouched surfaces
      (Timeline, Composer internals, AuthScreen) — leave those for a
      dedicated future pass, not a blind sweep.
- [x] Spacing tokens added: `--space-1` (4px) through `--space-8` (32px).
      Same caveat as above.
- [x] Radius scale — already matched the new spec exactly (xs 6 / sm 8 /
      md 12 / lg 16 / xl 20 / pill 999), no change needed.
- [x] Shadow scale — already subtle (`--shadow-card` / `--shadow-floating`),
      confirmed no heavier ad-hoc shadows in the reviewed portion so far.
- [x] Glass tokens added: `--glass-bg` / `--glass-border` / `--glass-blur`,
      with a dark-mode override (dark glass uses a dark base, not white).
      Applied to `.conversation-dialog` border and `.notification-panel`
      (both floating/popover surfaces per brief section 4) in session 2.
- [x] Control-height tokens added: `--control-height-compact` (32px),
      `--control-height-default` (36px), `--control-height-comfortable`
      (40px). Applied to every button/input touched in session 2 (dialog
      inputs/buttons, notification-panel-actions, secondary-action,
      segmented/row-actions/inline-form buttons, data-row select,
      mapping-form select/actions). Not yet applied to Timeline/Composer
      internals or AuthScreen — out of this pass's scope.
- [x] Table tokens — decided against introducing separate header/row-height
      tokens; `.data-row`'s existing 58px min-height and `--radius-md` are
      already the de-facto shared table-row spec (see audit note above).

## Step 3 — Shared primitives (done 2026-09-03)

- [x] `<EmptyState>` (icon + short text + one action) — extended with
      `icon`/`hint`/`compact` props and migrated every call site:
      `App.tsx`'s local `Empty`/`.setup-empty` (deleted, see below),
      `ChannelList.tsx`'s `.empty-panel`, `NotificationCenter.tsx`'s
      `.empty-panel.compact`, `ContextPanel.tsx`'s `.empty-panel.compact`.
      Dead CSS classes `.empty-panel`, `.setup-empty`, `.setup-empty-icon`,
      `.setup-empty-hint` removed from styles.css after migration (see
      "Duplicate/inconsistent patterns" section of the implementation
      guide, now updated with the actual fix applied).
- [x] Button classes unified under the existing scale
      (primary/secondary/tertiary/destructive) at the new
      height/radius tokens — see the radius-mismatch fix above.
- [x] Segmented control primitive exists (built for the composer's
      WhatsApp/Private-Note switch) — reused as-is for ChannelList's view
      filters and ContextPanel's tabs (already shared via
      `.composer-tabs, .context-tabs, .view-tabs` selectors) — no new
      primitive needed.
- [x] Table row primitive shared by Team/Phones/Clients: confirmed
      `.data-row` already serves this role consistently — see audit note.

## Step 4 — Shell/navigation — done 2026-09-03

- [x] Sidebar.tsx nav-item: hover/active distinction (done earlier
      session) — reverified live 2026-09-03 via screenshot, still holds.
- [x] OpsBar.tsx: frosted-glass treatment (done earlier session) —
      reverified live.
- [x] OpsBar pill styling (`.ops-item`, `.realtime-pill`) reviewed against
      the badge/chip conventions (section 13) 2026-09-03 — already uses
      restrained neutral backgrounds with semantic-colored icons/text, no
      change needed.

## Step 5 — Per-screen work (done 2026-09-03, session 2)

App.tsx was also modularized this session (2652 → 1148 lines): every view
function moved to its own file under `apps/web/src/views/`, shared helpers
(`Field`, `PanelTitle`, `ChannelContextMenu`, `SearchResultGroup`) moved to
`apps/web/src/components/`, and pure mapper functions
(`toUiChannels`/`toUiMessage`/`toUiTicket`/`toUiOps`/`filterChannels`/
`memberName`/`messageTypePreview`/`collapsePreview`/`formatTime`) moved to
`apps/web/src/lib/ui-mappers.ts`, with `toQrImage` in `apps/web/src/lib/qr.ts`.
No behavior changed — this was a pure file-organization refactor, verified
by typecheck/lint/vitest/build passing identically before and after.

- [x] **TicketsView** (`views/TicketsView.tsx`): empty state migrated to
      `EmptyState`; status `<select>` given `aria-label` (had neither a
      visible label nor an aria-label before — the row layout doesn't fit
      a visible label without changing the row structure, so aria-label
      is the appropriate fix per the guide's own suggestion); select
      height/radius now use `--control-height-default`/`--radius-sm` via
      the shared `.data-row select` rule.
- [x] **SearchView** (`views/SearchView.tsx`): placeholder-as-label input
      replaced with a labeled search field reusing ChannelList's
      icon+input visual pattern (`.search-input-shell`, new shared class);
      confirmed `SearchResultGroup` never renders raw channel/provider IDs
      (channelId is only used for the `onOpen` callback, never displayed).
- [x] **PhonesView** (`views/PhonesView.tsx`): moved verbatim — no visual
      changes made this session beyond what was already done; the
      `useEffect` polling logic, `startLink`/`doPhoneAction` functions,
      and phone sorting/filtering were not touched, per the guide's
      explicit warning.
- [x] **ClientsView + ClientRow** (`views/ClientsView.tsx`): both the
      client-create and project-create forms converted from
      placeholder-as-label raw inputs to `<Field>`; `Empty` call site
      migrated to `EmptyState`.
- [x] **TeamView** (`views/TeamView.tsx`): all three raw inputs (display
      name, email, password) plus the role `<select>` converted to
      `<Field>`/labeled `.field` — this was the guide's suggested proof
      case for the `Field`-based pattern, now the template the other two
      views above followed.
- [x] **ReportsView** (`views/ReportsView.tsx`): moved verbatim; `Metric`
      component's label text already used the correct proportions (large
      value, compact label) — no change needed per the guide's explicit
      exception for metric values.
- [x] **SettingsView** (`views/SettingsView.tsx`): moved verbatim, plus
      wired up to a concurrently-landed "reply signature" + "quick
      replies" feature (added by a parallel session mid-work — see
      Session log) using the same `<Field>`/`EmptyState` patterns
      established above.

## Step 6 — Consistency audit fixes (done 2026-09-03, session 2)

- [x] Duplicate empty states — see Step 3.
- [x] Placeholder-as-label forms in TeamView/ClientsView/SearchView — see
      Step 5.
- [x] Duplicated `.inline-form input, .inline-form select` CSS rule block
      — consolidated into one rule (also merged in `.field select` since
      TeamView's role picker now lives inside a `.field`).
- [x] Button-radius token mismatch (6px → 8px) — see Step 1/4 above.
- [x] Missing table primitive — `.data-row` confirmed as the de-facto
      shared spec, see Step 1 audit note.
- [x] Dead CSS removed: `.qr-box`/`.qr-panel` and descendants (orphaned —
      PhonesView uses `.wa-link-qr`/`.wa-qr-pending` instead, this class
      family had zero JSX references).

## Step 7-9 — Final consistency pass (done 2026-09-03, session 2)

- [x] Visual consistency audit across all touched screens: verified live
      via Playwright screenshots against a real seeded workspace (9
      clients, 9 team members, 17 tickets, real WhatsApp conversation
      data) — Inbox, Tickets, Search, Phones, Clients, Team, Reports,
      Settings, NotificationCenter all screenshotted and visually
      reviewed.
- [x] Responsive check at 1366×768 / 1440×900 / 1920×1080 — screenshotted
      Inbox (three-column shell) and Team (table-list screen) at all
      three sizes; three-column layout holds at all sizes, no column
      collapse/overlap.
- [x] Interaction-state sweep on touched shared components:
      - hover: Sidebar nav-item hover (neutral tint) vs active (brand
        tint + bold) confirmed visually distinct via screenshot.
      - disabled: TeamView's "Create user" button confirmed disabled via
        `isDisabled()` when required fields are empty.
      - empty: EmptyState's compact/full variants confirmed rendering
        correctly in ChannelList, NotificationCenter, ContextPanel,
        TicketsView, ClientsView, SettingsView (quick replies).
      - loading/error: Inbox's existing skeleton-loading and
        `channels.status === "error"` retry state exercised during
        screenshot capture (transient network blip surfaced the real
        error state + Retry button, confirmed correct behavior, not a
        regression).
      - focus/selected: not independently screenshotted this session
        (deferred — see below) but no CSS touched this session removes or
        alters existing `:focus-visible`/`.is-active`/`is-selected` rules.

## Deferred workflow suggestions

(Per the guide's instruction: workflow changes noticed during this pass
that would improve UX but are out of scope for a visual/consistency-only
pass — not implemented, just recorded here.)

- TicketsView's status `<select>` has no visible "Status" label in the row
  layout (only an `aria-label` was added this session, which fixes the
  accessibility gap but not the visual ambiguity for sighted users). A
  future pass could restructure `.data-row` to have a small label above
  inline controls like this, similar to how `Field` renders label+input,
  without changing the row's compact height.
- SearchView's search has no live/instant results and no recent-searches
  memory — every search is a manual submit + full-page result replacement.
  A command-palette-style instant search (per design-system.md §26,
  ⌘K) would be a bigger workflow improvement, out of scope here.
- ClientRow's inline "Add project" form has no delete/edit action for
  existing projects (chips are display-only). Worth a follow-up if client
  data entry becomes a frequent task.
- No independent verification of `:focus-visible` styles across the newly
  token-adjusted controls was captured via screenshot this session — a
  future session should do a dedicated keyboard-navigation sweep (Tab
  through each touched screen, screenshot each focus ring) rather than
  relying on "no CSS was removed" as proof.

## Session log

- 2026-09-03: Checklist created. Inbox shell (ChannelList/Timeline/Composer)
  already redone in a prior pass today per a separate, more specific design
  review — counts toward this effort since it matches the same direction
  (neutral canvas, restrained WhatsApp-green-as-accent, floating composer,
  no oversized type). Starting Step 2 (global tokens) next.
- 2026-09-03 (session 2): Completed every remaining screen (Tickets,
  Search, Phones, Clients, Team, Reports, Settings) and shared component
  (ContextPanel, NotificationCenter, NewChatDialog, NewGroupDialog, Toast,
  StatusBadge) per the implementation guide. Fixed all five
  consistency-audit findings from the guide (duplicate empty states,
  placeholder-as-label forms, duplicated CSS block, button-radius
  mismatch, table primitive judgment call) plus one additional finding
  not in the guide: dead `.qr-box`/`.qr-panel` CSS with zero JSX
  references, removed. Also modularized `App.tsx` from 2652 to 1148 lines
  (views → `apps/web/src/views/*.tsx`, shared helpers → `components/`,
  pure mappers → `lib/ui-mappers.ts` + `lib/qr.ts`) at the user's request,
  verified behavior-identical via typecheck/lint/vitest/build before and
  after. Note: this session ran concurrently with another session actively
  shipping a "quick replies / canned responses" + "reply signature"
  feature on the same files (`Composer.tsx`, `SettingsView`, `api.ts`,
  schema/migrations) — several of my in-progress edits to `ChannelList.tsx`,
  `ContextPanel.tsx`, `NotificationCenter.tsx`, and `States.tsx` were
  silently reverted mid-session by that process's branch merges and had
  to be reapplied; `git branch --show-current` also changed from
  `baseline/core-v1-backend` to `main` mid-session outside of any command
  I ran. Full verification (typecheck/lint/vitest/build + live Playwright
  screenshots against a real seeded workspace at three viewport sizes) was
  re-run after reapplying to confirm nothing regressed. See
  `docs/design/redesign-implementation-guide.md`'s updated "What's already
  done" section for the consolidated final state.
