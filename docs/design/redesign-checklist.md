# ClarioDesk Apple/macOS-inspired redesign — progress checklist

Tracks the multi-session redesign requested 2026-09-03: bring the whole app to
one consistent "premium enterprise, Apple/macOS-inspired, Linear-precision"
design language, screen by screen, without changing functionality, workflows,
permissions, or business logic. Full brief: see the `/loop` command that
started this effort (also summarized in `docs/design/design-system.md`,
which this pass supersedes/refines where they conflict — this checklist's
token values win).

**Ground rules for every screen touched:**
- Preserve all fields, actions, navigation destinations, and business logic.
- No font size above what's specified below just to "look modern" — normal
  text stays 13–14px.
- Reuse the shared primitives (once built in Step 2/3) — don't hand-roll a
  new button/input/badge style per screen.
- Verify (typecheck/lint/vitest) after every screen, before moving to the
  next.

## Step 1 — Audit (done 2026-09-03)

**Screens** (`apps/web/src/App.tsx`):
- [x] Inbox shell (three-column: ChannelList / Timeline / ContextPanel)
- [ ] TicketsView
- [ ] SearchView
- [ ] PhonesView
- [ ] ClientsView
- [ ] TeamView
- [ ] ReportsView
- [ ] SettingsView

**Shared components** (`apps/web/src/components/`):
- [x] ChannelList.tsx — redone earlier today (virtualized, new row/avatar
      sizing, selected-state accent bar)
- [x] Timeline.tsx — redone earlier today (canvas bg, centered column,
      bubble radius/no-tail, sticker chrome, redundant status pill removed)
- [x] Composer.tsx — redone earlier today (floating card, segmented tabs,
      private-note tint)
- [ ] Sidebar.tsx (main left nav)
- [ ] OpsBar.tsx (top status bar) — partial: redundant status fixed, pill
      styling itself not yet reviewed against new token set
- [ ] ContextPanel.tsx
- [ ] NewChatDialog.tsx
- [ ] NewGroupDialog.tsx
- [ ] NotificationCenter.tsx
- [ ] StatusBadge.tsx (shared badge primitives)
- [ ] States.tsx (empty/loading/error primitives)
- [ ] Toast.tsx
- [ ] AttachmentTray.tsx
- [ ] EmojiPicker.tsx
- [ ] NewConversationFab.tsx

**Known duplicate/inconsistent patterns found in audit** (fix via shared
primitives in Step 3, not per-screen overrides):
- Multiple ad-hoc "empty state" markups across views instead of one
  `<EmptyState>` primitive.
- Button sizing/padding varies (`.primary-action`, `.secondary-action`,
  `.icon-button`, plus screen-local button styles) — needs one scale.
- Tables and table-like rows exist for Team, Phones, and Clients with
  differing row heights/header treatment.

## Step 2 — Global design tokens (`apps/web/src/styles.css` `:root`) — done 2026-09-03

- [x] Typography scale tokens added: `--text-page-title` (22px),
      `--text-section-heading` (17px), `--text-card-heading` (15px),
      `--text-body` (14px), `--text-body-secondary` (13px),
      `--text-label` (12px), `--text-meta` (11px). NOT yet retrofitted onto
      every existing hardcoded `font-size` in the file — that happens
      progressively as each screen is touched in Step 5+, not as a
      one-shot global find/replace (too risky to do blind).
- [x] Spacing tokens added: `--space-1` (4px) through `--space-8` (32px).
      Same caveat as above — existing ad-hoc pixel values get swapped in
      as each screen is revisited, not globally in one pass.
- [x] Radius scale — already matched the new spec exactly (xs 6 / sm 8 /
      md 12 / lg 16 / xl 20 / pill 999), no change needed.
- [x] Shadow scale — already subtle (`--shadow-card` / `--shadow-floating`),
      confirmed no heavier ad-hoc shadows in the reviewed portion so far.
- [x] Glass tokens added: `--glass-bg` / `--glass-border` / `--glass-blur`,
      with a dark-mode override (dark glass uses a dark base, not white).
- [x] Control-height tokens added: `--control-height-compact` (32px),
      `--control-height-default` (36px), `--control-height-comfortable`
      (40px). Not yet applied to every button/input — same progressive
      approach.
- [ ] Table tokens (header/row-height) — not yet defined; do this when
      Step 5 reaches the first real table (Team or Phones).

## Step 3 — Shared primitives (in progress)

- [ ] `<EmptyState>` (icon + short text + one action) — replace all ad-hoc
      empty markups.
- [ ] Unify button classes under one scale (primary/secondary/tertiary/
      destructive) at the new height/type tokens.
- [x] Segmented control primitive exists (built for the composer's
      WhatsApp/Private-Note switch) — reuse for other tab-like UIs (e.g.
      inbox view filters) when Step 5 reaches them, instead of building a
      second one.
- [ ] Table row primitive shared by Team/Phones/Clients.

## Step 4 — Shell/navigation — mostly done 2026-09-03

- [x] Sidebar.tsx nav-item: hover and active were visually identical (both
      `--brand-soft` tint) — a real usability gap, since hovering a
      different item looked the same as being on the current screen.
      Hover is now a neutral `--hover` tint; active keeps the brand tint
      plus `font-weight: 600` so the two are distinguishable. Icon sizing
      (17px), tooltips (`title` attr), and radius were already correct —
      no change needed there.
- [x] OpsBar.tsx: applied the frosted-glass treatment (`--glass-bg` +
      `backdrop-filter: blur(--glass-blur)`) — this is an explicitly-listed
      "appropriate" glass location (top nav / sticky header). Verified
      `backdrop-filter: blur(20px)` computes correctly in the live app.
- [ ] OpsBar pill styling (`.ops-item`, `.realtime-pill`) not yet reviewed
      against the new badge/chip conventions (section 13 of the brief) —
      still using pre-existing ad-hoc styling, not obviously wrong, just
      not yet re-verified against the new token set.

## Step 5 onward — remaining screens, then full consistency pass

Work through the unchecked screens above in roughly frequency order
(Tickets/Search likely highest-traffic after Inbox), then dialogs
(NewChatDialog/NewGroupDialog), then NotificationCenter, then a final
responsive check at 1366×768 / 1440×900 / 1920×1080 and an interaction-state
sweep (hover/active/selected/focus/disabled/loading/error/empty) across all
touched components.

## Session log

- 2026-09-03: Checklist created. Inbox shell (ChannelList/Timeline/Composer)
  already redone in a prior pass today per a separate, more specific design
  review — counts toward this effort since it matches the same direction
  (neutral canvas, restrained WhatsApp-green-as-accent, floating composer,
  no oversized type). Starting Step 2 (global tokens) next.
