# Phone And Gateway UX

Phone and gateway state must be understandable to non-technical admins. Linked-device
WhatsApp is useful but risky; the UI must be honest about that risk.

## Phone List

Each phone row/card should show:

- Display name.
- Phone number if known.
- Adapter type.
- Connection mode.
- Status.
- Risk level.
- Last seen.
- Last sync.
- Connected channels count.
- Recent failures.

Use status badges with icon + text.

## Statuses

```text
connected
syncing
disconnected
qr_required
degraded
restricted
archived
```

Each status must have:

- Short label.
- User-facing explanation.
- Recommended next action.
- Admin-only actions where relevant.

Example:

```text
QR required
Scan the QR code from WhatsApp to connect this phone.
```

## Connection Flow

Flow:

1. Create phone.
2. Select adapter.
3. Show linked-device risk notice.
4. Generate QR.
5. Scan QR.
6. Confirm connected state.
7. Sync groups.
8. Review unmapped groups.

The linked-device risk notice must be explicit:

```text
Linked-device mode uses WhatsApp Web-style connectivity. It supports existing groups
but is not the official Meta API and may disconnect or be restricted.
```

## Diagnostics

Show diagnostics near the inbox and in phone settings:

- Gateway unreachable.
- Webhook not receiving.
- Queue backlog.
- Media download failures.
- Reconnect sync active.
- Backfill active.
- Phone restricted.
- Adapter capability missing.

Admin actions:

- Refresh status.
- Reconnect.
- Disconnect.
- Regenerate QR.
- Trigger group sync.
- View recent events.

## Group Sync UX

Group sync should show:

- Sync started.
- Groups found.
- New groups.
- Already known groups.
- Failed groups.
- Unmapped groups needing review.

Unmapped groups should be actionable immediately:

- Map to client/project.
- Mark mixed.
- Mute.
- Archive.
- Leave unmapped.

## Full-Product Growth

P1:

- QR connection.
- Status refresh.
- Group sync.
- Basic diagnostics.

P2:

- Phone pool basics.
- Reconnect storm visibility.
- Storage/media health.
- Queue health.

P3:

- Gateway node strategy.
- High-volume risk controls.
- Storm dashboards.

P4:

- Official API routing controls.
- Multi-gateway resilience.
- Enterprise compliance dashboards.
