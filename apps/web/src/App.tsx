import {
  BarChart3,
  CheckCircle2,
  Clipboard,
  Copy,
  Inbox,
  LogOut,
  Phone,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  Smartphone,
  Ticket,
  Users,
  WifiOff,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ComposerDraft } from "./components/Composer.js";
import { OpsBar } from "./components/OpsBar.js";
import { Sidebar } from "./components/Sidebar.js";
import { Timeline } from "./components/Timeline.js";
import { useAsyncData } from "./hooks.js";
import { useRealtimeFeed, type RealtimeEvent } from "./realtime.js";
import {
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
type ChannelMenuAction = "open" | "copy-title" | "copy-id";

type ChannelMenuState = {
  channel: Channel;
  x: number;
  y: number;
};

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

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    readStoredSession(),
  );
  const api = useMemo(
    () => new ClarioApiClient(() => readStoredSession()),
    [session],
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
  const [email, setEmail] = useState("admin@demo.test");
  const [password, setPassword] = useState("demo-password");
  const [displayName, setDisplayName] = useState("Demo Admin");
  const [workspaceName, setWorkspaceName] = useState("Demo Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState("demo");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
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
              workspaceSlug,
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
      <section className="auth-card" aria-label="Sign in">
        <div className="brand-lockup large">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div>
            <strong>ClarioDesk</strong>
            <span>WhatsApp group operations</span>
          </div>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={mode === "login" ? "is-active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "is-active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>
        {mode === "register" ? (
          <>
            <Field
              label="Workspace"
              value={workspaceName}
              onChange={setWorkspaceName}
            />
            <Field
              label="Workspace slug"
              value={workspaceSlug}
              onChange={setWorkspaceSlug}
            />
            <Field
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
            />
          </>
        ) : null}
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
        />
        {error ? <div className="form-error">{error}</div> : null}
        <button
          className="primary-action wide"
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? "Checking..."
            : mode === "login"
              ? "Sign in"
              : "Create workspace"}
        </button>
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
  const channels = useAsyncData(() => api.channels(), [api]);
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

  const refreshAll = useCallback(async () => {
    await Promise.all([
      ops.refresh(),
      phones.refresh(),
      channels.refresh(),
      tickets.refresh(),
      clients.refresh(),
      team.refresh(),
    ]);
  }, [channels, clients, ops, phones, team, tickets]);

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
        scheduleRefresh("channels", () => channels.refresh());
        scheduleRefresh("ops", () => ops.refresh());
      }
      if (event.type === "phone.status_changed") {
        scheduleRefresh("phones", () => phones.refresh());
        scheduleRefresh("ops", () => ops.refresh());
      }
      if (event.type === "ticket.created" || event.type === "ticket.updated") {
        scheduleRefresh("tickets", () => tickets.refresh());
        scheduleRefresh("ops", () => ops.refresh());
      }
      if (
        event.type === "note.created" ||
        event.type === "outbox.status_changed"
      ) {
        scheduleRefresh("ops", () => ops.refresh());
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
        scheduleRefresh("timeline", () => timeline.refresh());
      }
    },
    [
      activeChannel?.id,
      channels,
      ops,
      phones,
      tickets,
      timeline,
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
    if (activeChannel.status === "muted") return;
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
        x: Math.min(x, window.innerWidth - 296),
        y: Math.min(y, window.innerHeight - 260),
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
      case "copy-title":
        void navigator.clipboard.writeText(channel.title).then(
          () => setToast({ kind: "ok", text: "Channel title copied" }),
          () => setToast({ kind: "error", text: "Clipboard write failed" }),
        );
        break;
      case "copy-id":
        void navigator.clipboard.writeText(channel.id).then(
          () => setToast({ kind: "ok", text: "Channel ID copied" }),
          () => setToast({ kind: "error", text: "Clipboard write failed" }),
        );
        break;
      default:
        break;
    }
  }

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
          activeChannel ? (
            <div
              className={`inbox-grid ${contextOpen ? "" : "context-closed"}`}
            >
              <ChannelList
                channels={filteredChannels}
                activeId={activeChannel.id}
                onSelect={setActiveChannelId}
                onOpenMenu={openChannelMenu}
                query={channelQuery}
                onQueryChange={setChannelQuery}
                view={channelView}
                onViewChange={setChannelView}
              />
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
                  onResolveMediaUrl={(mediaId) => api.mediaUrl(mediaId)}
                  contextOpen={contextOpen}
                  onToggleContext={() => setContextOpen((value) => !value)}
                />
                <Composer
                  channel={activeChannel}
                  draft={composerDraft}
                  onSendReply={async (body) => {
                    await api.sendReply({
                      channelId: activeChannel.id,
                      body,
                      useSendDelay: true,
                    });
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
        const result = await api.connectPhone(phoneId);
        setQr(result.qr ?? "Generating QR — refresh in a moment.");
        setQrImage(result.qr ? await toQrImage(result.qr) : null);
        await onChanged();
        return result.qr ? "Scan the QR with WhatsApp." : "Generating QR…";
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        type={type}
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
    { kind: "separator" },
    { kind: "action", action: "copy-title", label: "Copy title", icon: Copy },
    { kind: "action", action: "copy-id", label: "Copy ID", icon: Clipboard },
  ];

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
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
            <Icon size={18} aria-hidden="true" />
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
    title: channel.title ?? "Untitled WhatsApp group",
    channelType: channel.channelType,
    clientId: channel.clientId ?? undefined,
    client: channel.clientName ?? "",
    projectId: channel.projectId ?? undefined,
    project: channel.projectName ?? undefined,
    status: channel.status === "archived" ? "muted" : channel.status,
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
      : "No recent preview",
    lastTime: channel.lastMessageAt
      ? formatTime(channel.lastMessageAt)
      : "No messages",
    unread: channel.awaitingResponseSince ? 1 : 0,
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
    sender: message.sentByType,
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
  return channels.filter((channel) => {
    const matchesQuery =
      !q ||
      `${channel.title} ${channel.client} ${channel.project ?? ""}`
        .toLowerCase()
        .includes(q);
    const matchesView =
      view === "all" ||
      (view === "groups" && channel.channelType === "group") ||
      (view === "direct" && channel.channelType !== "group") ||
      (view === "unread" && channel.unread > 0);
    if (channel.status === "muted") return false;
    return matchesQuery && matchesView;
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
