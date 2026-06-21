# Compact Composer and New Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact WhatsApp-style composer with real emoji and attachment sending, plus a FAB that creates real WhatsApp direct chats and groups through Clario Gateway.

**Architecture:** Extend the gateway adapter contract with number validation and group creation, expose those operations only through authenticated workspace API commands, and reuse the outbox worker for text and media delivery. The web application composes these commands through focused components and reconciles created channels through existing realtime events and targeted refreshes.

**Tech Stack:** TypeScript, React, NestJS, whatsapp-web.js, Drizzle/PostgreSQL, BullMQ, Socket.IO, Zod, Vitest, Playwright.

---

## File Map

- `packages/gateway-adapters/src/interface.ts`: provider-neutral conversation capability contracts.
- `packages/gateway-adapters/src/adapters/clario-gateway.ts`: HTTP client for owned gateway operations.
- `packages/gateway-adapters/src/adapters/clario-gateway.test.ts`: adapter request/response contract tests.
- `apps/gateway/src/session-manager.ts`: whatsapp-web.js number validation and group creation.
- `apps/gateway/src/index.ts`: owned gateway HTTP routes and request validation.
- `packages/schemas/src/index.ts`: shared command schemas for direct chats, groups, and media.
- `apps/api/src/conversations/*`: authenticated conversation command boundary.
- `apps/api/src/outbox/*`: text/media outbox creation and idempotency.
- `apps/worker/src/processors/outbox-send.processor.ts`: dispatch text or media based on outbox type.
- `apps/web/src/components/Composer.tsx`: compact composer state and submission.
- `apps/web/src/components/EmojiPicker.tsx`: accessible emoji selection.
- `apps/web/src/components/AttachmentTray.tsx`: pending attachment validation and preview.
- `apps/web/src/components/NewConversationFab.tsx`: FAB and accessible action menu.
- `apps/web/src/components/NewChatDialog.tsx`: direct-chat creation form.
- `apps/web/src/components/NewGroupDialog.tsx`: group creation form.
- `apps/web/src/api.ts`: multipart and conversation command clients.
- `apps/web/src/App.tsx`: workflow orchestration and active-channel reconciliation.
- `apps/web/src/styles.css`: compact responsive composer, FAB, menu, and dialogs.

### Task 1: Extend the gateway capability contract

**Files:**
- Modify: `packages/gateway-adapters/src/interface.ts`
- Modify: `packages/gateway-adapters/src/adapters/clario-gateway.ts`
- Test: `packages/gateway-adapters/src/adapters/clario-gateway.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Add tests asserting these exact calls:

```ts
await adapter.resolveNumber({
  providerInstanceId: "phone-1",
  phoneNumber: "+91 98765 43210",
});
// POST /sessions/phone-1/contacts/resolve
// body: { phoneNumber: "+91 98765 43210" }

await adapter.createGroup({
  providerInstanceId: "phone-1",
  title: "Acme Support",
  participantIds: ["919876543210@c.us"],
});
// POST /sessions/phone-1/groups
```

Assert normalized results `{ registered, providerContactId }` and `{ providerChatId }`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- packages/gateway-adapters/src/adapters/clario-gateway.test.ts --run`

Expected: TypeScript/runtime failure because `resolveNumber` and `createGroup` do not exist.

- [ ] **Step 3: Add provider-neutral types and methods**

```ts
export type ResolveNumberInput = {
  providerInstanceId: string;
  phoneNumber: string;
};
export type ResolveNumberResult = {
  registered: boolean;
  providerContactId: string | null;
};
export type CreateGroupInput = {
  providerInstanceId: string;
  title: string;
  participantIds: string[];
};
export type CreateGroupResult = { providerChatId: string };
```

Add optional `resolveNumber` and `createGroup` methods to `WhatsAppGatewayAdapter`; implement both in `ClarioGatewayAdapter` using its existing authenticated request helper.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- packages/gateway-adapters/src/adapters/clario-gateway.test.ts --run`

Expected: all Clario gateway adapter tests pass.

- [ ] **Step 5: Commit the contract slice**

```bash
git add packages/gateway-adapters/src/interface.ts packages/gateway-adapters/src/adapters/clario-gateway.ts packages/gateway-adapters/src/adapters/clario-gateway.test.ts
git commit -m "feat: add gateway conversation commands"
```

### Task 2: Implement real Clario Gateway conversation operations

**Files:**
- Modify: `apps/gateway/src/session-manager.ts`
- Modify: `apps/gateway/src/index.ts`
- Create: `apps/gateway/src/session-manager.test.ts`

- [ ] **Step 1: Write failing session tests**

Use a mocked whatsapp-web.js client only at the provider boundary and assert:

```ts
expect(await session.resolveNumber("+91 98765 43210")).toEqual({
  registered: true,
  providerContactId: "919876543210@c.us",
});

