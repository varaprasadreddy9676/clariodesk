import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Bell,
  BellOff,
  CheckCircle2,
  Clipboard,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  LockKeyhole,
  LogOut,
  MessageCircleMore,
  Phone,
  Pin,
  PinOff,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Ticket,
  Users,
  WifiOff,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  clearSession,
  ClarioApiClient,
  readStoredSession,
  storeSession,
  type ApiChannel,
  type ApiCustomer,
  type ApiMessage,
  type ApiOpsSummary,
  type ApiPhone,
  type ApiTeamMember,
  type ApiTicket,
  type AuthSession,
} from "./api.js";
import { ChannelList, type ChannelView } from "./components/ChannelList.js";
import { Composer } from "./components/Composer.js";
import { ContextPanel } from "./components/ContextPanel.js";
import { NotificationCenter } from "./components/NotificationCenter.js";
import { NewConversationFab } from "./components/NewConversationFab.js";
import type { ComposerDraft } from "./components/Composer.js";
import { OpsBar } from "./components/OpsBar.js";
import { Sidebar } from "./components/Sidebar.js";
import { Timeline } from "./components/Timeline.js";
import { useAsyncData, useLatestRef } from "./hooks.js";
import { useRealtimeFeed, type RealtimeEvent } from "./realtime.js";
import {
  filterChannelsByView,
  sortChannelsLikeWhatsApp,
  sortMessagesLikeWhatsApp,
} from "./lib/whatsapp-sort.js";
import type {
  Channel,
  Message,
  NavItem,
  OpsSummary,
  Ticket as UiTicket,
} from "./types.js";

type Toast = { kind: "ok" | "error"; text: string } | null;
type ContextTab = "Ticket" | "Channel" | "People" | "Events";
type ChannelMenuAction =
  | "open"
  | "refresh"
  | "mark-unread"
  | "pin"
  | "unpin"
  | "mute"
  | "unmute"
  | "archive"
  | "unarchive"
  | "copy-title"
  | "copy-provider-id"
  | "copy-clario-id";

type ChannelMenuState = {
  channel: Channel;
  x: number;
  y: number;
};

function createWorkspaceSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base || "workspace"}-${suffix}`;
}

const navIcons = {
  inbox: Inbox,
  tickets: Ticket,
  search: Search,
  phones: Phone,
  clients: Shield,
  team: Users,
  reports: BarChart3,
  settings: Settings,
};

const mobileNavItems = ["inbox", "tickets", "search", "phones", "settings"] as const;

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readStoredSession(),
  );
  const api = useMemo(
    () =>
      new ClarioApiClient(
        () => readStoredSession(),
        () => setSession(null),
      ),
    [],
  );

  if (!session) {
    return <AuthScreen api={api} onSession={setSession} />;
  }

  return (
    <Workbench
      api={api}
      session={session}
      onSignOut={() => {
        clearSession();
        setSession(null);
      }}
    />
  );
}

function AuthScreen({
  api,
  onSession,
}: {
  api: ClarioApiClient;
  onSession: (session: AuthSession) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const auth =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              displayName,
              workspaceName,
              workspaceSlug: createWorkspaceSlug(workspaceName),
            });
      storeSession(auth);
      onSession(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-shell" aria-label="ClarioDesk access">
        <div className="auth-visual" aria-hidden="true">
          <div className="auth-visual-brand">
            <div className="auth-brand-mark">C</div>
            <div>
              <strong>ClarioDesk</strong>
              <span>Support operations</span>
            </div>
          </div>

          <div className="auth-story">
            <span className="auth-eyebrow">
              <MessageCircleMore size={15} /> Shared WhatsApp inbox
            </span>
            <h1>Support conversations, finally organized.</h1>
            <p>
              Keep every customer group, owner, ticket, and private note in one
              calm workspace.
            </p>
          </div>

          <div className="auth-chat-preview">
            <div className="auth-chat-header">
              <div className="auth-chat-avatar">AC</div>
              <div>
                <strong>Acme · Support</strong>
                <span>4 participants</span>
              </div>
              <span className="auth-live-dot">Live</span>
            </div>
            <div className="auth-chat-body">
              <div className="auth-bubble incoming">
                <strong>Maya · Acme</strong>
                <span>The payment report is not loading for our team.</span>
                <time>10:42</time>
              </div>
              <div className="auth-bubble note">
                <strong>Private note · Arjun</strong>
                <span>
                  I can reproduce this. Linking it to the open incident.
                </span>
                <time>10:43</time>
              </div>
              <div className="auth-bubble outgoing">
                <span>
                  Thanks Maya. We found the issue and are working on it now.
                </span>
                <time>10:45 ✓✓</time>
              </div>
            </div>
            <div className="auth-ticket-row">
              <span>
                <LockKeyhole size={14} /> CD-1842
              </span>
              <strong>Assigned to Arjun</strong>
              <em>In progress</em>
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark">C</div>
            <strong>ClarioDesk</strong>
          </div>

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <header className="auth-form-header">
              <span className="auth-form-icon">
                <LockKeyhole size={20} />
              </span>
              <h2>
                {mode === "login" ? "Welcome back" : "Create your workspace"}
              </h2>
              <p>
                {mode === "login"
                  ? "Sign in to continue to your support workspace."
                  : "Set up a workspace for your support team."}
              </p>
            </header>

            <div
              className="auth-tabs"
              role="tablist"
              aria-label="Account access"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "is-active" : ""}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "is-active" : ""}
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Create workspace
              </button>
            </div>

            <div className="auth-fields">
              {mode === "register" ? (
                <>
                  <Field
                    label="Workspace name"
                    value={workspaceName}
                    onChange={setWorkspaceName}
                    autoComplete="organization"
                    required
                  />
                  <Field
                    label="Your name"
                    value={displayName}
                    onChange={setDisplayName}
                    autoComplete="name"
                    required
                  />
                </>
              ) : null}
              <Field
                label="Work email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <span className="password-input">
                  <input
                    id="auth-password"
                    value={password}
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={8}
                    required
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </div>
            </div>

            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating workspace..."
                : mode === "login"
                  ? "Sign in"
                  : "Create workspace"}
            </button>

            <div className="auth-trust">
              <ShieldCheck size={16} /> Protected workspace access
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Workbench({
  api,
  session,
  onSignOut,
}: {
  api: ClarioApiClient;
  session: AuthSession;
  onSignOut: () => void;
}) {
  const [activeNav, setActiveNav] = useState("inbox");
  const [activeChannelId, setActiveChannelId] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [channelView, setChannelView] = useState<ChannelView>("all");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [contextTab, setContextTab] = useState<ContextTab>("Ticket");
  const [channelMenu, setChannelMenu] = useState<ChannelMenuState | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(
    null,
  );
  const [toast, setToast] = useState<Toast>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      (localStorage.getItem("clariodesk-theme") as "light" | "dark" | null) ??
      "light",
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clariodesk-theme", theme);
  }, [theme]);
  const refreshTimers = useRef<Record<string, number | undefined>>({});
  const ops = useAsyncData(() => api.opsSummary(), [api]);
  const phones = useAsyncData(() => api.phones(), [api]);
  const channels = useAsyncData(
    () => api.channels(channelView === "archived" ? "archived" : undefined),
    [api, channelView],
  );
  const tickets = useAsyncData(() => api.tickets(), [api]);
  const clients = useAsyncData(() => api.clients(), [api]);
  const team = useAsyncData(() => api.teamMembers(), [api]);

  const mappedTickets = useMemo(
    () => (tickets.data ?? []).map(toUiTicket),
    [tickets.data],
  );
  const mappedChannels = useMemo(
    () =>
      toUiChannels(channels.data ?? [], tickets.data ?? [], phones.data ?? []),
    [channels.data, tickets.data, phones.data],
  );
  const historySyncing = useMemo(
    () => (phones.data ?? []).some((phone) => phone.status === "syncing"),
    [phones.data],
  );
  const filteredChannels = useMemo(
    () =>
      sortChannelsLikeWhatsApp(
        filterChannels(mappedChannels, channelQuery, channelView),
      ),
    [mappedChannels, channelQuery, channelView],
  );
  const activeChannel = useMemo(
    () =>
      filteredChannels.find((channel) => channel.id === activeChannelId) ??
      filteredChannels[0] ??
      mappedChannels[0],
    [activeChannelId, filteredChannels, mappedChannels],
  );
  const timeline = useAsyncData(
    () =>
      activeChannel
        ? api.timeline(activeChannel.id)
        : Promise.resolve({ messages: [], nextCursor: null }),
    [api, activeChannel?.id],
  );
  const activeMessages = useMemo(
    () =>
      sortMessagesLikeWhatsApp(
        (timeline.data?.messages ?? []).map(toUiMessage),
      ),
    [timeline.data],
  );
  const navItems = useMemo(
    () => buildNavItems(ops.data, tickets.data ?? []),
    [ops.data, tickets.data],
  );
  const uiOps = toUiOps(ops.data);

  // Stable refs so scheduled callbacks always call the latest refresh fn
  const channelsRefreshRef = useLatestRef(channels.refresh);
  const opsRefreshRef = useLatestRef(ops.refresh);
  const phonesRefreshRef = useLatestRef(phones.refresh);
  const ticketsRefreshRef = useLatestRef(tickets.refresh);
  const timelineRefreshRef = useLatestRef(timeline.refresh);
  const resolveMediaUrl = useCallback((id: string) => api.mediaUrl(id), [api]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      opsRefreshRef.current(),
      phonesRefreshRef.current(),
      channelsRefreshRef.current(),
      ticketsRefreshRef.current(),
      clients.refresh(),
      team.refresh(),
    ]);
  }, [channelsRefreshRef, clients, opsRefreshRef, phonesRefreshRef, team, ticketsRefreshRef]);

  const runAction = useCallback(
    async (action: () => Promise<void>, success: string) => {
      setToast(null);
      try {
        await action();
        setToast({ kind: "ok", text: success });
      } catch (err) {
        setToast({
          kind: "error",
          text: err instanceof Error ? err.message : "Action failed",
        });
      }
    },
    [],
  );

  const scheduleRefresh = useCallback(
    (key: string, action: () => Promise<void>, delay = 180) => {
      const existing = refreshTimers.current[key];
      if (existing) {
        window.clearTimeout(existing);
      }
      refreshTimers.current[key] = window.setTimeout(() => {
        delete refreshTimers.current[key];
        void action();
      }, delay);
    },
    [],
  );
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.channelId) {
        scheduleRefresh("channels", () => channelsRefreshRef.current());
        scheduleRefresh("ops", () => opsRefreshRef.current());
      }
      if (event.type === "phone.status_changed") {
        scheduleRefresh("phones", () => phonesRefreshRef.current());
        scheduleRefresh("ops", () => opsRefreshRef.current());
      }
      if (event.type === "ticket.created" || event.type === "ticket.updated") {
        scheduleRefresh("tickets", () => ticketsRefreshRef.current());
        scheduleRefresh("ops", () => opsRefreshRef.current());
      }
      if (
        event.type === "note.created" ||
        event.type === "outbox.status_changed"
      ) {
        scheduleRefresh("ops", () => opsRefreshRef.current());
      }
      if (
        event.channelId &&
        activeChannel?.id === event.channelId &&
        (event.type === "message.received" ||
          event.type === "message.updated" ||
          event.type === "channel.updated" ||
          event.type === "note.created" ||
          event.type === "outbox.status_changed")
      ) {
        scheduleRefresh("timeline", () => timelineRefreshRef.current());
      }
    },
    [
      activeChannel?.id,
      channelsRefreshRef,
      opsRefreshRef,
      phonesRefreshRef,
      ticketsRefreshRef,
      timelineRefreshRef,
      scheduleRefresh,
    ],
  );
  const realtime = useRealtimeFeed(session, { onEvent: handleRealtimeEvent });
  const autoSyncedChannels = useRef(new Set<string>());
  const previousRealtimeStatus = useRef(realtime.status);

  useEffect(() => {
    const previous = previousRealtimeStatus.current;
    previousRealtimeStatus.current = realtime.status;
    if (realtime.status !== "connected" || previous === "connected") return;
    void Promise.all([
      channels.refresh(),
      phones.refresh(),
      ops.refresh(),
      activeChannel ? timeline.refresh() : Promise.resolve(),
    ]);
  }, [
    activeChannel?.id,
    channels.refresh,
    ops.refresh,
    phones.refresh,
    realtime.status,
    timeline.refresh,
  ]);

  useEffect(() => {
    if (!historySyncing) return;
    const interval = window.setInterval(() => {
      void Promise.all([
        phones.refresh(),
        channels.refresh(),
        activeChannel ? timeline.refresh() : Promise.resolve(),
      ]);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [
    activeChannel?.id,
    channels.refresh,
    historySyncing,
    phones.refresh,
    timeline.refresh,
  ]);

  useEffect(() => {
    const reconcile = () => {
      void Promise.all([
        channels.refresh(),
        phones.refresh(),
        ops.refresh(),
        activeChannel ? timeline.refresh() : Promise.resolve(),
      ]);
    };
    const handleFocus = () => reconcile();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const interval =
      realtime.status === "connected"
        ? undefined
        : window.setInterval(reconcile, 5_000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (interval) window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    activeChannel?.id,
    channels.refresh,
    ops.refresh,
    phones.refresh,
    realtime.status,
    timeline.refresh,
  ]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(refreshTimers.current)) {
        if (timer) window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    if (timeline.data == null) return;
    if (autoSyncedChannels.current.has(activeChannel.id)) return;

    autoSyncedChannels.current.add(activeChannel.id);
    void (async () => {
      try {
        await api.syncMessages(activeChannel.id, 50);
        await Promise.all([
          timeline.refresh(),
          channels.refresh(),
          ops.refresh(),
        ]);
      } catch {
        autoSyncedChannels.current.delete(activeChannel.id);
      }
    })();
  }, [activeChannel?.id, activeChannel?.status, api, channels, ops, timeline]);

  const openChannelMenu = useCallback(
    (channel: Channel, x: number, y: number) => {
      setChannelMenu({
        channel,
        x: Math.max(8, Math.min(x, window.innerWidth - 228)),
        y: Math.max(8, Math.min(y, window.innerHeight - 380)),
      });
    },
    [],
  );

  async function handleChannelMenu(
    action: ChannelMenuAction,
    channel: Channel,
  ) {
    setChannelMenu(null);
    switch (action) {
      case "open":
        setActiveNav("inbox");
        setActiveChannelId(channel.id);
        setContextOpen(false);
        setContextTab("Ticket");
        break;
      case "refresh":
        await runAction(async () => {
          await api.refreshChannel(channel.id);
          await Promise.all([channels.refresh(), timeline.refresh()]);
        }, "Chat refreshed");
        break;
      case "mark-unread":
        await runAction(async () => {
          await api.applyChannelAction(channel.id, {
            action: "mark_unread",
            markedUnread: true,
          });
          await channels.refresh();
        }, "Marked as unread");
        break;
      case "pin":
      case "unpin":
        await runAction(async () => {
          await api.applyChannelAction(channel.id, {
            action: "pin",
            pinned: action === "pin",
          });
          await channels.refresh();
        }, action === "pin" ? "Chat pinned" : "Chat unpinned");
        break;
      case "mute":
      case "unmute":
        await runAction(async () => {
          await api.applyChannelAction(channel.id, {
            action: "mute",
            muted: action === "mute",
          });
          await channels.refresh();
        }, action === "mute" ? "Chat muted" : "Chat unmuted");
        break;
      case "archive":
      case "unarchive":
        await runAction(async () => {
          await api.applyChannelAction(channel.id, {
            action: "archive",
            archived: action === "archive",
          });
          setActiveChannelId("");
          await channels.refresh();
        }, action === "archive" ? "Chat archived" : "Chat restored");
        break;
      case "copy-title":
        void navigator.clipboard.writeText(channel.title).then(
          () => setToast({ kind: "ok", text: "Channel title copied" }),
          () => setToast({ kind: "error", text: "Clipboard write failed" }),
        );
        break;
      case "copy-provider-id":
        void navigator.clipboard.writeText(channel.providerChatId).then(
          () => setToast({ kind: "ok", text: "WhatsApp ID copied" }),
          () => setToast({ kind: "error", text: "Clipboard write failed" }),
        );
        break;
      case "copy-clario-id":
        void navigator.clipboard.writeText(channel.id).then(
          () => setToast({ kind: "ok", text: "ClarioDesk ID copied" }),
          () => setToast({ kind: "error", text: "Clipboard write failed" }),
        );
        break;
      default:
        break;
    }
  }

  const selectChannel = useCallback(
    (id: string) => {
      setActiveChannelId(id);
      setMobilePane("chat");
      const channel = mappedChannels.find((item) => item.id === id);
      if (!channel?.isMarkedUnread) return;
      void api
        .clearChannelUnread(id)
        .then(() => channels.refresh())
        .catch((error) =>
          setToast({
            kind: "error",
            text:
              error instanceof Error
                ? error.message
                : "Could not clear unread state",
          }),
        );
    },
    [api, channels.refresh, mappedChannels],
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        items={navItems}
        activeId={activeNav}
        onSelect={setActiveNav}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />
      <main className="workbench">
        <OpsBar
          summary={uiOps}
          realtimeStatus={realtime.status}
          notificationCount={realtime.unreadCount}
          onOpenNotifications={() => setNotificationsOpen((value) => !value)}
          theme={theme}
          onToggleTheme={() =>
            setTheme((value) => (value === "dark" ? "light" : "dark"))
          }
        />
        {toast ? (
          <div className={`toast toast-${toast.kind}`}>{toast.text}</div>
        ) : null}
        {activeNav === "inbox" ? (
          channels.status === "loading" || channels.status === "idle" ? (
            <div className="inbox-grid context-closed">
              <div className="channel-list-stack">
                <div className="channel-list-skeleton" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="channel-row-skeleton" />
                  ))}
                </div>
              </div>
            </div>
          ) : channels.status === "error" ? (
            <div className="inbox-grid context-closed">
              <div className="channel-list-stack">
                <div className="center-panel">
                  <p role="alert" className="form-error">
                    {channels.error}
                  </p>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => void channels.refresh()}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : activeChannel ? (
            <div
              className={`inbox-grid mobile-${mobilePane} ${contextOpen ? "" : "context-closed"}`}
            >
              <div className="channel-list-stack">
                <ChannelList
                  channels={filteredChannels}
                  activeId={activeChannel.id}
                  onSelect={selectChannel}
                  onOpenMenu={openChannelMenu}
                  query={channelQuery}
                  onQueryChange={setChannelQuery}
                  view={channelView}
                  onViewChange={setChannelView}
                  syncing={historySyncing}
                />
                <NewConversationFab
                  phones={(phones.data ?? []).filter(
                    (phone) =>
                      phone.status === "connected" ||
                      phone.status === "syncing",
                  )}
                  onCreateChat={async (input) => {
                    const created = await api.createDirectConversation({
                      phoneInstanceId: input.phoneInstanceId,
                      phoneNumber: input.phoneNumber,
                      initialMessage: input.initialMessage,
                      idempotencyKey: crypto.randomUUID(),
                    });
                    if (input.attachment) {
                      await api.sendMedia({
                        channelId: created.channelId,
                        body: "",
                        file: input.attachment,
                        idempotencyKey: crypto.randomUUID(),
                      });
                    }
                    await channels.refresh();
                    setActiveChannelId(created.channelId);
                    setMobilePane("chat");
                    setToast({ kind: "ok", text: "WhatsApp chat started" });
                  }}
                  onCreateGroup={async (input) => {
                    const created = await api.createGroupConversation({
                      ...input,
                      idempotencyKey: crypto.randomUUID(),
                    });
                    await channels.refresh();
                    setActiveChannelId(created.channelId);
                    setMobilePane("chat");
                    setToast({ kind: "ok", text: "WhatsApp group created" });
                  }}
                />
              </div>
              <div className="conversation-column">
                <Timeline
                  channel={activeChannel}
                  messages={activeMessages}
                  onCreateTicket={(message) => {
                    void runAction(async () => {
                      await api.createTicket({
                        channelId: activeChannel.id,
                        sourceMessageId: message.id,
                        title: message.body.slice(0, 120) || "WhatsApp issue",
                        description: message.body,
                        priority: "normal",
                      });
                      await tickets.refresh();
                    }, "Ticket created");
                  }}
                  onReply={(message) => {
                    setComposerDraft({
                      mode: "reply",
                      body: `> ${message.body}\n\n`,
                      nonce: Date.now(),
                    });
                  }}
                  onPrivateNote={(message) => {
                    setComposerDraft({
                      mode: "note",
                      body: `Private note on ${message.sender}: ${message.body}`,
                      nonce: Date.now(),
                    });
                  }}
                  onCopy={(text, label) => {
                    void navigator.clipboard.writeText(text).then(
                      () => setToast({ kind: "ok", text: label }),
                      () =>
                        setToast({
                          kind: "error",
                          text: "Clipboard write failed",
                        }),
                    );
                  }}
                  onRefresh={() => {
                    void timeline.refresh();
                  }}
                  onResolveMediaUrl={resolveMediaUrl}
                  onReact={async (message, reaction) => {
                    try {
                      await api.reactToMessage(message.id, reaction);
                      setToast({
                        kind: "ok",
                        text: `Reaction ${reaction} sent`,
                      });
                    } catch (error) {
                      setToast({
                        kind: "error",
                        text:
                          error instanceof Error
                            ? error.message
                            : "Reaction failed",
                      });
                      throw error;
                    }
                  }}
                  contextOpen={contextOpen}
                  onToggleContext={() => setContextOpen((value) => !value)}
                  onBack={() => setMobilePane("list")}
                  onOpenMenu={(e) => {
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    openChannelMenu(
                      activeChannel,
                      rect.right - 8,
                      rect.bottom + 4,
                    );
                  }}
                />
                <Composer
                  channel={activeChannel}
                  draft={composerDraft}
                  onSendReply={async ({ body, attachment }) => {
                    if (attachment) {
                      await api.sendMedia({
                        channelId: activeChannel.id,
                        body,
                        file: attachment,
                        idempotencyKey: crypto.randomUUID(),
                      });
                    } else {
                      await api.sendReply({
                        channelId: activeChannel.id,
                        body,
                        useSendDelay: true,
                        idempotencyKey: crypto.randomUUID(),
                      });
                    }
                    await timeline.refresh();
                    await ops.refresh();
                  }}
                  onCreateNote={async (body) => {
                    await api.createNote({ channelId: activeChannel.id, body });
                    await timeline.refresh();
                  }}
                />
              </div>
              {contextOpen ? (
                <ContextPanel
                  channel={activeChannel}
                  tickets={mappedTickets.filter(
                    (ticket) => ticket.status !== "closed",
                  )}
                  initialTab={contextTab}
                  onClose={() => setContextOpen(false)}
                />
              ) : null}
            </div>
          ) : (
            <SetupEmpty onGoPhones={() => setActiveNav("phones")} />
          )
        ) : null}
        {activeNav === "tickets" ? (
          <TicketsView
            api={api}
            tickets={tickets.data ?? []}
            members={team.data ?? []}
            onChanged={tickets.refresh}
          />
        ) : null}
        {activeNav === "search" ? (
          <SearchView
            api={api}
            onOpenChannel={(channelId) => {
              const next = mappedChannels.find(
                (channel) => channel.id === channelId,
              );
              if (next) setActiveChannelId(next.id);
              setActiveNav("inbox");
              setContextOpen(true);
              setContextTab("Ticket");
            }}
            onOpenTicket={() => setActiveNav("tickets")}
          />
        ) : null}
        {activeNav === "phones" ? (
          <PhonesView
            api={api}
            phones={phones.data ?? []}
            onChanged={refreshAll}
            runAction={runAction}
          />
        ) : null}
        {activeNav === "clients" ? (
          <ClientsView
            api={api}
            clients={clients.data ?? []}
            onChanged={clients.refresh}
            runAction={runAction}
          />
        ) : null}
        {activeNav === "team" ? (
          <TeamView
            api={api}
            members={team.data ?? []}
            onChanged={team.refresh}
            runAction={runAction}
          />
        ) : null}
        {activeNav === "reports" ? (
          <ReportsView ops={ops.data} onRefresh={() => void refreshAll()} />
        ) : null}
        {activeNav === "settings" ? (
          <SettingsView
            session={session}
            onSignOut={onSignOut}
            onRefresh={() => void refreshAll()}
          />
        ) : null}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNavItems.map((id) => {
          const Icon = navIcons[id];
          return (
            <button
              key={id}
              type="button"
              className={activeNav === id ? "is-active" : ""}
              aria-current={activeNav === id ? "page" : undefined}
              onClick={() => {
                setActiveNav(id);
                setChannelMenu(null);
                if (id === "inbox") setMobilePane("list");
              }}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{id[0]?.toUpperCase()}{id.slice(1)}</span>
            </button>
          );
        })}
      </nav>
      <NotificationCenter
        open={notificationsOpen}
        status={realtime.status}
        notifications={realtime.notifications}
        unreadCount={realtime.unreadCount}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={realtime.markAllRead}
        onClear={realtime.clear}
        onMarkRead={realtime.markRead}
        onOpenChannel={(channelId) => {
          const next = mappedChannels.find(
            (channel) => channel.id === channelId,
          );
          if (next) setActiveChannelId(next.id);
          setActiveNav("inbox");
          setContextOpen(true);
          setContextTab("Channel");
          setNotificationsOpen(false);
        }}
        onOpenTickets={() => {
          setActiveNav("tickets");
          setNotificationsOpen(false);
        }}
      />
      {channelMenu ? (
        <ChannelContextMenu
          state={channelMenu}
          onClose={() => setChannelMenu(null)}
          onAction={handleChannelMenu}
        />
      ) : null}
    </div>
  );
}

function TicketsView({
  api,
  tickets,
  members,
  onChanged,
}: {
  api: ClarioApiClient;
  tickets: ApiTicket[];
  members: ApiTeamMember[];
  onChanged: () => Promise<void>;
}) {
  async function update(id: string, status: "open" | "pending" | "closed") {
    await api.updateTicket(id, { status });
    await onChanged();
  }
  return (
    <section className="page-panel">
      <PanelTitle title="Tickets" subtitle={`${tickets.length} records`} />
      <div className="table-list">
        {tickets.length === 0 ? (
          <Empty
            title="No tickets yet"
            body="Create tickets from inbound WhatsApp messages."
          />
        ) : null}
        {tickets.map((ticket) => (
          <article className="data-row" key={ticket.id}>
            <div>
              <strong>{ticket.title}</strong>
              <span>
                {ticket.priority} priority / assigned to{" "}
                {memberName(members, ticket.assignedUserId)}
              </span>
            </div>
            <select
              value={ticket.status}
              onChange={(event) =>
                void update(
                  ticket.id,
                  event.target.value as "open" | "pending" | "closed",
                )
              }
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchView({
  api,
  onOpenChannel,
  onOpenTicket,
}: {
  api: ClarioApiClient;
  onOpenChannel: (channelId: string) => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Awaited<
    ReturnType<ClarioApiClient["search"]>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit() {
    setError(null);
    setLoading(true);
    try {
      setResult(await api.search(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="page-panel">
      <PanelTitle title="Search" subtitle="Messages and tickets" />
      <div className="inline-form">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search text"
        />
        <button
          className="primary-action"
          type="button"
          disabled={!query.trim() || loading}
          onClick={() => void submit()}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {result ? (
        <div className="split-list">
          <SearchResultGroup
            title="Messages"
            items={result.messages.map((item) => ({
              id: item.id,
              body: item.body ?? item.id,
              channelId: item.channelId,
              meta: formatTime(item.providerTimestamp),
            }))}
            emptyBody="Try a different search phrase."
            onOpen={(channelId) => onOpenChannel(channelId)}
          />
          <SearchResultGroup
            title="Tickets"
            items={result.tickets.map((item) => ({
              id: item.id,
              body: item.title,
              channelId: item.channelId,
              meta: item.status,
            }))}
            emptyBody="No tickets match this search."
            onOpen={(ticketId) => onOpenTicket(ticketId)}
          />
        </div>
      ) : null}
    </section>
  );
}

function PhonesView({
  api,
  phones,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  phones: ApiPhone[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("Clario Gateway Support");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [providerInstanceId, setProviderInstanceId] =
    useState("clario-support");
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState("http://localhost:2786");
  const [apiKey, setApiKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [phoneResult, setPhoneResult] = useState<string | null>(null);
  const autoSyncedPhones = useRef(new Set<string>());
  const autoQrRequestedPhones = useRef(new Set<string>());

  async function doPhoneAction(
    key: string,
    action: () => Promise<string | void>,
    success: string,
  ) {
    setActionKey(key);
    setPhoneResult(null);
    await runAction(async () => {
      const detail = await action();
      if (detail) setPhoneResult(detail);
    }, success);
    setActionKey(null);
  }

  /**
   * One-click link: connect the existing phone if there is one, otherwise
   * create a default phone, then fetch the QR. No form required.
   */
  async function startLink() {
    await doPhoneAction(
      "link",
      async () => {
        let phoneId = primaryPhone?.id;
        if (!phoneId) {
          const created = await api.createPhone({
            adapterType: "clario_gateway",
            displayName: "WhatsApp",
            providerInstanceId: `wa-${Math.random().toString(36).slice(2, 8)}`,
          });
          phoneId = created.id;
          await onChanged();
        }
        let qrValue = (await api.connectPhone(phoneId)).qr;
        // An already-linked number resumes its saved session and returns no QR.
        // Force a fresh QR by re-pairing (logout clears the saved session).
        if (!qrValue) {
          qrValue = (await api.repairPhone(phoneId)).qr;
        }
        setQr(qrValue ?? "Generating QR — refresh in a moment.");
        setQrImage(qrValue ? await toQrImage(qrValue) : null);
        await onChanged();
        return qrValue ? "Scan the QR with WhatsApp." : "Generating QR…";
      },
      "Link started",
    );
  }

  const sortedPhones = [...phones].sort((a, b) => {
    const statusScore = (status: string) =>
      status === "connected" ? 0 : status === "syncing" ? 1 : 2;
    return (
      statusScore(a.status) - statusScore(b.status) ||
      a.displayName.localeCompare(b.displayName)
    );
  });
  const gatewayPhones = sortedPhones.filter(
    (phone) => phone.adapterType === "clario_gateway",
  );
  const hiddenDevPhones = gatewayPhones.filter(
    (phone) =>
      phone.displayName.toLowerCase().startsWith("e2e phone") ||
      phone.providerInstanceId?.startsWith("e2e-"),
  );
  const visiblePhones = gatewayPhones.filter(
    (phone) => !hiddenDevPhones.includes(phone),
  );
  const primaryPhone =
    visiblePhones.find(
      (phone) => phone.providerInstanceId === "clario-support",
    ) ??
    visiblePhones.find((phone) => phone.status === "connected") ??
    visiblePhones[0] ??
    null;
  const additionalPhones = visiblePhones.filter(
    (phone) => phone.id !== primaryPhone?.id,
  );
  const legacyPhones = sortedPhones.filter(
    (phone) => phone.adapterType !== "clario_gateway",
  );

  useEffect(() => {
    if (
      !primaryPhone ||
      (primaryPhone.status !== "qr_required" &&
        primaryPhone.status !== "disconnected") ||
      qrImage
    )
      return;
    if (autoQrRequestedPhones.current.has(primaryPhone.id)) return;

    autoQrRequestedPhones.current.add(primaryPhone.id);
    void (async () => {
      setActionKey(`${primaryPhone.id}:qr`);
      try {
        const result = await api.connectPhone(primaryPhone.id);
        if (!result.qr) {
          autoQrRequestedPhones.current.delete(primaryPhone.id);
          setPhoneResult("QR is still generating. It will retry shortly.");
          return;
        }
        setQr(result.qr);
        setQrImage(await toQrImage(result.qr));
        setPhoneResult("Scan the QR with WhatsApp.");
      } catch (err) {
        autoQrRequestedPhones.current.delete(primaryPhone.id);
        setPhoneResult(
          err instanceof Error ? err.message : "Unable to retrieve QR",
        );
      } finally {
        setActionKey(null);
      }
    })();
  }, [api, primaryPhone?.id, primaryPhone?.status, qrImage]);

  useEffect(() => {
    const currentPhones = [...phones].sort((a, b) => {
      const statusScore = (status: string) =>
        status === "connected" ? 0 : status === "syncing" ? 1 : 2;
      return (
        statusScore(a.status) - statusScore(b.status) ||
        a.displayName.localeCompare(b.displayName)
      );
    });
    const timer = window.setInterval(() => {
      for (const phone of currentPhones.filter(
        (item) => item.adapterType === "clario_gateway",
      )) {
        if (phone.status === "qr_required" || phone.status === "syncing") {
          void api.phoneStatus(phone.id).then(async (result) => {
            await onChanged();
            if (
              result.status === "connected" &&
              !autoSyncedPhones.current.has(phone.id)
            ) {
              autoSyncedPhones.current.add(phone.id);
              setPhoneResult(
                `Connected ${result.phoneNumber ?? phone.displayName}. Syncing chats...`,
              );
              await api.syncGroups(phone.id);
              await onChanged();
            }
            if (result.status !== "connected") {
              autoSyncedPhones.current.delete(phone.id);
            }
          });
        }
        if (
          phone.status === "connected" &&
          !autoSyncedPhones.current.has(phone.id)
        ) {
          autoSyncedPhones.current.add(phone.id);
          void (async () => {
            setPhoneResult(
              `Connected ${phone.phoneNumber ?? phone.displayName}. Syncing chats...`,
            );
            await api.syncGroups(phone.id);
            await onChanged();
          })();
        }
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [api, onChanged, phones]);

  return (
    <section className="page-panel">
      <PanelTitle
        title="WhatsApp connection"
        subtitle={
          primaryPhone
            ? "Linked device for ClarioDesk chat sync"
            : "Connect one WhatsApp number to begin"
        }
      />
      {phoneResult ? <div className="inline-result">{phoneResult}</div> : null}
      {primaryPhone &&
      primaryPhone.status !== "qr_required" &&
      primaryPhone.status !== "disconnected" ? (
        <article className="phone-hero">
          <div className="phone-hero-main">
            <div
              className={`phone-hero-icon phone-hero-${primaryPhone.status}`}
            >
              {primaryPhone.status === "connected" ? (
                <CheckCircle2 size={24} aria-hidden="true" />
              ) : primaryPhone.status === "qr_required" ? (
                <QrCode size={24} aria-hidden="true" />
              ) : (
                <WifiOff size={24} aria-hidden="true" />
              )}
            </div>
            <div>
              <h2>{primaryPhone.displayName}</h2>
              <p>
                {primaryPhone.phoneNumber ??
                  "Number will appear after WhatsApp connects"}
              </p>
            </div>
          </div>
          <div className="phone-hero-status">
            <strong>
              {primaryPhone.status === "connected"
                ? "Connected"
                : primaryPhone.status.replace("_", " ")}
            </strong>
            <span>
              {primaryPhone.lastSyncAt
                ? `Last synced ${formatTime(primaryPhone.lastSyncAt)}`
                : "Chats will sync automatically after connection"}
            </span>
          </div>
          <div className="phone-hero-actions">
            {primaryPhone.status === "connected" ? (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={actionKey === `${primaryPhone.id}:sync`}
                  onClick={() =>
                    void doPhoneAction(
                      `${primaryPhone.id}:sync`,
                      async () => {
                        const result = await api.syncGroups(primaryPhone.id);
                        await onChanged();
                        autoSyncedPhones.current.add(primaryPhone.id);
                        return `${result.total} chats synced.`;
                      },
                      "Chats synced",
                    )
                  }
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {actionKey === `${primaryPhone.id}:sync`
                    ? "Syncing..."
                    : "Sync now"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={actionKey === `${primaryPhone.id}:repair`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Re-pair will unlink the current WhatsApp device and stop syncing until you scan a new QR. Continue?",
                      )
                    )
                      return;
                    void doPhoneAction(
                      `${primaryPhone.id}:repair`,
                      async () => {
                        const result = await api.repairPhone(primaryPhone.id);
                        setQr(
                          result.qr ??
                            "Re-pair started. The QR will appear shortly — click Refresh.",
                        );
                        setQrImage(
                          result.qr ? await toQrImage(result.qr) : null,
                        );
                        await onChanged();
                        return result.qr
                          ? "Device unlinked. Scan the new QR to re-pair."
                          : "Device unlinked. Generating QR...";
                      },
                      "Re-pair started",
                    );
                  }}
                >
                  <QrCode size={15} aria-hidden="true" />
                  {actionKey === `${primaryPhone.id}:repair`
                    ? "Unlinking..."
                    : "Re-pair (new QR)"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-action"
                disabled={actionKey === `${primaryPhone.id}:connect`}
                onClick={() =>
                  void doPhoneAction(
                    `${primaryPhone.id}:connect`,
                    async () => {
                      const result = await api.connectPhone(primaryPhone.id);
                      setQr(
                        result.qr ??
                          "QR not returned by gateway yet. Try again in a few seconds.",
                      );
                      setQrImage(result.qr ? await toQrImage(result.qr) : null);
                      await onChanged();
                      return result.qr
                        ? "QR generated for scanning."
                        : "Session is already connected.";
                    },
                    "Connection requested",
                  )
                }
              >
                <QrCode size={15} aria-hidden="true" />
                {actionKey === `${primaryPhone.id}:connect`
                  ? "Opening..."
                  : "Connect"}
              </button>
            )}
            <button
              type="button"
              className="secondary-action"
              disabled={actionKey === `${primaryPhone.id}:status`}
              onClick={() =>
                void doPhoneAction(
                  `${primaryPhone.id}:status`,
                  async () => {
                    const result = await api.phoneStatus(primaryPhone.id);
                    await onChanged();
                    if (
                      result.status === "connected" &&
                      !autoSyncedPhones.current.has(primaryPhone.id)
                    ) {
                      autoSyncedPhones.current.add(primaryPhone.id);
                      await api.syncGroups(primaryPhone.id);
                      await onChanged();
                    }
                    return result.phoneNumber
                      ? `Connected number: ${result.phoneNumber}`
                      : `Status: ${result.status}`;
                  },
                  "Status refreshed",
                )
              }
            >
              {actionKey === `${primaryPhone.id}:status`
                ? "Checking..."
                : "Refresh"}
            </button>
          </div>
        </article>
      ) : qr ? (
        <article className="wa-link">
          <div className="wa-link-info">
            <h2>Link a device</h2>
            <ol className="wa-link-steps">
              <li>
                Open <strong>WhatsApp</strong> on your phone
              </li>
              <li>
                Tap <strong>Menu</strong> or <strong>Settings</strong> and
                select <strong>Linked devices</strong>
              </li>
              <li>
                Tap <strong>Link a device</strong>
              </li>
              <li>Point your phone at this screen to capture the code</li>
            </ol>
            <button
              type="button"
              className="secondary-action"
              disabled={actionKey === "link"}
              onClick={() => void startLink()}
            >
              <RefreshCcw size={15} aria-hidden="true" />
              {actionKey === "link" ? "Refreshing…" : "Refresh QR"}
            </button>
          </div>
          <div className="wa-link-qr">
            {qrImage ? (
              <img src={qrImage} alt="WhatsApp link QR code" />
            ) : (
              <div className="wa-qr-pending">
                <QrCode size={32} aria-hidden="true" />
                <span>Generating…</span>
              </div>
            )}
          </div>
        </article>
      ) : (
        <article className="wa-link">
          <div className="wa-link-info">
            <h2>Link a device</h2>
            <p className="wa-link-lead">
              Connect your WhatsApp number to start receiving group messages in
              ClarioDesk.
            </p>
            <ol className="wa-link-steps">
              <li>
                Open <strong>WhatsApp</strong> on your phone
              </li>
              <li>
                Tap <strong>Menu</strong> or <strong>Settings</strong> and
                select <strong>Linked devices</strong>
              </li>
              <li>
                Tap <strong>Link a device</strong>
              </li>
              <li>Scan the QR that appears after you tap the button below</li>
            </ol>
            <button
              type="button"
              className="primary-action wa-link-button"
              disabled={actionKey === "link"}
              onClick={() => void startLink()}
            >
              <QrCode size={16} aria-hidden="true" />
              {actionKey === "link" ? "Starting…" : "Link a device"}
            </button>
          </div>
          <div className="wa-link-qr wa-link-qr-empty">
            <Smartphone size={48} aria-hidden="true" />
          </div>
        </article>
      )}

      {visiblePhones.length > 0 ? (
        <details className="phone-setup-panel">
          <summary>
            <Plus size={16} aria-hidden="true" />
            Advanced — add another number or a custom gateway
          </summary>
          <div className="phone-setup">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="WhatsApp number, optional"
            />
            <input
              value={providerInstanceId}
              onChange={(event) => setProviderInstanceId(event.target.value)}
              placeholder="Gateway instance id"
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              {advancedOpen ? "Hide advanced" : "Advanced"}
            </button>
            {advancedOpen ? (
              <>
                <input
                  value={gatewayBaseUrl}
                  onChange={(event) => setGatewayBaseUrl(event.target.value)}
                  placeholder="Gateway base URL"
                />
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="API key"
                />
              </>
            ) : null}
            <button
              className="primary-action"
              type="button"
              disabled={
                !displayName.trim() ||
                !providerInstanceId.trim() ||
                actionKey === "create"
              }
              onClick={() =>
                void doPhoneAction(
                  "create",
                  async () => {
                    await api.createPhone({
                      adapterType: "clario_gateway",
                      displayName,
                      providerInstanceId,
                      ...(phoneNumber.trim()
                        ? { phoneNumber: phoneNumber.trim() }
                        : {}),
                      ...(gatewayBaseUrl.trim()
                        ? { gatewayBaseUrl: gatewayBaseUrl.trim() }
                        : {}),
                      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
                    });
                    onChanged();
                  },
                  "Phone route created",
                )
              }
            >
              {actionKey === "create" ? "Adding..." : "Add route"}
            </button>
          </div>
          {additionalPhones.length > 0 ||
          hiddenDevPhones.length > 0 ||
          legacyPhones.length > 0 ? (
            <div className="phone-secondary-list">
              {additionalPhones.map((phone) => (
                <article className="phone-secondary-row" key={phone.id}>
                  <div>
                    <strong>{phone.displayName}</strong>
                    <span>
                      {phone.phoneNumber ??
                        phone.providerInstanceId ??
                        "No number yet"}
                    </span>
                  </div>
                  <em>{phone.status}</em>
                </article>
              ))}
              {hiddenDevPhones.length > 0 ? (
                <span>
                  {hiddenDevPhones.length} test route
                  {hiddenDevPhones.length === 1 ? "" : "s"} hidden from the main
                  view.
                </span>
              ) : null}
              {legacyPhones.length > 0 ? (
                <span>
                  {legacyPhones.length} legacy route
                  {legacyPhones.length === 1 ? "" : "s"} hidden from Core v1.
                </span>
              ) : null}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}

function ClientsView({
  api,
  clients,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  clients: ApiCustomer[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <section className="page-panel">
      <PanelTitle title="Clients" subtitle={`${clients.length} accounts`} />
      <div className="inline-form">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Client name"
        />
        <button
          className="primary-action"
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            void runAction(async () => {
              await api.createClient({ name });
              setName("");
              await onChanged();
            }, "Client created")
          }
        >
          Create client
        </button>
      </div>
      <div className="table-list">
        {clients.map((client) => (
          <ClientRow key={client.id} api={api} client={client} />
        ))}
      </div>
    </section>
  );
}

function ClientRow({
  api,
  client,
}: {
  api: ClarioApiClient;
  client: ApiCustomer;
}) {
  const projects = useAsyncData(
    () => api.projects(client.id),
    [api, client.id],
  );
  const [projectName, setProjectName] = useState("");
  return (
    <article className="data-row tall">
      <div>
        <strong>{client.name}</strong>
        <span>{client.status}</span>
        <div className="mini-list">
          {(projects.data ?? []).map((project) => (
            <em key={project.id}>{project.name}</em>
          ))}
        </div>
      </div>
      <div className="inline-form compact-form">
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Project name"
        />
        <button
          type="button"
          disabled={!projectName.trim()}
          onClick={() =>
            void (async () => {
              await api.createProject({
                clientId: client.id,
                name: projectName,
              });
              setProjectName("");
              await projects.refresh();
            })()
          }
        >
          Add project
        </button>
      </div>
    </article>
  );
}

function TeamView({
  api,
  members,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  members: ApiTeamMember[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "agent" | "viewer">("agent");
  return (
    <section className="page-panel">
      <PanelTitle title="Team" subtitle={`${members.length} members`} />
      <div className="inline-form">
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name"
        />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Temporary password"
          type="password"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          <option value="agent">Agent</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          className="primary-action"
          type="button"
          disabled={!email || !displayName || password.length < 8}
          onClick={() =>
            void runAction(async () => {
              await api.createUser({ email, displayName, password, role });
              setEmail("");
              setDisplayName("");
              setPassword("");
              await onChanged();
            }, "Team member created")
          }
        >
          Create user
        </button>
      </div>
      <div className="table-list">
        {members.map((member) => (
          <article className="data-row" key={member.userId}>
            <div>
              <strong>{member.displayName}</strong>
              <span>{member.email}</span>
            </div>
            <em>
              {member.role} / {member.status}
            </em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportsView({
  ops,
  onRefresh,
}: {
  ops: ApiOpsSummary | null;
  onRefresh: () => void;
}) {
  return (
    <section className="page-panel">
      <PanelTitle
        title="Reports"
        subtitle={
          ops ? `Generated ${formatTime(ops.generatedAt)}` : "No summary loaded"
        }
      />
      <button className="primary-action" type="button" onClick={onRefresh}>
        <RefreshCcw size={15} /> Refresh
      </button>
      <div className="metric-grid">
        <Metric label="Open tickets" value={ops?.tickets.open ?? 0} />
        <Metric label="Pending tickets" value={ops?.tickets.pending ?? 0} />
        <Metric label="Unmapped groups" value={ops?.channels.unmapped ?? 0} />
        <Metric
          label="Failed outbox"
          value={ops?.outbox.byStatus.failed ?? 0}
        />
      </div>
    </section>
  );
}

function SettingsView({
  session,
  onSignOut,
  onRefresh,
}: {
  session: AuthSession;
  onSignOut: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="page-panel">
      <PanelTitle
        title="Settings"
        subtitle={`Workspace ${session.workspaceId}`}
      />
      <div className="table-list">
        <article className="data-row">
          <div>
            <strong>Session</strong>
            <span>
              {session.role} user {session.userId}
            </span>
          </div>
          <div className="row-actions">
            <button type="button" onClick={onRefresh}>
              Refresh data
            </button>
            <button type="button" onClick={onSignOut}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function SetupEmpty({ onGoPhones }: { onGoPhones: () => void }) {
  return (
    <section className="page-panel center-panel">
      <Empty
        title="No WhatsApp chats yet"
        body="Add or connect a linked-device phone, then sync chats from the gateway."
      />
      <button className="primary-action" type="button" onClick={onGoPhones}>
        Open phone setup
      </button>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
    </header>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-panel">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function SearchResultGroup({
  title,
  items,
  emptyBody,
  onOpen,
}: {
  title: string;
  items: Array<{ id: string; body: string; channelId: string; meta: string }>;
  emptyBody: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="context-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <Empty title="No results" body={emptyBody} />
      ) : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="search-result-row"
          onClick={() => onOpen(item.channelId)}
        >
          <div>
            <strong>{item.body}</strong>
            <span>{item.channelId.slice(0, 8)}</span>
          </div>
          <em>{item.meta}</em>
        </button>
      ))}
    </section>
  );
}

function ChannelContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: ChannelMenuState;
  onClose: () => void;
  onAction: (
    action: ChannelMenuAction,
    channel: Channel,
  ) => void | Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const items: Array<
    | { kind: "separator" }
    | {
        kind: "action";
        action: ChannelMenuAction;
        label: string;
        icon: typeof Inbox;
      }
  > = [
    { kind: "action", action: "open", label: "Open chat", icon: Inbox },
    {
      kind: "action",
      action: "refresh",
      label: "Refresh from WhatsApp",
      icon: RefreshCcw,
    },
    ...(!state.channel.isMarkedUnread
      ? ([
          {
            kind: "action" as const,
            action: "mark-unread" as const,
            label: "Mark as unread",
            icon: MessageCircleMore,
          },
        ] as const)
      : []),
    { kind: "separator" },
    {
      kind: "action",
      action: state.channel.isPinned ? "unpin" : "pin",
      label: state.channel.isPinned ? "Unpin chat" : "Pin chat",
      icon: state.channel.isPinned ? PinOff : Pin,
    },
    {
      kind: "action",
      action: state.channel.isMuted ? "unmute" : "mute",
      label: state.channel.isMuted ? "Unmute chat" : "Mute chat",
      icon: state.channel.isMuted ? Bell : BellOff,
    },
    {
      kind: "action",
      action: state.channel.status === "archived" ? "unarchive" : "archive",
      label:
        state.channel.status === "archived" ? "Unarchive chat" : "Archive chat",
      icon: state.channel.status === "archived" ? ArchiveRestore : Archive,
    },
    { kind: "separator" },
    { kind: "action", action: "copy-title", label: "Copy title", icon: Copy },
    {
      kind: "action",
      action: "copy-provider-id",
      label: "Copy WhatsApp ID",
      icon: Clipboard,
    },
    {
      kind: "action",
      action: "copy-clario-id",
      label: "Copy ClarioDesk ID",
      icon: Clipboard,
    },
  ];

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!menuRef.current) return;
      const buttons = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>("button"),
      );
      if (!buttons.length) return;
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const target =
        event.key === "ArrowDown"
          ? buttons[(current + 1) % buttons.length]
          : event.key === "ArrowUp"
            ? buttons[(current - 1 + buttons.length) % buttons.length]
            : event.key === "Home"
              ? buttons[0]
              : event.key === "End"
                ? buttons.at(-1)
                : undefined;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="message-context-menu channel-context-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
      aria-label="Channel actions"
    >
      {items.map((item, index) => {
        if (item.kind === "separator")
          return (
            <div
              key={`sep-${index}`}
              className="menu-separator"
              role="separator"
            />
          );
        const Icon = item.icon;
        return (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            onClick={() => void onAction(item.action, state.channel)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildNavItems(
  ops: ApiOpsSummary | null,
  tickets: ApiTicket[],
): NavItem[] {
  return [
    {
      id: "inbox",
      label: "Inbox",
      icon: navIcons.inbox,
      count: ops?.channels.awaitingResponse,
    },
    {
      id: "tickets",
      label: "Tickets",
      icon: navIcons.tickets,
      count: tickets.filter((ticket) => ticket.status !== "closed").length,
    },
    { id: "search", label: "Search", icon: navIcons.search },
    { id: "phones", label: "Phones", icon: navIcons.phones },
    { id: "clients", label: "Clients", icon: navIcons.clients },
    { id: "team", label: "Team", icon: navIcons.team },
    { id: "reports", label: "Reports", icon: navIcons.reports },
    { id: "settings", label: "Settings", icon: navIcons.settings },
  ];
}

function toUiOps(ops: ApiOpsSummary | null): OpsSummary {
  return {
    connectedPhones: ops?.phones.byStatus.connected ?? 0,
    degradedPhones: ops?.phones.byStatus.degraded ?? 0,
    unmappedGroups: ops?.channels.unmapped ?? 0,
    awaitingResponses: ops?.channels.awaitingResponse ?? 0,
    failedOutbox: ops?.outbox.byStatus.failed ?? 0,
  };
}

function toUiChannels(
  channels: ApiChannel[],
  tickets: ApiTicket[],
  phones: ApiPhone[],
): Channel[] {
  const phoneStatus =
    phones.find((phone) => phone.status === "connected")?.status ??
    phones.find((phone) => phone.status === "syncing")?.status ??
    phones.find((phone) => phone.status === "degraded")?.status ??
    "qr_required";
  return channels.map((channel) => ({
    id: channel.id,
    providerChatId: channel.providerChatId,
    title:
      channel.title ??
      (channel.channelType === "group" ? "WhatsApp group" : "Unknown contact"),
    avatarUrl: channel.avatarUrl ?? undefined,
    channelType: channel.channelType,
    clientId: channel.clientId ?? undefined,
    client: channel.clientName ?? "",
    projectId: channel.projectId ?? undefined,
    project: channel.projectName ?? undefined,
    status: channel.status,
    isPinned: channel.isPinned,
    isMuted: channel.isMuted,
    isMarkedUnread: channel.isMarkedUnread,
    phoneStatus:
      phoneStatus === "connected" ||
      phoneStatus === "syncing" ||
      phoneStatus === "degraded"
        ? phoneStatus
        : "qr_required",
    lastActivityAt:
      channel.lastMessageAt ?? channel.awaitingResponseSince ?? null,
    lastMessage: channel.awaitingResponseSince
      ? "Waiting for support response"
      : (channel.lastMessage ??
        (channel.lastMessageType
          ? `[${channel.lastMessageType.replaceAll("_", " ")}]`
          : "No messages yet")),
    lastTime: channel.lastMessageAt
      ? formatTime(channel.lastMessageAt)
      : "No messages",
    unread: channel.isMarkedUnread || channel.awaitingResponseSince ? 1 : 0,
    openTickets: tickets.filter(
      (ticket) => ticket.channelId === channel.id && ticket.status !== "closed",
    ).length,
    awaitingResponseSince: channel.awaitingResponseSince
      ? formatTime(channel.awaitingResponseSince)
      : undefined,
  }));
}

function toUiMessage(message: ApiMessage): Message {
  return {
    id: message.id,
    kind: message.status === "deleted" ? "deleted" : message.direction,
    sender:
      message.senderName ??
      (message.sentByType === "dashboard_agent"
        ? "Support agent"
        : message.sentByType === "client_user"
          ? "Customer"
          : "WhatsApp user"),
    body: message.body ?? `[${message.messageType}]`,
    media: message.media ?? [],
    timestampAt: message.providerTimestamp,
    timestamp: formatTime(message.providerTimestamp),
    status: message.status,
  };
}

function toUiTicket(ticket: ApiTicket): UiTicket {
  return {
    id: ticket.id.slice(0, 8),
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority === "low" ? "normal" : ticket.priority,
    owner: ticket.assignedUserId
      ? ticket.assignedUserId.slice(0, 8)
      : "Unassigned",
  };
}

function filterChannels(
  channels: Channel[],
  query: string,
  view: ChannelView,
): Channel[] {
  const q = query.trim().toLowerCase();
  return filterChannelsByView(channels, view).filter((channel) => {
    const matchesQuery =
      !q ||
      `${channel.title} ${channel.client} ${channel.project ?? ""}`
        .toLowerCase()
        .includes(q);
    return matchesQuery;
  });
}

function memberName(members: ApiTeamMember[], id: string | null): string {
  if (!id) return "Unassigned";
  return (
    members.find((member) => member.userId === id)?.displayName ??
    id.slice(0, 8)
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function toQrImage(value: string): Promise<string> {
  if (value.startsWith("data:image/")) return value;
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 200) {
    return `data:image/png;base64,${value}`;
  }
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 7,
    color: {
      dark: "#14211f",
      light: "#ffffff",
    },
  });
}
