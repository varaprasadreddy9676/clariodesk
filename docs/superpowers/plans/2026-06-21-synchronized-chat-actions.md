# Synchronized Chat Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact chat context menu whose unread, pin, mute, and archive actions synchronize with WhatsApp and persist confirmed state safely in ClarioDesk.

**Architecture:** Extend provider-neutral gateway contracts and the owned Clario Gateway first, then expose provider-first channel commands through authenticated API endpoints. Persist independent pin/mute/read state, keep archive as channel lifecycle, and let the API own filtering/sorting while the React client uses the same deterministic comparator after realtime refresh.

**Tech Stack:** TypeScript, whatsapp-web.js, NestJS, Drizzle/PostgreSQL, React, Socket.IO, Zod, Vitest, Playwright.

---

## File Map

- `packages/db/src/schema/channel.ts`: channel pin/mute state.
- `packages/db/src/schema/access.ts`: per-user marked-unread state.
- `packages/schemas/src/index.ts`: discriminated action and read-state contracts.
- `packages/gateway-adapters/src/interface.ts`: provider-neutral chat metadata/action contracts.
- `packages/gateway-adapters/src/adapters/clario-gateway.ts`: owned gateway HTTP transport.
- `packages/gateway-adapters/src/adapters/evolution.ts`: explicit unsupported capability flags.
- `packages/gateway-adapters/src/adapters/openwa.ts`: explicit unsupported capability flags.
- `apps/gateway/src/session-manager.ts`: whatsapp-web.js chat operations.
- `apps/gateway/src/index.ts`: gateway metadata/action routes.
- `apps/api/src/channels/channels.controller.ts`: channel action, read-state, refresh, and archived-list endpoints.
- `apps/api/src/channels/channels.service.ts`: provider-first persistence and authoritative list sorting.
- `apps/api/src/channels/channels.module.ts`: import bounded message synchronization.
- `apps/api/src/messages/messages.module.ts`: export `MessagesService` for scoped refresh.
- `apps/web/src/api.ts`: browser API calls with bounded action timeout.
- `apps/web/src/types.ts`: explicit provider and chat-state fields.
- `apps/web/src/lib/whatsapp-sort.ts`: deterministic pin/activity/ID ordering.
- `apps/web/src/components/ChannelList.tsx`: Archived view and mute/pin indicators.
- `apps/web/src/App.tsx`: dynamic menu actions, refresh, read-state clearing, and realtime reconciliation.
- `apps/web/src/styles.css`: compact menu and row indicators.

### Task 1: Add independent channel and per-user state

**Files:**
- Modify: `packages/db/src/schema/channel.ts`
- Modify: `packages/db/src/schema/access.ts`
- Modify: `packages/schemas/src/index.ts`
- Create: `packages/schemas/src/channel-actions.test.ts`
- Create: generated Drizzle migration after schema build

- [ ] **Step 1: Write failing schema tests**

```ts
expect(channelActionSchema.parse({ action: "pin", pinned: true })).toEqual({
  action: "pin",
  pinned: true,
});
expect(channelActionSchema.safeParse({ action: "pin", muted: true }).success)
  .toBe(false);
expect(updateReadStateSchema.parse({ markedUnread: false })).toEqual({
  markedUnread: false,
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- packages/schemas/src/channel-actions.test.ts --run`

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Add exact Zod contracts**

```ts
export const channelActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_unread"), markedUnread: z.literal(true) }),
  z.object({ action: z.literal("pin"), pinned: z.boolean() }),
  z.object({ action: z.literal("mute"), muted: z.boolean() }),
  z.object({ action: z.literal("archive"), archived: z.boolean() }),
]);
export const updateReadStateSchema = z.object({ markedUnread: z.literal(false) });
```

- [ ] **Step 4: Add database fields and safe legacy backfill**

Add `channels.isPinned` and `channels.isMuted` as non-null booleans defaulting false. Add `userChannelReadState.isMarkedUnread` as a non-null boolean defaulting false. Generate a migration that runs this data correction after adding columns:

```sql
UPDATE channels
SET is_muted = true,
    status = CASE WHEN channel_type = 'direct' THEN 'active'::channel_status
                  ELSE 'unmapped'::channel_status END
WHERE status = 'muted'::channel_status;
```

Retain the Postgres `muted` enum member; no application path writes it afterward.

- [ ] **Step 5: Generate migration and verify GREEN**

Run:

```bash
npm run -w @clariodesk/db build
npm run db:generate
npm test -- packages/schemas/src/channel-actions.test.ts --run
```

Expected: migration generated and schema tests pass.

