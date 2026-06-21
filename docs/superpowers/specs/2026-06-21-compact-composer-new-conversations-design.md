# Compact Composer and New Conversations Design

## Objective

Replace the oversized inbox composer with a compact WhatsApp-style composer and add a floating action button (FAB) that creates real WhatsApp chats and groups through Clario Gateway. Every visible control must perform a complete operation; no placeholder or disabled future controls are included.

## User Experience

### Compact composer

The composer remains fixed below the active conversation and uses two tabs:

- **WhatsApp** sends an external message to the active WhatsApp chat.
- **Private Note** creates an internal workspace note that is never sent to WhatsApp.

The selected mode changes the input placeholder, accent, accessible label, and send action. The composer contains:

- an auto-growing text input with a bounded maximum height;
- a working attachment picker;
- a working emoji picker;
- a compact icon-only send button with an accessible label and tooltip;
- an attachment preview tray with file name, type, size, and removal control;
- inline sending, uploading, and error feedback that does not shift the conversation layout.

`Enter` submits and `Shift+Enter` inserts a newline. Submission is blocked while empty, while already submitting, or when the phone route is unavailable. Private notes accept text but do not expose WhatsApp attachment controls in this phase.

The interface does not display translation, AI, voice, scheduling, or other toolbar actions until their complete behavior exists.

### New conversation FAB

A circular new-conversation button is anchored to the lower-right of the chat list on desktop and above the safe-area inset on mobile. Activating it opens a compact menu with **New chat** and **New group**. The menu supports mouse, touch, Escape, outside click, and keyboard navigation.

**New chat** opens a dialog containing:

- connected phone route when multiple routes exist;
- WhatsApp phone number with country code;
- required initial message;
- optional attachment.

Submitting validates that the number is registered on WhatsApp, sends the first message through Clario Gateway, imports or creates the resulting direct channel, selects it in the inbox, and shows the sent message. An empty direct conversation is not created because WhatsApp only materializes it after the first message.

**New group** opens a dialog containing:

- connected phone route when multiple routes exist;
- required group name;
- at least one participant phone number with country code;
- optional initial message.

Submitting validates and normalizes all participants, creates the real WhatsApp group through Clario Gateway, optionally sends the initial message, imports the group channel, selects it, and reports individual invalid participants without losing entered values.

## Component Boundaries

- `CompactComposer` owns mode selection, draft text, keyboard submission, and transient submission state.
- `EmojiPicker` inserts a selected emoji at the current caret position and restores input focus.
- `AttachmentTray` validates, previews, and removes one pending attachment.
- `NewConversationFab` owns only menu visibility and action selection.
- `NewChatDialog` and `NewGroupDialog` own form state and surface API errors.
- The application container performs API calls and updates the active channel from returned channel data.

Reusable primitives follow the existing ClarioDesk design tokens and Lucide icon set. Menus, dialogs, buttons, and inputs remain compact, accessible, and responsive.

## Backend and Gateway Design

### Clario Gateway

Add authenticated session operations:

- validate a WhatsApp phone number and return its normalized WhatsApp JID;
- send media to an existing or newly addressed direct chat;
- create a WhatsApp group from a title and validated participant JIDs;
- return the created chat/group identity and provider message identity.

The gateway uses the existing linked-device session and underlying WhatsApp client. It returns structured error codes for disconnected session, invalid number, invalid participant, group creation failure, media rejection, and provider timeout.

### ClarioDesk API

Add workspace-authenticated conversation commands rather than exposing the gateway to the browser:

- create a direct conversation by validating the recipient and sending the required initial message;
- create a group and optionally send its initial message;
- send an attachment to an existing channel.

The API verifies role and phone access, applies file type and size limits, invokes the configured gateway adapter, imports the resulting provider chat into the workspace, writes message/outbox records, records an audit event, and publishes realtime channel/message events. Requests use idempotency keys to prevent duplicate chats, groups, or messages after retries.

Media data is accepted by the API as multipart upload, stored through the existing media storage boundary, scanned/validated, and passed to the gateway adapter in its supported representation. The browser never receives gateway credentials.

### Realtime behavior

Successful creation publishes channel and message events. The current realtime client inserts or updates the channel, sorts it by WhatsApp activity time, selects the new conversation, and reconciles the provider-confirmed message without requiring manual synchronization.

## Failure Handling

- Invalid numbers and participants are identified beside the relevant field.
- Disconnected phones direct the user to reconnect without clearing the form.
- Duplicate submission is prevented in the UI and API.
- Provider timeouts remain retryable and do not claim that a message or group was created.
- Partial group creation is reconciled by provider group ID before retrying the initial message.
- Unsupported or oversized attachments are rejected before upload and revalidated by the API.
- Errors are concise, actionable, and announced through an accessible live region.

## Security and Operational Constraints

- All conversation commands require authenticated workspace membership and a non-viewer role.
- Phone instances must belong to the active workspace.
- File names are sanitized; MIME type is verified from content rather than trusted from the browser.
- Participant and recipient numbers are normalized server-side and excluded from unnecessary logs.
- Gateway calls use existing server-held credentials and are covered by audit events.
- Rate limits protect number validation, group creation, and outbound media endpoints.

## Testing and Acceptance Criteria

Automated gateway tests cover number validation, direct first-message sending, group creation, media sending, disconnected sessions, invalid participants, and provider errors.

API integration tests cover authorization, workspace isolation, idempotency, media validation, audit records, persistence, and realtime publication.

Frontend tests cover mode switching, emoji insertion at the caret, attachment validation/removal, keyboard submission, loading/error states, FAB keyboard behavior, and both forms.

Browser tests at desktop and mobile widths prove that:

1. A text reply sends once and appears in the active WhatsApp chat.
2. A private note remains internal.
3. An emoji and supported attachment can be sent from the compact composer.
4. New chat validates a real number, sends its required first message, and opens the imported direct channel.
5. New group creates a real WhatsApp group with the selected participants and opens it in the inbox.
6. The composer and FAB do not cover messages, resize the timeline unexpectedly, or overflow at 320, 768, 1024, and 1440 pixel widths.
7. Every visible control works with mouse and keyboard, and the browser console has no errors.

Live WhatsApp creation tests must use explicitly approved test recipients and group names to avoid affecting unrelated contacts.

## Out of Scope

Voice recording, AI rewriting, translation, scheduled sends, multi-file batches, contact-book management, and broadcast creation remain separate features. Their controls are not displayed until their workflows are implemented.
