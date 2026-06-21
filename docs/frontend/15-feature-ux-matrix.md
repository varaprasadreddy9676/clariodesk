# Feature UX Matrix

This matrix maps major product features to frontend surfaces, component needs, and
state requirements across the full ClarioDesk roadmap.

## P1 Core Features

| Feature | Primary Surface | Key Components | Required States |
|---|---|---|---|
| Auth | Login/register | AuthForm, PasswordInput, ErrorState | loading, invalid credentials, duplicate email |
| App shell | Global | AppShell, Sidebar, Header, CommandMenu | collapsed, mobile drawer, permission-scoped |
| Phone connection | Phones/settings | QRPanel, PhoneStatusBadge, DiagnosticBanner | QR required, connected, syncing, failed |
| Group sync | Phones/inbox | SyncProgress, UnmappedGroupList | syncing, complete, partial failure, no groups |
| Channel sidebar | Inbox | ChannelList, ChannelListItem, ViewTabs | loading, empty, unread, selected, inaccessible |
| Channel mapping | Context panel | MappingPanel, ClientProjectPicker | unmapped, mixed, active, archived, validation |
| Timeline | Inbox | Timeline, VirtualList, MessageRow | loading, empty, paginating, new message, offline |
| External reply | Composer | ExternalReplyComposer, SendDelayCountdown | drafting, waiting delay, queued, sent, failed |
| Internal note | Composer/panel | InternalNoteComposer, NoteRow | drafting, saving, saved, failed |
| Tickets | Context/tickets | TicketPanel, TicketForm, TicketBadge | none, open, pending, closed, permission denied |
| Search | Search/inbox | SearchInput, SearchResults, ResultRow | typing, loading, no results, permission-scoped |
| Media | Timeline/media tab | MessageMedia, MediaPreview, DownloadButton | pending, downloaded, failed, expired, purged |
| Team access | Team/settings | UserTable, AssignmentEditor | empty, assigned, conflict, permission denied |
| In-app notifications | App shell | NotificationBell, NotificationPanel, NotificationRow | empty, unread, read, permission-scoped |
| Realtime status | App shell | RealtimeStatusBadge, ReconnectBanner | connected, reconnecting, disconnected, stale |

## P2 Operational Features

| Feature | Primary Surface | Key Components | Required States |
|---|---|---|---|
| Saved views | Sidebar/lists | SavedViewList, ViewEditor | personal, public, pinned, invalid filter |
| Quick filters | Inbox/tickets | FilterBar, FilterChip | applied, removable, empty result |
| Quick replies | Composer | QuickReplyPicker, VariablePreview | no templates, variable missing, inserted |
| Handover notes | Context panel | HandoverPanel, HandoverNoteEditor | empty, stale, updated, mention |
| Pinned context | Context/timeline | PinButton, PinnedContextList | none, pinned, removed |
| SLA basics | Inbox/tickets | SlaBadge, Timer, BreachBanner | on track, at risk, breached, disabled |
| Coverage access | Team/inbox | CoverageBanner, CoverageEditor | active, expired, pending, read-only |
| Basic analytics | Reports | MetricCard, TrendChart, Table | loading, no data, filtered, export |
| Storage health | Settings/diagnostics | StorageHealthPanel, PurgeRunList | healthy, warning, failed, purging |
| Phone pool basics | Phones | PhonePoolList, RoutingStatus | available, degraded, restricted, overflow |
| AI-ready foundations | Settings/shared states | AiStatusBadge, AiPolicyBlockedState, AiSourceScope | disabled, no provider, budget exceeded, permission denied |
| Web Push/PWA setup | Settings/app shell | PushSetupPanel, DeviceSubscriptionList, TestNotificationButton | unsupported, not requested, denied, enabled, expired |
| Notification preferences | Settings/notifications | NotificationPreferenceForm, QuietHoursEditor, NotificationPrivacySelector | inherited, custom, quiet, muted |

## P3 Differentiators