### Task 2: Implement provider chat metadata and target-state operations

**Files:**
- Modify: `packages/gateway-adapters/src/interface.ts`
- Modify: `packages/gateway-adapters/src/adapters/clario-gateway.ts`
- Modify: `packages/gateway-adapters/src/adapters/clario-gateway.test.ts`
- Modify: `apps/gateway/src/session-manager.ts`
- Modify: `apps/gateway/src/session-manager.test.ts`
- Modify: `apps/gateway/src/index.ts`

- [ ] **Step 1: Write failing adapter contract tests**

Assert `fetchChat` calls `GET /sessions/phone-1/chats/:chatId` and `setChatState` calls `POST /sessions/phone-1/chats/:chatId/actions` with target-state bodies. Cover pin, mute, archive, and mark-unread responses.

```ts
await adapter.setChatState({
  providerInstanceId: "phone-1",
  providerChatId: "120363@g.us",
  action: "pin",
  pinned: true,
});
```

- [ ] **Step 2: Run adapter tests and verify RED**

Run: `npm test -- packages/gateway-adapters/src/adapters/clario-gateway.test.ts --run`

Expected: FAIL because `fetchChat` and `setChatState` are absent.

- [ ] **Step 3: Extend provider-neutral contracts**

Add `isPinned`, `isMuted`, and `isArchived` to `GatewayChat`; define a discriminated `SetChatStateInput`; add optional `fetchChat` and `setChatState` methods; mark the four new state capabilities in `GatewayCapabilities`. Set those capability fields to false in Evolution/OpenWA reference adapters so every implementation compiles without exposing unsupported runtime actions.

- [ ] **Step 4: Write failing session tests**

Use the existing ready-session test helper and fake chat methods:

```ts
await session.setChatState("120363@g.us", { action: "mute", muted: true });
expect(chat.mute).toHaveBeenCalledOnce();
expect(chat.unmute).not.toHaveBeenCalled();
```

Test target-state idempotency, archive/unarchive, pin/unpin, markUnread, missing methods, and confirmed metadata.

- [ ] **Step 5: Implement session methods and gateway routes**

Load the chat with `getChatById`, compare current state, call only the method needed to reach the target, and return normalized metadata. Expose:

```text
GET  /sessions/:id/chats/:chatId
POST /sessions/:id/chats/:chatId/actions
```

Wrap state operations in a 20-second timeout that rejects with `WhatsApp did not confirm this change`.

- [ ] **Step 6: Run gateway tests and builds**

Run:

```bash
npm test -- apps/gateway/src/session-manager.test.ts packages/gateway-adapters/src/adapters/clario-gateway.test.ts --run
npm run -w @clariodesk/gateway build
npm run -w @clariodesk/gateway-adapters build
```

Expected: targeted tests and builds pass.

### Task 3: Implement authenticated channel commands and scoped refresh

**Files:**
- Modify: `apps/api/src/channels/channels.controller.ts`
- Modify: `apps/api/src/channels/channels.service.ts`
- Modify: `apps/api/src/channels/channels.service.itest.ts`
- Modify: `apps/api/src/channels/channels.module.ts`
- Modify: `apps/api/src/messages/messages.module.ts`
- Modify: `packages/events/src/index.ts`

- [ ] **Step 1: Write failing API integration tests**

Cover:

```ts
adapter.setChatState.mockRejectedValueOnce(new Error("provider unavailable"));
await expect(
  service.applyAction(admin, channelId, { action: "pin", pinned: true }),
).rejects.toThrow("provider unavailable");
const [unchanged] = await db
  .select({ isPinned: schema.channels.isPinned })
  .from(schema.channels)
  .where(eq(schema.channels.id, channelId));
expect(unchanged?.isPinned).toBe(false);
```