expect(await session.createGroup("Acme Support", ["919876543210@c.us"]))
  .toEqual({ providerChatId: "120363000000@g.us" });
```

Cover unregistered number, disconnected session, provider object/string group IDs, and provider group-creation failure.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- apps/gateway/src/session-manager.test.ts --run`

Expected: failure because the session methods do not exist.

- [ ] **Step 3: Implement session methods and routes**

Implement `resolveNumber` with `client.getNumberId(normalizedDigits)` and `createGroup` with `client.createGroup(title, participantIds)`. Normalize the provider result to one `providerChatId` and reject an empty participant array.

Expose:

```text
POST /sessions/:id/contacts/resolve
POST /sessions/:id/groups
```

Use the existing `requireObject`, `requiredString`, and API-key middleware. Return structured `400`, `409`, and `503` responses through the gateway error handler without logging full phone numbers.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- apps/gateway/src/session-manager.test.ts --run`

Expected: all session-manager tests pass.

- [ ] **Step 5: Commit the gateway slice**

```bash
git add apps/gateway/src/session-manager.ts apps/gateway/src/index.ts apps/gateway/src/session-manager.test.ts
git commit -m "feat: create WhatsApp chats and groups in gateway"
```

### Task 3: Add shared API schemas and conversation module

**Files:**
- Modify: `packages/schemas/src/index.ts`
- Create: `apps/api/src/conversations/conversations.controller.ts`
- Create: `apps/api/src/conversations/conversations.service.ts`
- Create: `apps/api/src/conversations/conversations.module.ts`
- Create: `apps/api/src/conversations/conversations.service.itest.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing integration tests**

Test authenticated commands using real test database rows and a fake gateway adapter:

```ts
const direct = await service.createDirect(user, {
  phoneInstanceId,
  phoneNumber: "+919876543210",
  initialMessage: "Hello",
  idempotencyKey: "direct-1",
});
expect(direct.channelId).toEqual(expect.any(String));

const group = await service.createGroup(user, {
  phoneInstanceId,
  title: "Acme Support",
  participantPhoneNumbers: ["+919876543210"],
  initialMessage: "Welcome",
  idempotencyKey: "group-1",
});
expect(group.providerChatId).toBe("120363000000@g.us");
```

Cover viewer denial, cross-workspace phone denial, unregistered contacts, duplicate idempotency key, invalid participant reporting, audit creation, and `channel.updated` realtime publication.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:integration -- apps/api/src/conversations/conversations.service.itest.ts`

Expected: failure because the conversation module is absent.

- [ ] **Step 3: Add exact shared schemas**

```ts
const e164Phone = z.string().trim().regex(/^\+[1-9]\d{6,14}$/);

export const createDirectConversationSchema = z.object({
  phoneInstanceId: z.string().uuid(),
  phoneNumber: e164Phone,
  initialMessage: z.string().trim().min(1).max(4096),
  idempotencyKey: z.string().uuid(),
});

export const createGroupConversationSchema = z.object({
  phoneInstanceId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  participantPhoneNumbers: z.array(e164Phone).min(1).max(50),
  initialMessage: z.string().trim().max(4096).optional(),
  idempotencyKey: z.string().uuid(),
});
```

- [ ] **Step 4: Implement authenticated commands**

Expose:

```text
POST /conversations/direct
POST /conversations/groups
```

The service must verify role and phone ownership, decrypt adapter settings through the existing adapter factory, resolve numbers, create/import the channel, queue the initial text through `OutboxService`, audit the action, publish `channel.updated`, and return `{ channelId, providerChatId, outboxId }`. Add `idempotencyKey` to `outboxMessages` with a unique `(workspaceId, idempotencyKey)` index; repeated commands return the existing channel/outbox result without invoking the provider again.

- [ ] **Step 5: Run integration tests and verify GREEN**

Run: `npm run test:integration -- apps/api/src/conversations/conversations.service.itest.ts`

Expected: all conversation service integration tests pass.

- [ ] **Step 6: Commit the API conversation slice**

```bash
git add packages/schemas/src/index.ts apps/api/src/conversations apps/api/src/app.module.ts packages/db
git commit -m "feat: add authenticated conversation creation"
```

### Task 4: Route outbound attachments through the outbox

**Files:**
- Modify: `packages/schemas/src/index.ts`
- Modify: `apps/api/src/outbox/outbox.controller.ts`
- Modify: `apps/api/src/outbox/outbox.service.ts`
- Modify: `apps/api/src/outbox/outbox.service.itest.ts`
- Modify: `apps/worker/src/processors/outbox-send.processor.ts`
- Create: `apps/worker/src/processors/outbox-send.processor.test.ts`
- Modify: `packages/db/src/schema/messages.ts`
- Create: `packages/db/drizzle/0006_outbound_media.sql`

- [ ] **Step 1: Write failing API and worker tests**

Assert that a validated upload creates a `messageType: "media"` outbox row with storage metadata and that the worker calls:

```ts
adapter.sendMedia({
  providerInstanceId,
  providerChatId,
  mediaBase64: expect.any(String),
  mimeType: "image/png",
  fileName: "screenshot.png",
  caption: "See attached",
});
```

Cover unsupported MIME, files above the configured limit, workspace isolation, send failure, and successful message/media persistence.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:integration -- apps/api/src/outbox/outbox.service.itest.ts && npm test -- apps/worker/src/processors/outbox-send.processor.test.ts --run`

