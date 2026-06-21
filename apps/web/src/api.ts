import type {
  CreateClientInput,
  CreateInternalNoteInput,
  CreatePhoneInput,
  CreateProjectInput,
  CreateUserInput,
  CreateTicketInput,
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
  title: string | null;
  channelType: "group" | "direct" | "official_direct";
  status: "active" | "archived" | "muted" | "unmapped";
  lastMessageAt: string | null;
  awaitingResponseSince: string | null;
  lastAgentReplyAt: string | null;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  mappingMode: "unmapped" | "single_client" | "mixed" | "archived" | null;
};

export type ApiMessage = {
  id: string;
  body: string | null;
  messageType: string;
  direction: "inbound" | "outbound" | "note";
  sentByType: string;
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
    return JSON.parse(raw) as AuthSession;
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
  constructor(private readonly getSession: () => AuthSession | null) {}

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

  channels(): Promise<ApiChannel[]> {
    return this.request("/channels");
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

  createNote(input: CreateInternalNoteInput): Promise<{ id: string }> {
    return this.request("/notes", { method: "POST", body: input });
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
    options: { method?: string; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers();
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    const session = this.getSession();
    if (options.auth !== false) {
      if (!session?.token) throw new Error("Not signed in");
      headers.set("Authorization", `Bearer ${session.token}`);
    }
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(toApiError(res.status, text));
    }
    return (await res.json()) as T;
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
