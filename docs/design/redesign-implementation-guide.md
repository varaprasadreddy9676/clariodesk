# ClarioDesk Apple/macOS redesign — implementation guide for agents

**Status as of 2026-09-03 (session 2): every item below is complete.** This
document is now a *reference* of what was done and why, not a work queue —
kept accurate for whoever needs to understand the current state or extend
it further. See `docs/design/redesign-checklist.md`'s Session log for the
session-2 summary, including a note about a concurrent session that was
shipping an unrelated feature on overlapping files during this pass.

This was originally a hand-off document: a concrete, file-by-file work plan
for whichever coding agent (Codex, Cursor, another Claude Code session, a
human) picked up the remaining screens. It was produced by actually reading
the codebase — every finding below cites a real file/selector, not a generic
template. Pair it with **`docs/design/redesign-checklist.md`**, which tracks
progress across sessions — **update that checklist's checkboxes as each item
here is completed**, and add a dated entry to its "Session log."

## Direction (condensed)

Apple/macOS + Apple Messages/Settings/Mail + subtle frosted-glass + Linear
precision. Premium, minimal, calm, precise, fast, enterprise-ready. Not
futuristic, not flashy, not a mobile app stretched to desktop, not a generic
admin template. **This is a visual/consistency pass, not a feature redesign**
— do not remove fields/actions, change API calls, change permissions, change
validation, or change navigation destinations. If a workflow change would
obviously improve UX, write it down instead of doing it silently (append to
the "Deferred workflow suggestions" section at the end of the checklist file,
create that section if it doesn't exist yet).

**The single rule most redesign attempts get wrong:** do not raise font
sizes to "look modern." This is a dense desktop enterprise tool. Normal body
text stays 13–14px. Hierarchy comes from weight, spacing, surface, and
color — not size.

## What's already done — do not redo

All of this is merged to `main` already (commits from 2026-09-03, search
git log for "redesign:" / "design:" / "fix: stop repeating"):

- **Global tokens** (`apps/web/src/styles.css`, top of `:root` and
  `:root[data-theme="dark"]`): typography scale (`--text-page-title`
  22px … `--text-meta` 11px), spacing scale (`--space-1` 4px … `--space-8`
  32px), glass tokens (`--glass-bg`/`--glass-border`/`--glass-blur`, with a
  dark-mode override), control-height tokens (`--control-height-compact`
  32px / `-default` 36px / `-comfortable` 40px). Radius (`--radius-xs`
  through `--radius-pill`) and shadow tokens (`--shadow-card`,
  `--shadow-floating`) already matched the target spec — no change made
  there. **These tokens exist but are NOT yet applied everywhere** — see
  "Global token adoption" below for what's still outstanding.
- **`apps/web/src/components/Composer.tsx` + its CSS**: unified floating
  card (border + `--radius-lg` + `--shadow-card`), pill segmented control
  for WhatsApp/Private Note (`.composer-tabs`), and — important, don't
  regress this — Private Note mode tints the **entire card** pale amber
  (`--note`/`--note-border`), not just a label. This was flagged as
  safety-critical: an agent must never mistake Private Note for a mode that
  sends to the customer.
- **`apps/web/src/components/Timeline.tsx` + CSS**: message canvas uses
  `--canvas` (#F5F5F7), not the old WhatsApp wallpaper; centered
  `.message-scroll-inner` column at 900px max-width; bubbles are uniform
  `--radius-lg` (16px) with no WhatsApp tail; stickers render without
  double chrome (`.message-sticker-only`); redundant "Connected" status
  under the conversation title only shows when the phone actually needs
  attention (not on the healthy/connected case, since the global pill in
  the top bar already covers that).
- **`apps/web/src/components/ChannelList.tsx` + CSS**: list is virtualized
  (`@tanstack/react-virtual` — **do not remove this**, it's load-bearing:
  without it a real account's chat list renders 1,600+ DOM rows
  unconditionally). Avatar is 40px (was 49px — matches design-system §37).
  Selected row = soft brand tint + 3px left accent bar (was flat grey,
  indistinguishable from hover). Two real data bugs were fixed here too:
  previews no longer leak raw `[unknown]`/`[sticker]` type tokens (see
  `messageTypePreview()` / `collapsePreview()` in `App.tsx`), and the
  virtualizer no longer gets stuck at zero rows when the mobile list/chat
  panes toggle via `display:none` (there's an explicit `ResizeObserver` +
  `.measure()` call for this — don't remove it, it's a real regression fix,
  not decoration).
- **`apps/web/src/components/Sidebar.tsx`'s CSS** (`.nav-item`): hover and
  active are now visually distinct (hover = neutral `--hover` tint, active
  = `--brand-soft` tint + `font-weight: 600`) — they used to be identical.
- **`apps/web/src/components/OpsBar.tsx`'s CSS** (`.ops-bar`): frosted-glass
  treatment applied (`--glass-bg` + `backdrop-filter: blur(--glass-blur)`).
  This is the one placed the brief explicitly calls an appropriate glass
  location (top nav / sticky header) — don't add glass elsewhere without
  re-reading section 4 of the original brief (glass is a finishing layer
  on a handful of surfaces, not a general treatment).

## Duplicate/inconsistent patterns found (fix via shared primitives, not per-screen hacks)

These were found by actually grepping the codebase, not assumed:

1. **Three different empty-state implementations**:
   - `EmptyState` component in `apps/web/src/components/States.tsx` (has an
     optional `action` prop, `Inbox` icon default).
   - `Empty` component defined locally inside `apps/web/src/App.tsx`
     (~line 2201) — no `action` prop, different markup.
   - The `.setup-empty` / `.setup-empty-icon` inline markup used directly
     in `TicketsView` and `SetupEmpty` (~App.tsx lines 1156–1164 and
     2138–2156) — a third, hand-rolled pattern with its own `<h2>`/`<p>`
     structure and CSS class family.
   **Fix**: pick one (recommend extending `States.tsx`'s `EmptyState`,
   since it already supports an action button), migrate all three call
   sites to it, delete the other two, delete their now-dead CSS.

2. **Ad-hoc forms instead of the existing `Field` component**: `App.tsx`
   already has a proper `Field` component (~line 2158) with a real
   `<label><span>{label}</span><input/></label>` structure — but
   `TeamView`, `ClientsView` (`ClientRow`'s project form), and `SearchView`
   all use raw `<input placeholder="...">` inside a `.inline-form` div
   instead, relying on the placeholder AS the label. This directly
   contradicts brief rule 10 ("Do not rely entirely on placeholder text as
   labels"). **Fix**: replace the raw inputs in those three call sites
   with `<Field>`, or with a lighter inline-label variant if `Field`'s
   full stacked layout doesn't fit the toolbar-style `.inline-form` visually
   — but it must have a visible label, not just a placeholder.

3. **Two separate CSS rule blocks for the same selectors**: `.inline-form
   input, .inline-form select` are styled once around styles.css line 2865
   and again around line 3035 (search for `.inline-form input,` — there
   are two hits). Read both, consolidate into one, verify nothing currently
   depends on the second block silently overriding the first before
   deleting either.

4. **Button radius is currently 6px, spec wants 8–10px**: `.nav-item,
   .icon-button, .primary-action, .view-tabs button, .composer-tabs
   button, .context-tabs button { border-radius: 6px; }` is one shared
   rule (styles.css, search for `border-radius: 6px;` near the top of the
   file, ~line 283 before this doc's edits shifted line numbers — search
   by content, not line number). This is a single edit that fixes radius
   consistency across ~6 component families at once. Recommend bumping to
   `var(--radius-sm)` (8px) to match the brief's 8–10px button/input
   target — verify visually afterward since this affects a lot of surface
   area at once (nav items, icon buttons, all primary actions, all tab
   strips).

5. **`.data-row` (used by Tickets/Clients/Team) is a hand-rolled
   flex/grid row, not a real `<table>`**, and there's no shared
   table-primitive despite three screens needing one (Team, Clients,
   Phones' phone list). The brief's section 11 (Tables) wants consistent
   header/row-height/alignment/sort/selection/empty-state treatment. Given
   these are simple 2-column key-value rows today (not sortable/paginated
   grids), a full `<table>` rebuild may be more than these screens need —
   use judgment: if introducing TanStack Table here would be
   disproportionate to the actual data shown, it's fine to keep
   `.data-row` but make it one truly shared, well-specified component
   (consistent row height 40–48px, consistent header treatment where a
   header exists, consistent hover/selected state) rather than each screen
   overriding it slightly differently.

## What was actually done (session 2, 2026-09-03) — fixes applied

Concrete resolution for each of the five findings above, plus one
additional finding not caught in the original audit:

1. **Empty states**: `EmptyState` in `components/States.tsx` extended with
   `icon` (LucideIcon, defaults to `Inbox`), `hint`, and `compact` props.
   `compact` drops the icon circle for inline "no results in this list"
   spots (channel list, notification panel, context panel, search
   results) where the full illustration was oversized. All three prior
   patterns migrated and their dead CSS removed: the local `Empty`
   component and `.setup-empty`/`.setup-empty-icon`/`.setup-empty-hint`
   markup that used to live in `App.tsx` are gone; `.empty-panel` (used by
   `ChannelList.tsx`, `NotificationCenter.tsx`, `ContextPanel.tsx`) is
   gone. New CSS lives at `.empty-state`/`.empty-state-compact` in
   `styles.css` (search for "Shared empty-state primitive").

2. **Placeholder-as-label forms**: `TeamView`, `ClientsView`'s `ClientRow`
   project form, and `SearchView` all now use `<Field>` (or a labeled
   variant for `SearchView`'s search-box-style input, `.page-search-field`
   in `styles.css`) instead of raw `<input placeholder="...">`.

3. **Duplicated `.inline-form input, .inline-form select` CSS block**:
   merged into one rule (also folded in `.field select`, needed once
   `TeamView`'s role `<select>` moved inside a `.field` label).

4. **Button radius 6px → 8-10px**: the shared
   `.nav-item, .icon-button, .primary-action, .view-tabs button,
   .composer-tabs button, .context-tabs button` rule now uses
   `var(--radius-sm)` (8px). Every other hardcoded `border-radius: 6px` on
   a button/input in the screens this pass touched was swapped too:
   `.secondary-action`, `.segmented button`/`.row-actions button`/
   `.inline-form button`/`.data-row select`, `.mapping-form select`,
   `.mapping-actions button`, `.search-result-row`, `.conversation-dialog`
   input/select/textarea + footer buttons + header close button,
   `.notification-panel-actions button`. **Left alone on purpose** (out of
   this pass's scope, verify before touching):
   Timeline's `.reaction-picker button` (already-completed/verified
   screen), `.canned-response-picker` + `.composer-attachment` (Composer-
   adjacent, from a concurrently-shipped "quick replies" feature, not one
   of this pass's screens), `.password-input`/`.auth-submit` (AuthScreen,
   never in this pass's screen list).

5. **Missing table primitive**: judgment call, not a rebuild. `.data-row`
   (styles.css, search for `.data-row {`) was already one consistently-
   specified component — 58px min-height, `var(--radius-md)`, same border/
   background treatment — used identically by `TicketsView`, `TeamView`,
   `ClientsView`, and `SettingsView`. Introducing TanStack Table here would
   be disproportionate to what's actually simple 2-column key-value rows
   with no sort/paginate/select requirements. Only change made:
   `.data-row strong`/`.data-row span` font-sizes swapped for
   `--text-body`/`--text-body-secondary` tokens (13px/14px values
   unchanged — just documented via token instead of a magic number).

6. **New finding — dead CSS**: `.qr-box` and `.qr-panel` (+ its `img`/
   `strong`/`span` descendants) in `styles.css` had zero references in any
   `.tsx` file — `PhonesView` was rewritten at some point to use
   `.wa-link-qr`/`.wa-qr-pending` instead, orphaning this whole class
   family. Removed.

## Modularization (session 2, 2026-09-03) — App.tsx split up

`App.tsx` was 2652 lines and contained every screen's component function,
several shared helper components, and every pure data-mapping function in
one file. Split into (no behavior change, verified via
typecheck/lint/vitest/build before and after):

- `apps/web/src/views/{TicketsView,SearchView,PhonesView,ClientsView,
  TeamView,ReportsView,SettingsView,SetupEmpty}.tsx` — one file per screen.
  `ClientsView.tsx` also contains its private `ClientRow` sub-component
  (not exported, same as before). `ReportsView.tsx` also contains its
  private `Metric` sub-component.
- `apps/web/src/components/{Field,PanelTitle,ChannelContextMenu,
  SearchResultGroup}.tsx` — shared helper components previously defined
  inline in `App.tsx`. `ChannelContextMenu.tsx` also exports its
  `ChannelMenuAction`/`ChannelMenuState` types (previously local to
  `App.tsx`); `ContextPanel.tsx` now exports its own `ContextTab` type
  (previously duplicated as a private type in `App.tsx`).
- `apps/web/src/lib/ui-mappers.ts` — every pure `ApiX → UiX` mapper
  (`toUiOps`, `toUiChannels`, `toUiMessage`, `toUiTicket`, `filterChannels`,
  `memberName`, `messageTypePreview`, `collapsePreview`, `formatTime`) plus
  the `MESSAGE_TYPE_PREVIEW` lookup table.
- `apps/web/src/lib/qr.ts` — `toQrImage` (QR data → data-URL conversion),
  used by `PhonesView`.

`App.tsx` itself now holds only: `App`/`AuthScreen`/`Workbench` (the three
top-level components that actually need the shared state/effects/realtime
wiring), `buildNavItems` (kept here since it closes over the local
`navIcons` map), and the `Toast`/`createWorkspaceSlug` local helpers. Final
size: 1148 lines.

**If you're extending a view further**: import shared helpers from their
new locations (`../components/Field.js`, `../lib/ui-mappers.js`, etc.), not
from `App.tsx` — nothing is re-exported from `App.tsx` anymore.

## Global token adoption — what's still outstanding

As of session 2, tokens are applied across every screen/component this pass
touched (see "What was actually done" above). What's genuinely still
outstanding, for a future session:

- **Timeline.tsx internals** beyond what was already redone (bubble
  radius/canvas — done): reaction picker, message context menu, and
  attachment viewer still have some hardcoded pixel values. Not touched
  this pass since Timeline is an already-verified, working screen and the
  guide's own instruction was "don't regress it, just do surrounding
  chrome" — the surrounding chrome (ContextPanel) is now done, the
  Timeline internals themselves were out of scope.
- **Composer.tsx internals** beyond the composer-tabs radius fix (covered
  by the shared rule): `.composer-attachment`, `.composer-toolbar`
  buttons, `.reaction-picker` still have local hardcoded values. Same
  reasoning — already a verified screen, not regressed, not proactively
  touched.
- **AuthScreen** (`App.tsx`'s `AuthScreen` function + its CSS): never one
  of the screens/components listed in Step 5 of the checklist. Has its own
  `.auth-*` class family with hardcoded radii/sizes (`.password-input`,
  `.auth-submit`, etc.) that were deliberately left alone.
- **CannedResponsePicker.tsx**: shipped by a concurrent session during
  session 2 (see checklist Session log), not part of this redesign
  effort's scope — has its own hardcoded 6px radius, not touched.

Don't do a single blind find-and-replace across the whole file — that's how
you get a broken build from one unexpected selector collision. As you touch
each selector for a screen, replace its hardcoded font-size/spacing/
button-height with the matching token if one applies. Leave selectors you
aren't otherwise touching alone unless you're doing a dedicated, carefully
verified sweep.

## Per-screen work (Step 5 of the checklist) — all complete as of session 2

Every screen now lives in its own file under `apps/web/src/views/` (see
"Modularization" above) rather than as a function inside `App.tsx`. Summary
of what was done to each (see checklist Step 5 for the full detail):

- **TicketsView** (`views/TicketsView.tsx`): `EmptyState` migration, status
  `<select>` given `aria-label`, control-height/radius tokens applied.
- **SearchView** (`views/SearchView.tsx`): labeled search field
  (`.page-search-field`/`.search-input-shell`) replacing the placeholder-
  only input; confirmed `SearchResultGroup` never renders raw IDs.
- **PhonesView** (`views/PhonesView.tsx`): moved verbatim, zero logic
  changes — the `useEffect` polling, `startLink`/`doPhoneAction`, and
  phone sorting/filtering are untouched, per the original instruction to
  treat this as working/verified code.
- **ClientsView + ClientRow** (`views/ClientsView.tsx`): both forms
  converted to `<Field>`; `Empty` → `EmptyState`.
- **TeamView** (`views/TeamView.tsx`): all three inputs + role select
  converted to `<Field>`/labeled `.field` — this became the reference
  implementation the other views' `<Field>` conversions followed.
- **ReportsView** (`views/ReportsView.tsx`): moved verbatim — `Metric`'s
  proportions (large value, compact label) were already correct.
- **SettingsView** (`views/SettingsView.tsx`): moved verbatim, then wired
  into the concurrently-shipped "reply signature" + "quick replies"
  feature using the same `<Field>`/`EmptyState` patterns.

### Shared components — all reviewed/fixed in session 2

- `apps/web/src/components/ContextPanel.tsx` — tab strip radius covered by
  the shared button-radius fix; font-size tokens applied to
  `.context-tabs button`/`.context-section h3`; empty state migrated to
  `EmptyState`. Panel header intentionally left sharing `.timeline-header`
  (Timeline is a separately-completed, verified screen — not touched here
  to avoid regressing it).
- `apps/web/src/components/NotificationCenter.tsx` — `.notification-panel`
  bumped from `--radius-md` to `--radius-lg` and given the glass treatment
  (`--glass-bg` + `backdrop-filter`), since it's a floating popover per
  brief section 4. Header/action-button font-size and height tokens
  applied. Empty state migrated to `EmptyState`.
- `apps/web/src/components/NewChatDialog.tsx` / `NewGroupDialog.tsx` —
  both already shared one `.conversation-dialog` header/footer markup
  (verified: same `<header><h2/><span/></header>` structure, same
  `aria-label="Close"` button) — no JSX changes needed, only the shared
  CSS token pass (control-height/radius-sm on inputs, footer buttons, and
  the close button; glass-border on the dialog border).
- `apps/web/src/components/Toast.tsx` — CSS-only token pass
  (`font-size: var(--text-body-secondary)`); the component itself had no
  hardcoded styles to change.
- `apps/web/src/components/StatusBadge.tsx` — reviewed against brief
  section 13: the badge shell was already neutral for every tone (only
  the dot/text carry semantic color, never the full badge background) —
  correct as-is. Token pass only (`--radius-pill`, `--text-meta`).

## Verification (repeat for every screen/component touched)

1. `cd apps/web && npx tsc -p tsconfig.json` (typecheck)
2. `npm run lint` (from repo root)
3. `npx vitest run` (from repo root)
4. `cd apps/web && npm run build` (confirms production bundle still builds
   — this project uses Vite 8 / Rolldown; a pre-existing `eval` warning
   from `lottie-web`'s own bundle and a >500kB chunk-size warning are
   expected/harmless, not new failures)
5. Live check: start `api` and `web` dev servers (`.claude/launch.json` has
   configs, or `npm run dev -w @clariodesk/api` / `-w @clariodesk/web`) and
   either take real screenshots or inspect via computed styles
   (`getComputedStyle`) for the specific properties you changed. Don't
   assume a CSS edit worked — verify it rendered.
6. Commit with a message that states what was found and why the fix is
   correct (see recent git log entries on this repo for the expected
   level of detail — they cite the specific bug found, not just "styled
   the tickets page").
7. Update `docs/design/redesign-checklist.md`'s checkboxes and add a dated
   session-log entry.

## Git workflow

Check `git branch --show-current` before committing — this repo's
convention has been to commit to `baseline/core-v1-backend`, then
`git checkout main && git merge baseline/core-v1-backend --no-ff && git push
origin main && git checkout baseline/core-v1-backend`, then verify CI via
`gh run list --limit 1 --repo <owner>/<repo>` until it shows
`completed`/`success`. **Note from session 2**: this repo had multiple
concurrent sessions/agents committing to it during this pass, and
`git branch --show-current` changed from `baseline/core-v1-backend` to
`main` mid-session without any branch-switch command being run by this
session — check `git branch --show-current` immediately before every
commit, not just once at the start, if you suspect concurrent activity.
Follow whatever the current repo convention is at the time you pick this
up — check recent commits first.