Expected: failure because outbound media metadata and dispatch do not exist.

- [ ] **Step 3: Add outbound media persistence and multipart endpoint**

Make `messageMedia.messageId` nullable while an outbound upload is pending, add `outboxMessages.idempotencyKey` with a unique workspace index, and continue using the existing `outboxMessages.mediaId`. Add `POST /outbox/media` using Nest multipart interception with a bounded in-memory upload, content-derived MIME validation, sanitized file names, object storage upload, and the same channel/role/policy checks as text outbox creation. The API creates a pending `messageMedia` row, stores its ID on the outbox row, and never duplicates raw media metadata on the outbox table.

- [ ] **Step 4: Dispatch media in the worker**

Branch on `outbox.messageType`. Load the pending media row through `outbox.mediaId`, read the object from storage, enforce the limit again, call `sendMedia`, persist the outbound message, attach its ID to the existing media row, update channel activity, and publish the same message/outbox realtime events as text.

- [ ] **Step 5: Run API and worker tests and verify GREEN**

Run: `npm run test:integration -- apps/api/src/outbox/outbox.service.itest.ts && npm test -- apps/worker/src/processors/outbox-send.processor.test.ts --run`

Expected: all targeted tests pass.

- [ ] **Step 6: Commit the media pipeline slice**

```bash
git add packages/schemas/src/index.ts apps/api/src/outbox apps/worker/src/processors/outbox-send.processor.ts apps/worker/src/processors/outbox-send.processor.test.ts packages/db
git commit -m "feat: send attachments through outbox"
```

### Task 5: Build and test compact composer primitives

**Files:**
- Create: `apps/web/src/components/EmojiPicker.tsx`
- Create: `apps/web/src/components/AttachmentTray.tsx`
- Create: `apps/web/src/components/Composer.test.tsx`
- Modify: `apps/web/src/components/Composer.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write failing component tests**

Using the existing Vitest DOM setup or adding Testing Library if absent, verify:

```ts
it("sends on Enter and inserts a newline on Shift+Enter", ...);
it("inserts an emoji at the caret and restores focus", ...);
it("shows and removes a validated attachment", ...);
it("shows no attachment control in Private Note mode", ...);
it("prevents duplicate submission while sending", ...);
```

Also assert the send control has `aria-label="Send WhatsApp message"` and contains no visible “Send to WhatsApp” text.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- apps/web/src/components/Composer.test.tsx --run`

Expected: failures for missing compact controls and components.

- [ ] **Step 3: Implement focused components**

Change the composer callback to:

```ts
onSendReply: (input: { body: string; attachment?: File }) => Promise<void>;
```

Implement tab labels `WhatsApp` and `Private Note`, a bounded auto-growing textarea, caret-aware emoji insertion, one-file attachment validation, removable attachment tray, icon-only send button, inline live-region status, and Enter/Shift+Enter behavior. Use only Lucide icons, existing tokens, tooltips, and compact radii.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm test -- apps/web/src/components/Composer.test.tsx --run`

Expected: all composer tests pass.

- [ ] **Step 5: Commit the compact composer slice**

```bash
git add apps/web/src/components/Composer.tsx apps/web/src/components/Composer.test.tsx apps/web/src/components/EmojiPicker.tsx apps/web/src/components/AttachmentTray.tsx apps/web/src/styles.css
git commit -m "feat: add compact WhatsApp composer"
```

### Task 6: Build and test the new-conversation FAB and dialogs

**Files:**
- Create: `apps/web/src/components/NewConversationFab.tsx`
- Create: `apps/web/src/components/NewChatDialog.tsx`
- Create: `apps/web/src/components/NewGroupDialog.tsx`
- Create: `apps/web/src/components/NewConversationFab.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write failing interaction tests**

