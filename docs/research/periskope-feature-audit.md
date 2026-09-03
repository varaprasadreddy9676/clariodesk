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

## 2A. Second pass — deeper dig (Team roster, Config, notifications)

Requested explicitly as a follow-up before committing to a build list. Six
more screens, all previously unopened:

### 2A.1 Settings → Team — the roster explains the "signature" fully
The team roster is not real individual names — it's **role/shift personas
as actual member accounts**: "L1 Team" (`arunsiva.s@ubq.in`), "L2 Team"
(`arpitha.n@ubq.in`), "Functional Expert", "Clinical Team", "Implementation
Onboarding Team", "Inventory Team", etc. — each a distinct login, each
scoped to specific **Phones** and **Labels** columns (e.g. "Functional
Expert" can only see phones/labels tagged "Implementation"), and each with
a **Shift timings** column (actual weekly schedules, e.g. "M,T,W,T,F,S").

This resolves an open question from the first pass: the "*L1 Team:*"
message prefix isn't a dynamic per-message choice or a free-typed field —
it's simply **that logged-in member's configured display name**, combined
with a workspace-wide toggle (§2A.2). So a hospital-support org apparently
runs shared/role logins rather than one login per real person. **This
doesn't change the recommendation** — ClarioDesk's per-user signature
(shipped this session) already produces the identical visible result for a
workspace that names its users "L1 Team" / "L2 Team" instead of real
names, with less new surface area than replicating a shift-scoped
multi-persona roster. Worth doing later, cheaply: **default a new user's
signature to their `displayName` at creation** instead of leaving it
blank, so it works the same way out of the box.

The **shift-timings** column is the concrete, real evidence behind
PROGRESS.md's already-deferred "Coverage windows / temporary read-only
access" (P2) — confirmed valued, not urgent.

### 2A.2 Settings → Config — the one screen with real healthcare-compliance weight
A workspace-wide "Configuration" page, most of it low-priority
(experimental message translation, flag-lifecycle nuance) — but three
toggles matter specifically **because this account's chats are hospitals
talking about patients**:

- **"Show Sender Names"** (ON in this workspace) — confirms §2A.1: this is
  an admin-controlled, workspace-wide switch, not a per-message opt-in.
  Worth adding to ClarioDesk as a workspace-level admin default (auto-sign
  every reply when ON) layered on top of the existing per-message toggle,
  rather than replacing it.
- **"Mask User Phone Numbers"** — hides the customer's phone number from
  agents in the UI. Real privacy control for any team handling patient
  contact details.
- **"Media Privacy"** — org-scoped, expiring media links; "when disabled,
  anyone with a media link can access it." ClarioDesk's media URLs are
  already signed + permission-checked (an implicit yes here), but there's
  no admin-configurable expiry, and worth explicitly confirming they're
  never accessible outside the workspace.

None of these are hard to build (each is a boolean/short-lived-signed-URL
setting) and they're the only items in this entire audit that map directly
to handling real patient-adjacent data responsibly — arguably higher
priority than their "just a nice setting" framing suggests, given who
ClarioDesk's actual first user is.

### 2A.3 Settings → Custom Properties — real, but *unused* even here
A full custom-field builder (arbitrary structured fields on a Chat or
Ticket, grouped into sections). In this real, actively-used production
workspace: **zero properties have been configured.** This is useful
negative evidence — it's a real Periskope feature nobody bothered to set
up, unlike labels (3 defined, used on every row) or quick replies (4
defined, used constantly). **Recommendation: do not build this** — it's
exactly the kind of "impressive-sounding but unused" feature that would be
wasted effort right now.

### 2A.4 Settings → Group Settings — group creation templates
A "Group Templates" feature (e.g. a saved "New Customer" template with a
default participant set) so onboarding hospital #31 doesn't require
re-remembering which internal people to add every time. Real and in use
(one template configured, last updated). Minor, cheap enhancement to
ClarioDesk's existing `NewGroupDialog` whenever it's next touched — not
urgent on its own.

### 2A.5 Settings → Alerts & Notifications — assignment is a first-class notification
Granular per-event-type toggles: New Messages, New Private Note, **Ticket
Assignment, Task Assignment, Chat Assignment** (all on), plus separate
email-alert toggles (Broadcast Emails, Ticket Assignment Emails). The
existence of a dedicated **"Chat Assignment"** notification type is
further confirmation of recommendation #3 below (chat-level assignment) —
it's important enough in the real tool to have its own notification, not
just a ticket-level one. Otherwise this matches PROGRESS.md's already-
deferred "Notification preferences, quiet hours..." (P2) — confirmed
valued, no change to priority.

---

## 2B. Third pass — integrations, ticket automation, live interaction patterns

Requested again explicitly ("still explore in-depth... bigger and better
than Periskope"). This pass found the single biggest-leverage items in the
whole audit, in Settings → Tickets specifically.

### 2B.1 Settings → Tickets — the biggest find in this audit
All three toggles below are **enabled and in daily use** in the real
workspace:

- **Ticket prefix** — a configurable 3-letter prefix (`MW`), producing the
  human-readable `MWS-020` IDs seen throughout. ClarioDesk tickets have no
  display ID at all beyond a raw UUID. Trivial to add (a per-workspace
  prefix + a sequence), disproportionately improves how a ticket reads in
  conversation ("MW-1234" vs a UUID).
- **"Enable Automatic Ticket Attachment to Messages"** — when someone
  replies to a message that's already linked to a ticket, the reply is
  **automatically** attached to that same ticket. This directly and more
  elegantly solves the "attach to an existing ticket" gap flagged in the
  first pass (previously recommended as a manual ticket-picker menu item)
  — reply-thread detection does it for free, no extra click for the agent.
  **This should replace, not just supplement, recommendation #4 below.**
- **"Enable emoji-based ticketing"** — reacting to any message with a
  specific emoji (🏷️) instantly creates a ticket from it. ClarioDesk
  already has message reactions wired end-to-end (shipped earlier this
  session, verified live against the real WhatsApp account). Watching for
  one specific emoji reaction and creating a ticket from it is close to
  free to add on top of infrastructure that already exists — no new
  subsystem, just one more branch in the existing reaction handler.
- **"Send an automated message when a ticket is created"** — a templated
  confirmation (`Automated ticket raised by medicsSupport: {{ticket_id}}`)
  posted back into the chat automatically. Cheap, and closes the loop for
  the customer without an agent having to type it.

Together these four turn ticket creation from "an agent remembers to
right-click and fill a form" into "mostly automatic," which is a
materially different, better experience than what either ClarioDesk or a
naive Periskope-clone would have without them.

### 2B.2 Live interaction signals seen mid-conversation
Two things observed in a real, currently-heated support thread (a hospital
messaging "There's no response from your team" / "Creating bad situation
over here"):

- **Negative-sentiment messages get a distinct red-tinted bubble +
  red-flag icon**, automatically — this is the visible output of the
  "AI check for customer sentiments" automation rule seen earlier (§1.12).
  AI-dependent, so it correctly stays bundled with the already-deferred AI
  work — but the *visual treatment* (a distinct tint + icon for a
  flagged/urgent message, independent of how it got flagged) is worth
  building now as a generic "flagged message" style, ready for manual
  flagging today and AI-driven flagging later.
- **A live "`<Team>` is typing…" / "`<Team>` is active" indicator** shown
  directly above the composer, tied to presence in that specific chat —
  useful collision-avoidance so two agents don't both start answering the
  same urgent customer at once. ClarioDesk already has the Socket.io
  presence/realtime plumbing this would sit on top of; this is a small,
  additive UI feature on infrastructure that already exists, not a new
  subsystem.

Also seen: a **"Mark as Internal"** message-context-menu action, distinct
from Private Note — reclassifies visibility of an existing message rather
than composing a new internal one. Lower priority; Private Note already
covers the core need.

### 2B.3 Media, Scheduling, Integrations — mixed signal
- **Media Library** (top-level, not just per-chat): a gallery across all
  chats or filtered to one, with file-count/storage-size totals, filter,
  search, export. This directly matches PROGRESS.md's own already-known,
  already-planned gap ("Production timeline: ...media gallery..." listed
  as not-yet-done under Immediate pilot blockers) — this pass just
  confirms it with a concrete reference shape, doesn't newly discover it.
- **Scheduled Messages, including recurring sends** (a "Repeat" column in
  the scheduler) — this is almost certainly the real mechanism behind the
  "Hi Team, kindly find today's open ticket status update" message landing
  in 7+ hospital groups within 13 minutes flagged in the first read-only
  pass: a **recurring scheduled single-chat send**, not a bulk broadcast
  and not manual copy-paste. This is meaningfully lower-risk than the bulk
  broadcast feature already flagged (P3, do-not-build-yet) since it's one
  chat per scheduled item, not one blast to many recipients — it can
  extend ClarioDesk's existing outbox send-delay/cancel infrastructure
  rather than needing a new rate-limited multi-recipient sender. Worth
  separating from "bulk broadcast" in the roadmap: **recurring single-chat
  scheduled sends are a near-term-safe feature; multi-chat broadcast is
  not.**
- **Integrations (API keys, Webhooks, MCP, Zapier, HubSpot, Freshdesk,
  ZohoDesk, Zoho CRM, Google Sheets/Calendar)** — a full page each,
  **every single one unconfigured / zero keys generated** in this real,
  actively-used production workspace. Third piece of negative evidence in
  this audit (joining Custom Properties and Quick-Reply access-scoping
  from earlier passes): built, available, unused. **Do not prioritize
  building a matching suite of native CRM connectors.** Two exceptions
  worth calling out on strategic grounds rather than usage evidence:
  - **Outbound webhooks** (events → a signed HTTP callback) are generic
    infrastructure, not a specific CRM integration — and this exact
    customer *runs their own HIMS product*, so being able to pipe
    ClarioDesk ticket/message events into their own system is plausibly
    valuable even though this account hasn't set it up. Lower-cost than a
    bespoke connector: one webhook dispatcher + HMAC signing, reusing
    patterns ClarioDesk's inbound gateway-webhook code already has.
  - **An MCP server** is paywalled Pro/Enterprise-only in Periskope. Since
    ClarioDesk is explicitly building the open-source, give-it-to-the-
    community alternative, offering this for free is a genuine, on-brand
    differentiator (letting Claude or any MCP-aware agent read/act on a
    team's WhatsApp support inbox) — but it's a real build (a set of MCP
    tools wrapping the existing API), not a quick add. Worth roadmapping,
    not doing immediately.

---

## 3. Prioritized recommendation for ClarioDesk

Ranked by evidence-of-real-use ÷ implementation risk, using the same
P0–P4 scheme as `docs/PROGRESS.md`:

| # | Feature | Evidence it's real | Risk | Suggested priority |
|---|---------|--------------------|------|---------------------|
| 1 | **Ticket prefix + auto-attach-by-reply-thread + emoji-reaction ticketing + auto-confirmation message** (§2B.1, four small pieces, one theme: make ticket creation mostly automatic) | All four enabled and in daily use in the real workspace | Low — prefix is a counter, auto-attach is a reply-thread lookup, emoji-ticketing reuses reactions ClarioDesk already ships, confirmation reuses the outbox | **Do next — highest leverage-to-effort ratio in this whole audit** |
| 2 | **Chat/channel labels** (name+color, workspace-managed, shown as pills in `ChannelList` rows, filterable) | Visible on literally every row of the real inbox | Low — additive schema (`labels` + `channel_labels`), no send/WhatsApp risk | **Do next** |
| 3 | **Audit log viewer** (admin screen reading the existing `audit_logs` table) | Every serious tool in this audit has one; ClarioDesk already writes the data | Very low — pure read, zero business-logic risk | **Do next / can run alongside #1–2** |
| 4 | **Chat-level assignment** (assign a channel to a teammate, shown as an avatar in the list — not just ticket-level assignment) | Assignee avatar on every single inbox row; has its own dedicated notification type | Low-medium — reuses existing `channelAssignments` table, needs list UI + filter | High |
| 5 | **Privacy: mask customer phone numbers + confirm/expire media-link access** | Dedicated Config toggles in the real tool; this account's chats are hospitals discussing patients | Low — boolean setting + confirming existing signed-URL expiry, no new subsystem | High — healthcare-adjacent data, worth doing alongside #1–4, not after |
| 6 | **Recurring, single-chat scheduled sends** (extends the existing outbox send-delay/cancel infra with a future time + optional repeat) | Best explanation for the real daily 7-group status-update pattern found in the original read-only review | Low-medium — one chat per scheduled item, no multi-recipient fan-out, so materially safer than bulk broadcast | Medium-high — meaningfully lower risk than broadcast (#13), worth separating out and doing sooner |
| 7 | Generic "flagged message" visual treatment (distinct tint/icon), usable manually today and by AI-driven flagging later | Real in the product (§2B.2), currently AI-driven there | Low for the manual version — a boolean + a style, no AI dependency required to ship it now | Medium |
| 8 | Live "`<agent>` is viewing / typing" presence-in-chat indicator | Real, sits directly above the composer in production | Low-medium — ClarioDesk's Socket.io presence plumbing already exists, this is additive UI | Medium |
| 9 | Time-series + per-agent analytics (tickets closed, first-response time, active chats) | Whole dedicated Analytics section, actively referenced | Medium — needs aggregation queries/materialized views, more surface area | Medium (matches PROGRESS.md P2 "basic analytics", now confirmed valuable) |
| 10 | Tabular/bulk "Chat List" admin view (spreadsheet of all channels with bulk label/assign) | A whole separate nav item from the normal inbox | Medium — new view, but built on data ClarioDesk already has | Medium |
| 11 | Workspace-level media gallery (cross-chat, filterable, with export) | Confirms PROGRESS.md's own already-known, already-planned gap | Medium | Already tracked — no new priority needed, this pass just confirms it |
| 12 | Auto-generated ticket-status PDF/report | Explains the exact broadcast message pattern found in real usage | Medium — needs a PDF-generation step in the worker/API | Lower — nice-to-have, not blocking |
| 13 | Workspace-level "always sign outbound replies" admin toggle, layered on the per-message toggle already shipped | Confirmed as an org-wide default in the real tool, not per-message | Very low — one boolean read in the composer | Low-medium — cheap, do whenever back in that code |
| 14 | Quick-reply refinements: slash-command auto-trigger, per-reply access scoping | Both present but incremental over what already shipped | Low | Low — cheap follow-on whenever touching Quick Replies again |
| 15 | Group-creation templates (saved default participant sets) | One real template in active use | Low-medium — extends existing `NewGroupDialog` | Low — nice-to-have |
| 16 | Outbound webhooks (events → signed HTTP callback to a third-party system) | Generic infra, not usage-evidenced here, but this exact customer runs their own HIMS product that could consume it | Low-medium — one dispatcher + HMAC signing, mirrors patterns the inbound gateway-webhook code already has | Speculative-but-cheap — worth roadmapping given who the user is, not usage-driven |
| 17 | Open-source-only differentiator: a free MCP server wrapping the API | Paywalled Pro/Enterprise-only in Periskope; genuinely on-brand for an open-source Anthropic-ecosystem alternative | Medium — a real build (MCP tool surface over the existing API), not a quick add | Roadmap, not immediate |
| — | ~~Custom Properties~~ / ~~native CRM connectors (HubSpot, Freshdesk, ZohoDesk, Zoho CRM, Zapier, Google Sheets/Calendar)~~ | **Zero configured/connected even in this real, actively-used workspace** — three separate passes, same negative signal | — | **Do not build** — real features, unused even by their own users; wasted effort right now |
| 18 | Bulk broadcast messaging (multi-chat) | Actively used in production (daily status update to 7+ groups) | **High** — WhatsApp ban/spam risk without rate-limiting+jitter, already correctly flagged P3 in PROGRESS.md | Do not build yet — and now that #6 (recurring single-chat sends) is separated out, there's less pressure to build this at all |
| 19 | Automation rule builder | 2 live rules in production | **High** — a genuine rule engine, largest scope item here | Do not build yet (P2/P3, correctly deferred) |
| 20 | Granular per-action/per-screen RBAC + shift-scoped roster (phones/labels/schedule per member) | Full settings pages dedicated to both | **High** — replaces the entire fixed-role model | Do not build yet (P4, correctly deferred) |
| 21 | AI agent / sentiment auto-flagging | Paywalled even in the reference product | High, and explicitly out of scope | Do not build yet (P3, correctly deferred) |

**Bottom line:** the single best find across all three passes is #1 — four
small, cheap pieces of *ticket automation* (prefix, auto-thread-attach,
emoji-reaction ticketing, auto-confirmation) that together change ticket
creation from "an agent remembers to do it" to "mostly automatic," each
buildable on infrastructure ClarioDesk already has (reactions, outbox,
counters). Labels (#2) and the audit-log viewer (#3) remain the next
safest, most directly evidenced builds. #6 (recurring single-chat
scheduled sends) is a materially safer, separable slice of what looked
like "bulk broadcast" in the first pass — it deserves its own, sooner
slot rather than being lumped in with the genuinely risky multi-chat
broadcast feature (#18), which — along with the automation rule engine,
granular RBAC, and AI — remains correctly deferred per PROGRESS.md across
all three passes. Three independent passes turned up the same negative
signal for Custom Properties and every native CRM connector: built,
available, and unused even by the real team that has them — confidently
do not prioritize either.
