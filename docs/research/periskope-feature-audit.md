# Periskope feature + design audit (for ClarioDesk gap analysis)

Conducted 2026-09-03 by walking the real `medics Support` production workspace
(read-only — no messages sent, per instruction) across 16 screens: Dashboard,
Chats/Inbox, Composer, Tickets (list + detail), Analytics (Team/Ticket
metrics), Chat List, Bulk Messages, Contacts, AI, Automation Rules, Logs, and
Settings (Preferences, Labels, Quick Replies, Permissions). This is the actual
tool the "medics" HIMS support desk currently runs on to manage ~30 hospital/
fertility-clinic WhatsApp groups, so its used features are strong signal for
what a real multi-client WhatsApp support desk needs — not generic inspiration.

Goal: identify what's genuinely worth building in ClarioDesk next, backed by
evidence of real usage, not a feature-parity checklist. Cross-referenced
against `docs/PROGRESS.md`'s existing priority scheme (P0–P4) throughout.

---

## 1. Screen-by-screen inventory

### 1.1 Dashboard
Workspace name/ID, three stat cards (All chats, Unread chats, **Flagged
chats**), a Team card (N of M online, colored initials avatars), a Tickets
card (Open count, Assigned-to-me count), and a Phone status card (number,
`+ Label` button, live Connected/Disconnected state, `···` menu, "Add phone").
One glance answers "is anything on fire right now."

**ClarioDesk equivalent:** `ReportsView` (ops summary) covers phone
health/unmapped/ticket counts but has no flagged-messages or online-team
concept, and phones aren't labelable.

### 1.2 Inbox / Chat list
Every row carries, inline, at all times:
- Colored **label pills** (e.g. "Support", "Implementation" — a chat can
  have several at once).
- An **assignee avatar** (or a stack of several, for multi-assignee chats).
- Read-tick state, last-message preview, phone number the chat is under.
- A row-level `···` menu.
- On the actively-open/hovered row, a strip of quick-action icons appeared:
  snooze, mark-resolved, external-link, urgent-flag.

**ClarioDesk equivalent (`ChannelList.tsx`):** avatar, title, preview,
timestamp, pin/mute/unread markers — no labels, no assignee visible in the
list (assignment only exists at the ticket level, not the chat level), no
per-row quick actions beyond the `···` menu already built this session.

### 1.3 Composer
Two tabs — **WhatsApp / Private Note** — identical split to what ClarioDesk
already built independently; strong validation. Toolbar (left→right):
attach, emoji, **translate** (🈺), **AI sparkle**, **voice-to-text**, a quick-
reply icon, a **schedule-send** (clock+calendar) icon, then on the far right
a phone-number selector for workspaces with multiple numbers. A persistent
status line above the input reads *"Sender name on — messages are prefixed
with '<Team Name>'. Click to send without it"* — this is the real-world
version of the reply-signature feature just shipped, except the prefix comes
from **which internal team you're currently switched into** (see §2.3),
not a free-typed personal field.

**ClarioDesk equivalent:** WhatsApp/Note tabs ✅, attach ✅, emoji ✅, quick
replies ✅ (shipped this session), signature ✅ (shipped this session, as a
per-user field rather than per-team). Missing: translate, AI assist (out of
scope — P3 per PROGRESS.md), voice-to-text, schedule-send, multi-phone
picker in the composer itself.

### 1.4 Message-level context menu (right-click)
`Info · React · Download · Pin · Create a Task · Create ticket · Attach to
Ticket · Flag message · Forward · Reply · Reply Privately · Attach to Team
Chat · Edit · Select`