Verify menu opening, keyboard navigation, Escape/outside-click closing, focus restoration, direct-chat required initial message and optional attachment, group participant validation, server error preservation, and disabled double submission.

```ts
expect(screen.getByRole("menuitem", { name: "New chat" })).toBeVisible();
expect(screen.getByRole("menuitem", { name: "New group" })).toBeVisible();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- apps/web/src/components/NewConversationFab.test.tsx --run`

Expected: failure because FAB and dialogs do not exist.

- [ ] **Step 3: Implement FAB, menu, and dialogs**

Build a 48px circular FAB with a `MessageCirclePlus` icon, compact menu, semantic dialog forms, E.164 helper text, route selector only when multiple connected phones exist, participant rows with add/remove controls, and accessible loading/error feedback. Do not include unavailable controls.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm test -- apps/web/src/components/NewConversationFab.test.tsx --run`

Expected: all FAB/dialog tests pass.

- [ ] **Step 5: Commit the FAB slice**

```bash
git add apps/web/src/components/NewConversationFab.tsx apps/web/src/components/NewChatDialog.tsx apps/web/src/components/NewGroupDialog.tsx apps/web/src/components/NewConversationFab.test.tsx apps/web/src/styles.css
git commit -m "feat: add new conversation actions"
```

### Task 7: Wire frontend commands and realtime reconciliation

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/realtime.ts`
- Test: `apps/web/src/components/Composer.test.tsx`
- Test: `apps/web/src/components/NewConversationFab.test.tsx`

- [ ] **Step 1: Write failing API client tests or request assertions**

Assert JSON calls for direct/group creation and multipart form fields for media send. Assert successful creation refreshes channels, selects the returned `channelId`, and closes the dialog only after success.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- apps/web/src --run`

Expected: failure because API methods and orchestration are absent.

- [ ] **Step 3: Implement API and application wiring**

Add:

```ts
createDirectConversation(input): Promise<CreatedConversation>
createGroupConversation(input): Promise<CreatedConversation>
sendMedia(input: { channelId: string; body: string; file: File }): Promise<OutboxResult>
```

Use `crypto.randomUUID()` for idempotency keys. In `App.tsx`, send text through the existing method, media through multipart, notes through the note endpoint, and refresh/select returned channels. For New chat with an attachment, create the direct conversation with its required text first, then queue the attachment against the returned channel using a second idempotency key while keeping the dialog open until both requests succeed. On `channel.updated` or `message.received`, refresh only relevant queries and retain WhatsApp activity ordering.

- [ ] **Step 4: Run web tests and verify GREEN**

Run: `npm test -- apps/web/src --run`

Expected: all web tests pass.

- [ ] **Step 5: Commit the integration slice**

```bash
git add apps/web/src/api.ts apps/web/src/types.ts apps/web/src/App.tsx apps/web/src/realtime.ts apps/web/src/components
git commit -m "feat: connect composer and conversation workflows"
```

### Task 8: End-to-end verification and documentation

**Files:**
- Modify: `PROGRESS.md`
- Modify: `whatsapp_group_operations_platform_functional_requirements_v4_priority_tagged.md`
- Modify: `whatsapp_group_operations_platform_technical_design.md`

- [ ] **Step 1: Run all automated verification**

```bash
npm test -- --run
npm run test:integration
npm run -w @clariodesk/web build
```

Expected: zero failing tests and successful production web build.

- [ ] **Step 2: Run browser verification at four widths**

Use Playwright at `320x800`, `768x1024`, `1024x768`, and `1440x900`. Verify composer sizing, timeline visibility, FAB placement, menu/dialog keyboard behavior, private-note isolation, emoji insertion, attachment preview, console errors, and no overlapping controls.

- [ ] **Step 3: Run approved live WhatsApp verification**

With the user's linked test phone and explicitly approved recipients:

1. Send one text and one small image to a designated test chat.
2. Create one clearly named test group with designated test participants.
3. Verify both appear on WhatsApp and in ClarioDesk in activity order.
4. Verify realtime delivery without manual sync.
5. Remove the test group only when the user explicitly approves cleanup.

- [ ] **Step 4: Update product documentation with actual status**

Mark only tested behavior complete. Record file-size limits, supported MIME types, linked-device risk, idempotency behavior, and remaining out-of-scope toolbar features.

- [ ] **Step 5: Commit verification documentation**

```bash
git add PROGRESS.md whatsapp_group_operations_platform_functional_requirements_v4_priority_tagged.md whatsapp_group_operations_platform_technical_design.md
git commit -m "docs: record composer and conversation delivery"
```