| Feature | Primary Surface | Key Components | Required States |
|---|---|---|---|
| BYOK AI settings | Admin/settings | ProviderConnectionForm, KeyRotationDialog, ModelRouteTable | unconfigured, testing, active, failed, key rotated |
| AI audit | Admin/audit | AiAuditTable, SuggestionDetailDrawer | accepted, edited, rejected, failed, redacted |
| AI summaries | Context/timeline | SummaryPanel, RegenerateButton | not generated, generating, ready, failed |
| Suggested replies | Composer | SuggestionPanel, ApplySuggestion | disabled, generating, ready, rejected |
| Voice transcription | Message/media | TranscriptPanel, ConfidenceBadge | queued, transcribing, ready, failed |
| Semantic search | Search | NaturalLanguageSearch, ConvertedFilterBar | parsing, converted, no match, permission-scoped |
| Sensitive-data scan | Composer/media | SensitiveDataWarning, RedactionPreview | scanning, clear, warning, blocked |
| Virtual threads | Timeline/context | ThreadBadge, ThreadPanel, ThreadList | unthreaded, suggested, linked, merged |
| Draft approvals | Composer | DraftStateBadge, ApprovalPanel | draft, review, approved, rejected |
| Incident mode | Inbox/context | IncidentBanner, WarRoomPanel | suggested, active, resolved, RCA pending |
| Storm bundles | Inbox/timeline | StormBanner, BundleRow | detected, bundling, active, resolved |
| Notification digests | Notification center | DigestPanel, DigestScheduleEditor | pending, sent, muted, failed |
| App badging | PWA/app shell | AppBadgeController, BadgePreference | unsupported, enabled, count stale |
| Asset guardrails | Composer/media | AssetRiskBanner, OverrideDialog | safe, warning, blocked, overridden |
| Custom ticket fields | Ticket panel | DynamicFieldRenderer | hidden, required, invalid, saved |

## P4 Enterprise Features

| Feature | Primary Surface | Key Components | Required States |
|---|---|---|---|
| Official WhatsApp module | Official WhatsApp | OfficialNav, OfficialOverview | not configured, connected, degraded, permission denied |
| WABA/phone management | Official WhatsApp | WabaList, PhoneNumberTable, EmbeddedSignupPanel | onboarding, active, token expired, quality warning |
| Template lifecycle | Official WhatsApp | TemplateTable, TemplateEditor, VariableValidator | draft, submitted, approved, rejected, paused |
| WhatsApp Flows | Official WhatsApp | FlowList, FlowBuilder, FlowSubmissionViewer | draft, published, invalid, failed encryption |
| Opt-outs | Official WhatsApp | OptOutList, OptOutRuleEditor | active, imported, blocked send, audited |
| Official conversations | Official WhatsApp/inbox | OfficialConversationList, OfficialMessageComposer | customer window open, template required, failed, delivered |
| Official analytics | Reports/Official WhatsApp | DeliveryDashboard, CostTierPanel | loading, no data, warning, limit reached |
| SSO/SAML | Security settings | SsoConfigForm, DomainRuleList | unconfigured, testing, active, failed |
| Advanced RBAC | Security/team | RoleMatrix, PolicyEditor | inherited, overridden, invalid, audited |
| Break-glass | Compliance/context | BreakGlassDialog, AccessBanner | requested, active, expired, audited |
| Auditor views | Compliance | AuditSearch, EvidenceBundle | scoped, exporting, redacted, complete |
| Official templates | Settings/composer | TemplateGovernance, TemplatePicker | draft, pending approval, approved, rejected |
| Cost/risk routing | Reports/settings | RoutePolicyPanel, CostDashboard | estimate, blocked, exceeded, approved |
| Plugin marketplace | Settings | PluginList, PermissionReview | installed, disabled, update, unsafe |
| Data residency | Security/settings | RegionPolicyPanel | compliant, violation, migrating |
| Multi-provider AI routing | AI settings | ModelRoutingTable, ProviderHealthList | default, overridden, degraded, failover |
| Local/self-hosted AI | AI settings | LocalModelConnection, ModelHealthPanel | unavailable, testing, active, capacity limited |
| Managed cloud | Admin | TenantControlPanel, UsageDashboard | healthy, limited, suspended |
| Native push alignment | Mobile/admin | PushChannelPolicy, DeviceBridgeStatus | web-only, native-ready, dual-delivery |

## Cross-Cutting Requirements

Every feature needs:

- Loading state.
- Empty state.
- Error state.
- Permission behavior.
- Mobile behavior.
- Keyboard path.
- Audit implications where applicable.
- Realtime behavior where applicable.
- Test plan.

No feature should be considered designed until these states are specified.
