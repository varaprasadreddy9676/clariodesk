# Admin And Settings UX

Settings should be powerful but not become the primary work surface. Critical operational
issues should appear in the inbox and phone screens, not only in settings.

## Settings Structure

Recommended sections:

- Workspace
- Phones
- Clients and Projects
- Team and Roles
- Assignments
- Retention and Storage
- Quick Replies
- SLA and Coverage
- Automations
- AI
- Integrations
- Security
- Audit
- Billing/Managed Cloud later

## Workspace Settings

P1:

- Workspace name.
- Slug.
- Timezone.
- Basic branding.

P2+:

- Localization preferences.
- Default views.
- Default assignment rules.

## Team And Assignments

The assignment UI must clearly explain visibility:

```text
Agents only see clients and groups assigned to them.
```

Show:

- Role.
- Assigned clients.
- Assigned channels.
- Access level.
- Status.

Bulk assignment should be P2 and must be auditable.

## Retention And Storage

Show:

- Raw event retention.
- Message retention.
- Media retention.
- Storage health.
- Recent purge runs.
- Failed media downloads.

Dangerous retention changes require confirmation.

## Automations

P2/P3 automation UX should be conservative:

- Start with simple auto-ack/cooldown settings.
- Add rule builder only after safety controls exist.
- Show suppression reasons.
- Show dry-run preview before enabling.

Do not put an advanced visual automation builder in Core v1.

## Notification Settings

Notifications should be configurable at workspace and user levels.

Workspace/admin settings:

- Events eligible for push.
- Events that always notify.
- Default preview privacy.
- Quiet-hours defaults.
- Critical event bypass rules.
- Digest defaults.
- Notification retention.

User settings:

- In-app, Web Push, email, Slack/Teams where enabled.
- Per-client/project subscriptions.
- Per-channel mute.
- Quiet hours.
- Preview privacy.
- Device subscriptions.
- Test notification.

Push devices should show browser/platform, last seen time, status, and revoke action.

## AI Settings

AI must be opt-in, BYOK-first, and budget-controlled.

Show:

- Provider connections.
- API key add/rotate/remove flow.
- Masked key fingerprint after save.
- Test connection and provider health.
- Enabled features.
- Monthly budget.
- Per-feature limits.
- Data isolation mode.
- Provider/model.
- Per-feature model routing.
- Data redaction profile.
- Prompt/output retention policy.
- Audit of AI outputs.

AI must never send external replies by default.
Provider keys must be write-only from the frontend: users can add, replace, test,
or delete them, but cannot read them back.

## Security And Compliance

P4 settings:

- SSO/SAML.
- MFA.
- Advanced RBAC.
- Break-glass.
- Audit exports.
- Data residency.
- BYO LLM/local AI.
- Enterprise policy packs.

## Full-Product Growth

P1:

- Workspace.
- Phones.
- Clients/projects.
- Team.
- Assignments.
- Basic retention.

P2:

- Quick replies.
- SLA.
- Coverage.
- Storage health.
- Saved views.

P3:

- Automations.
- AI settings.
- Asset governance.
- Incident settings.

P4:

- Enterprise security.
- Compliance.
- Plugins.
- Official API governance.
