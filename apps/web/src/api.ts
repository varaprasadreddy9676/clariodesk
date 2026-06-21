import type {
  CreateClientInput,
  CreateInternalNoteInput,
  CreatePhoneInput,
  CreateProjectInput,
  CreateUserInput,
  CreateTicketInput,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  ChannelActionInput,
  LoginInput,
  MapChannelInput,
  SendReplyInput,
  UpdateTicketInput,
} from "@clariodesk/schemas";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "clariodesk.auth";

export type AuthSession = {
  token: string;
  userId: string;
  workspaceId: string;
  role: string;
};

export type ApiPhone = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  adapterType: string;
  connectionMode: string;
  status: string;
  riskLevel: string;
  providerInstanceId: string | null;
  gatewayBaseUrl: string | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
};

export type ApiChannel = {
  id: string;
  providerChatId: string;
  title: string | null;
  avatarUrl: string | null;
  channelType: "group" | "direct" | "official_direct";
  status: "active" | "archived" | "muted" | "unmapped";
  lastMessageAt: string | null;
  awaitingResponseSince: string | null;
  lastAgentReplyAt: string | null;
  lastMessage: string | null;
  lastMessageType: string | null;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  mappingMode: "unmapped" | "single_client" | "mixed" | "archived" | null;
  isPinned: boolean;
  isMuted: boolean;
  isMarkedUnread: boolean;
};

export type ApiMessage = {
  id: string;
  body: string | null;
  messageType: string;
  direction: "inbound" | "outbound" | "note";
  sentByType: string;
  senderName: string | null;
  providerTimestamp: string;
  isBackfill: boolean;
  status: string;
  media: Array<{
    id: string;
    mediaType: string;
    mimeType: string | null;
    fileName: string | null;
    storageStatus: string;
  }>;
};

export type ApiTimeline = {
  messages: ApiMessage[];
  nextCursor: number | null;
};

export type CreatedConversation = {
  channelId: string;
  providerChatId: string;
  outboxId: string | null;
};

export type ApiTicket = {
  id: string;
  title: string;
  status: "open" | "pending" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  channelId: string;
  clientId: string | null;
  assignedUserId: string | null;
  firstResponseAt?: string | null;
  createdAt: string;
};

export type ApiCustomer = {
  id: string;
  name: string;
  status: string;
};

export type ApiProject = {
  id: string;
  name: string;
  clientId: string;
  status: string;
};

export type ApiTeamMember = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
};

export type ApiOpsSummary = {
  generatedAt: string;
  phones: {
    byStatus: Record<string, number>;
    items: ApiPhone[];
  };
  channels: {
    unmapped: number;
    awaitingResponse: number;
  };
  tickets: {
    byStatus: Record<string, number>;
    open: number;
    pending: number;
  };
  outbox: {
    byStatus: Record<string, number>;
    recentFailures: Array<{
      id: string;
      channelId: string;
      failureReason: string | null;
      updatedAt: string;
    }>;
  };
  registry: {
    pendingMetadataEvents: number;
  };
  queues: Record<string, Record<string, number>>;
};

export type SearchResult = {
  messages: Array<{
    id: string;
    channelId: string;
    body: string | null;
    providerTimestamp: string;
  }>;
  tickets: Array<{
    id: string;
    channelId: string;
    title: string;
    status: string;
  }>;
};

