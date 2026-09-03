# ClarioDesk Apple/macOS redesign — implementation guide for agents

This is a hand-off document: a concrete, file-by-file work plan for whichever
coding agent (Codex, Cursor, another Claude Code session, a human) picks up
the remaining screens. It was produced by actually reading the current
codebase — every finding below cites a real file/selector, not a generic
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

## Global token adoption — what's still outstanding

The tokens exist (see "What's already done") but most of the file still has
hardcoded values from before they existed. Don't do a single blind
find-and-replace across the whole file — that's how you get a broken build
from one unexpected selector collision. Instead, **as you touch each
selector for a screen below, replace its hardcoded font-size/spacing/
button-height with the matching token** if one applies. Leave selectors you
aren't otherwise touching alone unless you're doing a dedicated, carefully
verified sweep.

## Per-screen work (Step 5 of the checklist)

For every screen below: read the current JSX in `apps/web/src/App.tsx` at
the given function, read its CSS via the class names used, then apply the
token/consistency fixes without touching the data-fetching or event-handler
logic. **After every screen: `npx tsc -p apps/web/tsconfig.json`, `npm run
lint`, `npx vitest run`, then a live check** (see "Verification" below)
before moving to the next screen.

### TicketsView (`App.tsx` ~line 1137)
- Empty state uses the `.setup-empty` pattern — migrate to the shared
  `EmptyState` per finding #1 above.
- `.data-row` here shows title + "priority / assigned to X" as secondary
  text, plus a raw `<select>` for status. The `<select>` has no visible
  label ("Status" or similar) — at minimum give it an `aria-label` if a
  visible label doesn't fit the row layout (it currently has neither).
- Status `<select>` height/radius should match the new form-control tokens
  (`--control-height-default`, `--radius-sm`).

### SearchView (`App.tsx` ~line 1197)
- `.inline-form` here is a single text input + submit button — replace the
  placeholder-as-label input per finding #2.
- Uses `SearchResultGroup` (defined further down in `App.tsx`) — check its
  rendering for the same "raw ID fragment" class of bug that was already
  fixed once elsewhere this session (channel IDs leaking into UI); confirm
  it's not still showing raw provider IDs.
- Per brief section 14 (Search): confirm the search input itself is
  34–40px tall with a search icon — it currently has no icon at all
  (plain `<input placeholder="Search text">`). Consider adding one for
  visual consistency with the sidebar's `.search-box` (ChannelList already
  has a proper icon+input search box — reuse that visual pattern here
  rather than inventing a second search style).

### PhonesView (`App.tsx` ~line 1272, large — ~570 lines)
- This is the most complex remaining screen (QR linking flow, confetti
  celebration, auto-sync polling). **Do not touch any of the `useEffect`
  polling logic, the `startLink`/`doPhoneAction` functions, or the phone
  sorting/filtering logic** — this is working, tested, real-world-verified
  code (see git log: "fix: make the Baileys WhatsApp gateway actually
  connect and sync" and related commits from the same day). Purely visual
  pass only.
- The phone-hero card, QR display, and additional-phones list all need a
  token pass (font sizes, spacing, button heights) but keep every
  conditional render branch exactly as-is.

### ClientsView + ClientRow (`App.tsx` ~line 1846)
- Same placeholder-as-label issue (finding #2) on both the client-create
  form and the project-create form inside `ClientRow`.
- `EmptyState`/`Empty` duplicate: this view already imports and uses
  `Empty` (not `EmptyState`) — when consolidating per finding #1, update
  this call site too.
- `.data-row.tall` variant exists for rows with a nested `.mini-list` of
  project chips — verify chip styling matches whatever chip/tag convention
  gets established in Step 3 of the checklist (segmented control primitive
  already exists; a chip primitive does not yet — check if one gets built
  before this screen is reached, and reuse it rather than inventing a
  fourth chip style).

### TeamView (`App.tsx` ~line 1944)
- Worst offender for finding #2: three raw inputs (display name, email,
  password) plus a `<select>` for role, all placeholder-labeled, in one
  `.inline-form` row. This is the best candidate to prove out the
  `Field`-based replacement pattern before applying it elsewhere.
- Member list rows (`.data-row`) show role/status as an `<em>` — fine
  structurally, just needs the token pass (font-size should be
  `--text-body-secondary` or `--text-label`, not whatever hardcoded value
  is there now).

### ReportsView (`App.tsx` ~line 2021)
- Smallest screen — a refresh button + `.metric-grid` of `Metric` cards.
  Check the `Metric` component's font sizes against
  `--text-card-heading`/`--text-page-title` — reports metrics are the one
  place the brief explicitly allows a larger number for the data value
  itself ("Important numbers can be larger, but normal UI text should
  remain compact") — don't shrink the metric value itself, just verify the
  surrounding label/subtitle text isn't oversized.

### SettingsView (`App.tsx` ~line 2052)
- Two `.data-row`s (Session info + Notifications toggle) with
  `.row-actions` button groups. Straightforward token pass — button
  heights, spacing. No placeholder/label issues here (no inputs on this
  screen).

### Remaining shared components not yet touched
- `apps/web/src/components/ContextPanel.tsx` — tabs (Ticket/Channel/
  People/Events) use `.context-tabs` (shares the 6px-radius rule from
  finding #4). Ticket rows here were already fixed earlier this session
  (title-led layout, monospace secondary line) — don't regress that, just
  do the token pass on surrounding chrome (panel header, tab strip).
- `apps/web/src/components/NotificationCenter.tsx` — a floating panel
  (`.notification-panel`, already uses `--shadow-floating` and
  `--radius-md` — check it against the newer `--radius-lg`/glass tokens
  since it's a "floating surface"/popover, one of the brief's listed
  glass-appropriate locations).
- `apps/web/src/components/NewChatDialog.tsx` and `NewGroupDialog.tsx` —
  both modals; check them against `.conversation-dialog`'s existing CSS
  (styles.css, search `.conversation-dialog`) for the modal-header glass
  treatment the brief calls out (section 15: "clear title, optional short
  description, structured body, predictable footer actions, consistent
  close button"). Don't change what fields these dialogs collect or what
  they submit.
- `apps/web/src/components/Toast.tsx` — small (25 lines), quick token
  pass only.
- `apps/web/src/components/StatusBadge.tsx` — this is the shared
  badge/pill primitive already used across the app (phone status, channel
  status, risk/waiting pills). Getting this one right propagates
  everywhere it's used — review it against brief section 13 (chips/status:
  "restrained colors with good contrast") before touching individual
  screens that consume it.

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
convention is to commit to `baseline/core-v1-backend`, then
`git checkout main && git merge baseline/core-v1-backend --no-ff && git push
origin main && git checkout baseline/core-v1-backend`, then verify CI via
`gh run list --limit 1 --repo <owner>/<repo>` until it shows
`completed`/`success`. Follow whatever the current repo convention is at
the time you pick this up — check recent commits first.
