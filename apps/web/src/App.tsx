import {
  BarChart3,
  Eye,
  EyeOff,
  Inbox,
  LockKeyhole,
  MessageCircleMore,
  Phone,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  clearSession,
  ClarioApiClient,
  readStoredSession,
  storeSession,
  type ApiOpsSummary,
  type ApiTicket,
  type AuthSession,
} from "./api.js";
import { ChannelList, type ChannelView } from "./components/ChannelList.js";
import { Toast } from "./components/Toast.js";
import { Composer } from "./components/Composer.js";
import {
  ChannelContextMenu,
  type ChannelMenuAction,
  type ChannelMenuState,
} from "./components/ChannelContextMenu.js";
import { ContextPanel, type ContextTab } from "./components/ContextPanel.js";
import { Field } from "./components/Field.js";
import { NotificationCenter } from "./components/NotificationCenter.js";
import { NewConversationFab } from "./components/NewConversationFab.js";
import type { ComposerDraft } from "./components/Composer.js";
import { OpsBar } from "./components/OpsBar.js";
import { Sidebar } from "./components/Sidebar.js";
import { Timeline } from "./components/Timeline.js";
import { useAsyncData, useLatestRef } from "./hooks.js";
import { useRealtimeFeed, type RealtimeEvent } from "./realtime.js";
import {
  sortChannelsLikeWhatsApp,
  sortMessagesLikeWhatsApp,
} from "./lib/whatsapp-sort.js";
import {
  filterChannels,
  toUiChannels,
  toUiMessage,
  toUiOps,
  toUiTicket,
} from "./lib/ui-mappers.js";
import type { Channel, NavItem } from "./types.js";
import { TicketsView } from "./views/TicketsView.js";
import { SearchView } from "./views/SearchView.js";
import { PhonesView } from "./views/PhonesView.js";
import { ClientsView } from "./views/ClientsView.js";
import { TeamView } from "./views/TeamView.js";
import { ReportsView } from "./views/ReportsView.js";
import { SettingsView } from "./views/SettingsView.js";
import { SetupEmpty } from "./views/SetupEmpty.js";

type Toast = { kind: "ok" | "error"; text: string } | null;

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
  const cannedResponses = useAsyncData(() => api.cannedResponses(), [api]);
  const me = useAsyncData(() => api.me(), [api]);

  const mappedTickets = useMemo(
    () => (tickets.data ?? []).map((ticket) => toUiTicket(ticket, team.data ?? [])),
    [tickets.data, team.data],
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
      cannedResponses.refresh(),
      me.refresh(),
    ]);
  }, [
    cannedResponses,
    channelsRefreshRef,
    clients,
    me,
    opsRefreshRef,
    phonesRefreshRef,
    team,
    ticketsRefreshRef,
  ]);

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

  // A tapped push notification tells the (already-open) tab to jump to the
  // conversation, via the service worker's `notificationclick` handler.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type !== "navigate" || !data.url) return;
      const match = /^\/channel\/(.+)$/.exec(data.url);
      const channelId = match?.[1];
      if (!channelId) return;
      setActiveNav("inbox");
      selectChannel(channelId);
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [selectChannel]);

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
        <Toast toast={toast} />
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
            <div className="page-panel center-panel">
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
                  api={api}
                  channel={activeChannel}
                  draft={composerDraft}
                  signature={me.data?.signature}
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
            api={api}
            onSignOut={onSignOut}
            onRefresh={() => void refreshAll()}
            cannedResponses={cannedResponses.data ?? []}
            onCannedResponsesChanged={() => cannedResponses.refresh()}
            runAction={runAction}
            me={me.data}
            onMeChanged={() => me.refresh()}
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