export function readStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (isTokenExpired(session.token)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export function storeSession(session: AuthSession): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ClarioApiClient {
  constructor(
    private readonly getSession: () => AuthSession | null,
    private readonly onUnauthorized?: () => void,
  ) {}

  login(input: LoginInput): Promise<AuthSession> {
    return this.request<AuthSession>("/auth/login", {
      method: "POST",
      body: input,
      auth: false,
    });
  }

  register(input: {
    workspaceName: string;
    workspaceSlug: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthSession> {
    return this.request<AuthSession>("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
  }

  opsSummary(): Promise<ApiOpsSummary> {
    return this.request("/ops/summary");
  }

  phones(): Promise<ApiPhone[]> {
    return this.request("/phones");
  }

  createPhone(input: CreatePhoneInput): Promise<{ id: string }> {
    return this.request("/phones", { method: "POST", body: input });
  }

  connectPhone(id: string): Promise<{ qr: string | null }> {
    return this.request(`/phones/${id}/connect`, { method: "POST" });
  }

  repairPhone(id: string): Promise<{ qr: string | null }> {
    return this.request(`/phones/${id}/repair`, { method: "POST" });
  }

  phoneStatus(
    id: string,
  ): Promise<{ status: string; phoneNumber: string | null }> {
    return this.request(`/phones/${id}/status`);
  }

  syncGroups(
    id: string,
  ): Promise<{ total: number; created: number; updated: number }> {
    return this.request(`/phones/${id}/sync-groups`, { method: "POST" });
  }

  disconnectPhone(id: string): Promise<{ ok: true }> {
    return this.request(`/phones/${id}/disconnect`, { method: "POST" });
  }

  channels(view?: "archived"): Promise<ApiChannel[]> {
    return this.request(
      view === "archived" ? "/channels?view=archived" : "/channels",
    );
  }

  applyChannelAction(
    channelId: string,
    input: ChannelActionInput,
  ): Promise<{
    channelId: string;
    status: string;
    isPinned: boolean;
    isMuted: boolean;
    isMarkedUnread: boolean;
  }> {
    return this.request(`/channels/${channelId}/actions`, {
      method: "POST",
      body: input,
      timeoutMs: 25_000,
    });
  }

  clearChannelUnread(channelId: string): Promise<{
    channelId: string;
    isMarkedUnread: false;
  }> {
    return this.request(`/channels/${channelId}/read-state`, {
      method: "PATCH",
      body: { markedUnread: false },
      timeoutMs: 25_000,
    });
  }

  refreshChannel(channelId: string): Promise<{
    acceptedMessages: number;
    metadataChanged: boolean;
  }> {
    return this.request(`/channels/${channelId}/refresh`, {
      method: "POST",
      timeoutMs: 25_000,
    });
  }

  timeline(channelId: string): Promise<ApiTimeline> {
    return this.request(`/channels/${channelId}/messages?limit=50`);
  }

  syncMessages(
    channelId: string,
    limit = 50,
  ): Promise<{ accepted: number; reason?: string }> {
    return this.request(`/channels/${channelId}/sync-messages?limit=${limit}`, {
      method: "POST",
    });
  }

  clients(): Promise<ApiCustomer[]> {
    return this.request("/clients");
  }

  createClient(
    input: CreateClientInput,
  ): Promise<{ id: string; name: string }> {
    return this.request("/clients", { method: "POST", body: input });
  }

  projects(clientId: string): Promise<ApiProject[]> {
    return this.request(`/clients/${clientId}/projects`);
  }

  createProject(
    input: CreateProjectInput,
  ): Promise<{ id: string; name: string }> {
    return this.request("/projects", { method: "POST", body: input });
  }

  mapChannel(
    input: MapChannelInput,
  ): Promise<{ ok: true; mappingEffectiveAt: string }> {
    return this.request("/channels/map", { method: "POST", body: input });
  }

  tickets(): Promise<ApiTicket[]> {
    return this.request("/tickets");
  }

  createTicket(input: CreateTicketInput): Promise<{ id: string }> {
    return this.request("/tickets", { method: "POST", body: input });
  }

  updateTicket(id: string, input: UpdateTicketInput) {
    return this.request(`/tickets/${id}`, { method: "PATCH", body: input });
  }

  sendReply(input: SendReplyInput): Promise<{
    outboxId: string;
    sendAfter: string;
    cancellableForMs: number;
  }> {
    return this.request("/outbox", { method: "POST", body: input });
  }

  async sendMedia(input: {
    channelId: string;
    body: string;
    file: File;
    idempotencyKey: string;
  }): Promise<{
    outboxId: string;
    sendAfter: string;
    cancellableForMs: number;
  }> {
    return this.request("/outbox/media", {
      method: "POST",
      body: {
        channelId: input.channelId,
        body: input.body,
        fileName: input.file.name,
        mimeType: input.file.type,
        mediaBase64: await fileToBase64(input.file),
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  createDirectConversation(
    input: CreateDirectConversationInput,
  ): Promise<CreatedConversation> {
    return this.request("/conversations/direct", {
      method: "POST",
      body: input,
    });
  }

  createGroupConversation(
    input: CreateGroupConversationInput,
  ): Promise<CreatedConversation> {
    return this.request("/conversations/groups", {
      method: "POST",
      body: input,
    });
  }

  createNote(input: CreateInternalNoteInput): Promise<{ id: string }> {
    return this.request("/notes", { method: "POST", body: input });
  }

  reactToMessage(id: string, reaction: string): Promise<{ ok: true }> {
    return this.request(`/messages/${id}/reactions`, {
      method: "POST",
      body: { reaction },
    });
  }

  mediaUrl(id: string): Promise<{
    url: string;
    fileName: string | null;
    mimeType: string | null;
    expiresInSeconds: number;
  }> {
    return this.request(`/media/${id}/url`);
  }

  search(q: string): Promise<SearchResult> {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  }

  teamMembers(): Promise<ApiTeamMember[]> {
    return this.request("/team/members");
  }

  createUser(input: CreateUserInput): Promise<{ userId: string }> {
    return this.request("/team/users", { method: "POST", body: input });
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      auth?: boolean;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const headers = new Headers();
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    const session = this.getSession();
    if (options.auth !== false) {
      if (!session?.token) throw new Error("Not signed in");
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    const controller = new AbortController();
    const timeout = options.timeoutMs
      ? globalThis.setTimeout(() => controller.abort(), options.timeoutMs)
      : undefined;
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        signal: controller.signal,
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("WhatsApp did not confirm this change in time", {
          cause: error,
        });
      }
      throw error;
    } finally {
      if (timeout) globalThis.clearTimeout(timeout);
    }
    if (!res.ok) {
      if (res.status === 401 && options.auth !== false) {
        clearSession();
        this.onUnauthorized?.();
      }
      const text = await res.text().catch(() => "");
      throw new Error(toApiError(res.status, text));
    }
    return (await res.json()) as T;
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function isTokenExpired(token: string): boolean {
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp !== "number" || parsed.exp * 1_000 <= Date.now();
  } catch {
    return true;
  }
}

function toApiError(status: number, text: string): string {
  if (!text) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(", ");
    return parsed.message ?? parsed.error ?? `Request failed (${status})`;
  } catch {
    return text;
  }
}