**ClarioDesk equivalent:** reply, private note, create ticket, copy/copy-id,
refresh (per `docs/PROGRESS.md` §10). Real gaps: **attach an existing
message to an already-open ticket** (right now a new ticket is always
created fresh — there's no "add this message as more evidence on ticket
X"), **flag/pin a message** (no important-message marking at all), and
**Forward** (send a message's content into a different chat).

### 1.5 Tickets — list
`MWS-020 | Bliss IVF - medics Support` — sequential ID, linked chat name,
status dot (open=red/other=green), checkbox for bulk actions, assignee
avatar, **`+ Label`** (tickets have their own separate label set from
chats), a small icon linking back to the source chat, and an age indicator
("2 months", "3 months").

### 1.6 Tickets — detail
Opens the same conversation thread the ticket was created from, with an
auto-generated **PDF status report** visible in-thread (`Bliss IVF Open
Ticket Status Update.pdf` — a formatted one-pager listing bug IDs +
status + days-open, branded, clearly auto-generated not hand-typed). This
directly explains the "Hi Team, kindly find today's open ticket status
update" broadcast pattern found in the earlier read-only conversation
review — it's a **generated report attached to a message**, not manually
retyped text.

**ClarioDesk equivalent:** tickets have `title/status/priority/
firstResponseAt/closedAt` (deliberately minimal per TDD §6.15) — no
generated status-report artifact at all.

### 1.7 Analytics
Sub-nav: **Team analytics** (per-user table: active chats, messages sent,
chats initiated, tickets closed, responses-to-flagged, median first
response, user uptime), **Phone metrics**, **Chat metrics**, **Ticket
metrics** (stat cards for Total/Unresolved/Resolved/Unassigned/Avg
resolution time + a time-series chart of Unresolved/Created/Closed volume +
a per-user unresolved-tickets table), **Message metrics**, **Member
metrics**, and an **Exports → Data exports** section.

**ClarioDesk equivalent:** `GET /ops/summary` gives point-in-time counts
(phone health, unmapped channels, ticket/outbox counts, queue depth) — no
time-series, no per-agent breakdown, no CSV export. This is exactly
PROGRESS.md's deferred "Basic analytics and operational reporting" (P2),
now confirmed as real and actively used.

### 1.8 Chat List (separate from Inbox — a tabular/spreadsheet admin view)
Every chat as a **table row**: Chat Name, Labels, Assigned To, Last active,
Chat Type, Tickets/Tasks count, AI Settings — with checkboxes and a bulk
action bar (`Update Chats`, `Group Actions`, **`Upload Labels / Properties`**
— bulk CSV import, `Export`). This is the tool an admin uses to triage
30+ hospital groups at once instead of scrolling a chat-bubble list one at a
time.

**ClarioDesk equivalent:** none. `ChannelList` is chat-bubble style only;
there is no tabular, bulk-selectable, exportable view of channels anywhere.

### 1.9 Bulk Messages
A guarded 4-step wizard: **Select chats → Draft message → Fill variables →
Preview & send**, plus a phone-number selector and three ways to pick an
audience (manual multi-select, upload a number/chat-ID list, or a saved
chat list). Sub-nav: New bulk message, Scheduled messages, Message
templates, Broadcast lists, Logs, **Credit usage** (implies WhatsApp
Business API template-message billing per send).

Matches PROGRESS.md's explicitly-deferred "Bulk / jittered broadcast queue"
(P3) — confirmed real and valued, but I did not go further than viewing the
first step, in line with the "don't send anything" instruction. If this
ever gets built, the multi-step confirmation + explicit audience-selection
pattern here is the right shape to copy (never a one-click send-to-many).

### 1.10 Contacts
Table: Contact Name, Phone, **Labels** (a third, separate label namespace
from chats/tickets), WhatsApp Pushname, and an **Internal / External**
classification column — lets the team filter their own colleagues' numbers
out of "real customer" contact lists.

**ClarioDesk equivalent:** contacts endpoint exists (workspace contacts +
channel members) but no labels, no internal/external flag.

### 1.11 AI
Paywalled ("AI Agent is a Pro only feature — Upgrade to Pro"). Sub-nav
reveals the intended shape: AI Agent (Agent Settings, Personalization,
Knowledge Base, Self-Training, Built-in Tools, Custom Tools), AI Flagging
(Flagging Settings — the "important messages flagged automatically by an
AI" mentioned in the chat-overview empty state), General (Internal
Contacts, Logs, Analytics, Credit Usage).

Matches PROGRESS.md's P2/P3 "AI runtime" — confirmed correctly deferred;
even the reference product gates it behind a paid tier.

### 1.12 Automation Rules
A trigger → action rule builder, **in active use** (2 live rules seen):
"AI check for customer sentiments" (New Message Received → Flag/Unflag a
message) and "Auto-assign Team to Labeled Chats" (New Member Joined →
Assign chat to specific people). Clean card UI: rule name, Live/Paused
badge, edit/duplicate/pause/delete icons, "When this happens → Then do
this", last-updated-by audit line.

Matches PROGRESS.md's deferred "Automation rule builder + cooldowns"
(P2/P3) — real, valued, but a genuinely bigger build (a rule engine with
its own trigger/action vocabulary) than anything else in this audit;
correctly still deferred.

### 1.13 Logs
Group logs / API logs / Webhooks logs / Rules logs / Scheduled logs, each a
table: Operation, Success, Failed, Pending, Timestamp, Performed by, Log
ID. 7-day retention shown.

**This is the one item in this whole audit that's pure upside with near-zero
risk**: ClarioDesk already writes to an `audit_logs` table on every
sensitive action (confirmed working per PROGRESS.md — "Audit log writes on
sensitive actions — verified live") but there is **no screen anywhere to
read them**. The data exists; only the viewer is missing.

### 1.14 Settings
Tree: **Plans and Usage** (Manage Plans) · **User** (Preferences, Scheduled
Messages, Alerts & Notifications) · **Organization** (General, Config,
Permissions, Phones, Team, **Labels**, Tickets, **Quick Replies**, Custom
Properties, Media Library, Group Settings) · **Integrations** (API,
Webhooks, MCP, Zapier, Google Sheets, Google Calendar, HubSpot, Freshdesk,
ZohoDesk, Zoho CRM, …).

- **Preferences** page: left-nav/right-panel visibility toggles, light/dark
  theme, language (English/Español/Português), an "Ask AI Bubble" toggle,
  and a real, subtle UX decision exposed to the user — *"Sync unread count
  with WhatsApp"*: **Sync with phone** (shared across the team, matches
  provider truth) vs **Personal count only** (per-viewer, never marks read
  for teammates). Worth knowing this tradeoff exists; not obviously worth
  building a toggle for yet.
- **Labels** page: three tabs — **Chat / Ticket / Phone** — each its own
  independent label namespace. This workspace has exactly 3 chat labels:
  "Implementation", "KAM", "Support" (name + color + stable ID), with
  search, create, and per-row edit/delete. This is the cleanest, most
  directly reusable design in the whole audit.
- **Quick Replies** page: slash-command-style entries (`/WelcomeImpl`,
  `/issue Response`, `/CR Response`, `/Followup Response`), each with an
  **Access** column ("All members" — implying replies can be scoped to
  specific roles/people), edit/delete, and bulk select. ClarioDesk's
  just-shipped Quick Replies covers the core (title+body, shared,
  searchable) but not the slash-command auto-trigger or per-reply access
  scoping — both are cheap follow-ons, not urgent.
- **Permissions** page: a full per-role toggle matrix — six **Action
  Permissions** (Create Chats, Data Export, Archive/Close Chats, Assign
  Chats or Tickets, Update Labels, Delete Tickets) each a live on/off
  switch, plus a **Screens** checklist (Analytics, Bulk Messages, Contacts,
  Media, Phones, Labels, Tickets, Quick Replies, …) controlling per-role
  screen visibility. This is real, granular, admin-configurable RBAC —
  strictly bigger than ClarioDesk's fixed three-role model
  (admin/agent/viewer). Matches PROGRESS.md's "advanced RBAC" (P4);
  correctly out of scope for now, but the exact shape to build toward
  eventually.

---

## 2. Design-system observations

### 2.1 Visual language
Dark-mode-first (light mode also available, toggled in Preferences).
Left icon+label nav rail, single accent green (matches the WhatsApp-adjacent
brand), colored pill labels for categorization, colored circular
initials-avatars for people (consistent hashing → color, used everywhere:
chat rows, team lists, ticket assignees). Status conveyed by color +
icon together (never color alone) — e.g. ticket status dot is red/green
*and* has a distinct icon shape, flagged messages get a red flag icon, not
just a red tint.

### 2.2 Information density
Every list (chats, tickets, contacts) favors **one dense row per item**
with 2–4 pieces of live metadata inline (labels, assignee, status, age) —
never requiring a click-through just to know "is this handled and by
whom." ClarioDesk's own design-system doc already argues for this same
density; Periskope is a good proof it's the right call for this exact user
(a support agent triaging dozens of groups per shift).

### 2.3 Multi-team / multi-identity model
A left-nav footer shows the current context is switchable — this session
was in "medics Support" but "Billing & IT Team" also appeared as a
selectable context. Switching context appears to change which internal
team the composer signs replies as. This is a materially different design
from ClarioDesk's per-user signature (shipped this session): Periskope
scopes the "who are we replying as" identity to **a team the user is
currently acting as**, not to the individual agent. Worth knowing this
alternate model exists; not recommending a change — a per-user signature
is simpler and still solves the same real problem seen in the raw message
history.

### 2.4 Confirmation patterns for risky actions
The one send-many-messages flow (Bulk Messages) is gated behind an
explicit 4-step wizard with a mandatory audience-selection step before any
draft or send screen — never a single button that fires messages at
multiple chats. Worth keeping as the reference shape if/when ClarioDesk
ever builds broadcast (still correctly P3/deferred for now).

---

## 3. Prioritized recommendation for ClarioDesk

Ranked by evidence-of-real-use ÷ implementation risk, using the same
P0–P4 scheme as `docs/PROGRESS.md`:

| # | Feature | Evidence it's real | Risk | Suggested priority |
|---|---------|--------------------|------|---------------------|
| 1 | **Chat/channel labels** (name+color, workspace-managed, shown as pills in `ChannelList` rows, filterable) | Visible on literally every row of the real inbox | Low — additive schema (`labels` + `channel_labels`), no send/WhatsApp risk | **Do next** |
| 2 | **Audit log viewer** (admin screen reading the existing `audit_logs` table) | Every serious tool in this audit has one; ClarioDesk already writes the data | Very low — pure read, zero business-logic risk | **Do next / can run alongside #1** |
| 3 | **Chat-level assignment** (assign a channel to a teammate, shown as an avatar in the list — not just ticket-level assignment) | Assignee avatar on every single inbox row | Low-medium — reuses existing `channelAssignments` table, needs list UI + filter | High |
| 4 | Message flag/pin + "attach to an existing ticket" (vs. always creating new) | Explicit context-menu items in daily use | Low-medium — schema flag on messages + a ticket-picker instead of only "create" | Medium-high |
| 5 | Time-series + per-agent analytics (tickets closed, first-response time, active chats) | Whole dedicated Analytics section, actively referenced | Medium — needs aggregation queries/materialized views, more surface area | Medium (matches PROGRESS.md P2 "basic analytics", now confirmed valuable) |
| 6 | Tabular/bulk "Chat List" admin view (spreadsheet of all channels with bulk label/assign) | A whole separate nav item from the normal inbox | Medium — new view, but built on data ClarioDesk already has | Medium |
| 7 | Auto-generated ticket-status PDF/report | Explains the exact broadcast message pattern found in real usage | Medium — needs a PDF-generation step in the worker/API | Lower — nice-to-have, not blocking |
| 8 | Quick-reply refinements: slash-command auto-trigger, per-reply access scoping | Both present but incremental over what already shipped | Low | Low — cheap follow-on whenever touching Quick Replies again |
| 9 | Bulk broadcast messaging | Actively used in production (daily status update to 7+ groups) | **High** — WhatsApp ban/spam risk without rate-limiting+jitter, already correctly flagged P3 in PROGRESS.md | Do not build yet |
| 10 | Automation rule builder | 2 live rules in production | **High** — a genuine rule engine, largest scope item here | Do not build yet (P2/P3, correctly deferred) |
| 11 | Granular per-action/per-screen RBAC | Full settings page dedicated to it | **High** — replaces the entire fixed-role model | Do not build yet (P4, correctly deferred) |
| 12 | AI agent / auto-flagging | Paywalled even in the reference product | High, and explicitly out of scope | Do not build yet (P3, correctly deferred) |

**Bottom line:** items 1–2 are safe to build immediately (no send-risk,
small schema surface, directly evidenced). Item 3 is the natural next step
after labels since it reuses `channelAssignments` that already exists.
Items 9–12 are the biggest, riskiest, or most infrastructure-heavy asks
seen in the real tool, and PROGRESS.md was already correct to defer every
one of them — this audit found no reason to move any of them up.