Also prove provider failure leaves local state unchanged, viewers cannot mutate, viewers can refresh and clear their own marker, archive filtering works, pin sorting is deterministic, unread rows are user-scoped, and legacy muted rows remain replyable.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm run test:integration -- apps/api/src/channels/channels.service.itest.ts`

Expected: FAIL because the methods and fields are absent.

- [ ] **Step 3: Add exact controller routes**

```text
POST  /channels/:channelId/actions
PATCH /channels/:channelId/read-state
POST  /channels/:channelId/refresh
GET   /channels?view=archived
```

Use shared Zod pipes for request bodies and preserve existing JWT/channel-access guards.

- [ ] **Step 4: Implement provider-first state persistence**

For pin, mute, archive, and mark-unread: load the workspace-scoped channel and phone; reject viewers; require a ready phone; call `adapter.setChatState`; persist only after confirmation; audit; publish `channel.updated`. Upsert `user_channel_read_state` for unread. Return `{ channelId, status, isPinned, isMuted, isMarkedUnread }`.

- [ ] **Step 5: Implement read-state clear and refresh**

`updateReadState` verifies channel access and upserts `{ isMarkedUnread: false }`, then publishes user-scoped `channel.read_state_changed`. Export `MessagesService` from `MessagesModule`, import that module in `ChannelsModule`, and inject it into `ChannelsService`. `refreshChannel` calls `fetchChat` plus `MessagesService.syncMessages(user, channelId, 50)`, reconciles metadata/state, and returns `{ acceptedMessages, metadataChanged }`.

- [ ] **Step 6: Implement authoritative list filtering and sorting**

Join the current user's read-state row. Default list excludes archived; `view=archived` returns only archived. Select provider ID and all state fields. Order by `isPinned DESC`, `lastMessageAt DESC NULLS LAST`, `channels.id ASC`.

- [ ] **Step 7: Run API integration tests and build**

Run:

```bash
npm run test:integration -- apps/api/src/channels/channels.service.itest.ts
npm run -w @clariodesk/api build
```

Expected: targeted integration tests and API build pass.

### Task 4: Build the compact functional menu and filters

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/lib/whatsapp-sort.ts`
- Modify: `apps/web/src/lib/whatsapp-sort.test.ts`
- Modify: `apps/web/src/components/ChannelList.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write failing client sorting/filter tests**

```ts
expect(sortChannelsLikeWhatsApp([recent, pinnedOlder])).toEqual([
  pinnedOlder,
  recent,
]);
```

Test the stable ID tie-breaker and archived/unread filter predicates.

- [ ] **Step 2: Run web tests and verify RED**

Run: `npm test -- apps/web/src/lib/whatsapp-sort.test.ts --run`

Expected: FAIL because pin partitioning and new fields are absent.

- [ ] **Step 3: Extend API client and UI models**

Add `providerChatId`, `isPinned`, `isMuted`, and `isMarkedUnread`. Add client methods for action, read-state clear, refresh, and `channels("archived")`. State-action requests use a 25-second `AbortController` timeout and convert aborts to the exact confirmation error.

- [ ] **Step 4: Implement dynamic menu actions**

Render only functional actions with target-state labels: Mark as unread, Pin/Unpin, Mute/Unmute, Archive/Unarchive, Refresh, Copy title, Copy WhatsApp ID, and Copy ClarioDesk ID. Use provider-confirmed API responses, disable duplicate action submission by closing the menu immediately, show errors through the existing toast, and refresh channels after success or timeout reconciliation.

- [ ] **Step 5: Implement filters, sorting, and row indicators**

Add Archived to `ChannelView`. Request archived rows only for that view. Treat `isMarkedUnread` as at least one unread badge for the current UI. Show small Pin and VolumeX icons without shifting row dimensions. Clear local marked-unread only after timeline data resolves for the selected channel.

- [ ] **Step 6: Correct mute reply behavior**

Remove `status === muted` from composer and filter reply blocking. Archived status controls list visibility only and does not masquerade as mute in UI conversion.

- [ ] **Step 7: Run web tests and production build**

Run:

```bash
npm test -- apps/web/src --run
npm run -w @clariodesk/web build
```

Expected: web tests and production build pass.

### Task 5: Migrate, verify, and document

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Apply the generated migration locally**

Run: `npm run db:migrate`

Expected: migration succeeds and no channel retains `status = muted`.

- [ ] **Step 2: Run complete automated verification**

```bash
npm test -- --run
npm run test:integration
npm run build
git diff --check
```

Expected: zero failures and a clean diff check.

- [ ] **Step 3: Restart API, worker, and gateway**

Use the existing runtime commands, restore the persisted `clario-support` session, and verify API/gateway health before browser testing.

- [ ] **Step 4: Run desktop and mobile browser verification**

At 1440x900 and 390x844, verify menu positioning, dynamic labels, copy commands, refresh, filters, pin sorting, mute indicator, archived visibility, keyboard dismissal, no horizontal overflow, and no console errors. Do not mutate the linked WhatsApp account during browser automation.

- [ ] **Step 5: Run approved live provider verification**

After the user names an approved test chat, record its original states; exercise unread, pin, mute, and archive one at a time; confirm WhatsApp and ClarioDesk agree; then restore the original states. Do not perform this step against an arbitrary personal or customer chat.

- [ ] **Step 6: Update progress accurately**

Record automated-tested implementation separately from live-provider verification. Keep live verification pending until Step 5 is performed with an approved chat.
