import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import { encryptSecret } from "@clariodesk/crypto";
import type { CreatePhoneInput } from "@clariodesk/schemas";
import type { NormalizedGatewayEvent, PhoneStatus } from "@clariodesk/types";
import type {
  GatewayChat,
  GatewayChatMessage,
} from "@clariodesk/gateway-adapters";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { assertAdmin } from "../common/roles.js";
import { AdapterFactory } from "../core/adapters.js";
import { QUEUE, QueueRegistry } from "../core/queues.js";

/** Maps a gateway connection status onto our phone-instance status enum. */
const STATUS_MAP: Record<string, PhoneStatus> = {
  connected: "connected",
  syncing: "syncing",
  disconnected: "disconnected",
  qr_required: "qr_required",
  degraded: "degraded",
  restricted: "restricted",
};

@Injectable()
export class PhonesService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    @Inject(TOKENS.ADAPTERS) private readonly adapters: AdapterFactory,
    @Inject(TOKENS.QUEUES) private readonly queues: QueueRegistry,
    private readonly audit: AuditService,
  ) {}

  /** List connected phone instances + their health (TDD §26.4). */
  async list(user: AuthUser) {
    return this.db
      .select({
        id: schema.phoneInstances.id,
        displayName: schema.phoneInstances.displayName,
        phoneNumber: schema.phoneInstances.phoneNumber,
        adapterType: schema.phoneInstances.adapterType,
        connectionMode: schema.phoneInstances.connectionMode,
        status: schema.phoneInstances.status,
        riskLevel: schema.phoneInstances.riskLevel,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        lastSeenAt: schema.phoneInstances.lastSeenAt,
        lastSyncAt: schema.phoneInstances.lastSyncAt,
      })
      .from(schema.phoneInstances)
      .where(
        and(
          eq(schema.phoneInstances.workspaceId, user.workspaceId),
          eq(schema.phoneInstances.adapterType, "clario_gateway"),
        ),
      );
  }

  async create(user: AuthUser, input: CreatePhoneInput) {
    assertAdmin(user);
    if (input.adapterType !== "clario_gateway") {
      throw new BadRequestException(
        "Core v1 supports only Clario Gateway phone routes",
      );
    }
    const [phone] = await this.db
      .insert(schema.phoneInstances)
      .values({
        workspaceId: user.workspaceId,
        adapterType: input.adapterType,
        displayName: input.displayName,
        providerInstanceId: input.providerInstanceId,
        phoneNumber: input.phoneNumber ?? null,
        gatewayBaseUrl: input.gatewayBaseUrl ?? null,
        // Encrypt the per-phone API key at rest (AES-256-GCM).
        encryptedApiKey: input.apiKey
          ? encryptSecret(input.apiKey, this.config.ENCRYPTION_KEY)
          : null,
        connectionMode: "linked_device",
        status: "qr_required",
      })
      .returning({ id: schema.phoneInstances.id });
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "phone.created",
      targetType: "phone_instance",
      targetId: phone?.id,
    });
    return phone;
  }

  /** Initiate linked-device connection; returns a QR to scan (TDD §8.1.3). */
  async connect(user: AuthUser, phoneId: string) {
    assertAdmin(user);
    const phone = await this.load(user, phoneId);
    const adapter = this.adapters.forPhone(phone);
    const result = await adapter.connect({
      providerInstanceId: phone.providerInstanceId ?? phoneId,
    });
    const live = adapter.getConnectionInfo
      ? await adapter.getConnectionInfo({
          providerInstanceId:
            result.providerInstanceId ?? phone.providerInstanceId ?? phoneId,
        })
      : {
          status: result.qr
            ? "qr_required"
            : await adapter.getConnectionStatus({
                providerInstanceId: phone.providerInstanceId ?? phoneId,
              }),
        };
    const mapped = STATUS_MAP[live.status] ?? "degraded";
    await this.db
      .update(schema.phoneInstances)
      .set({
        status: result.qr ? "qr_required" : mapped,
        ...(live.phoneNumber ? { phoneNumber: live.phoneNumber } : {}),
        lastSeenAt: new Date(),
        ...(mapped === "connected" ? { lastSyncAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.phoneInstances.id, phoneId));
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "phone.connect_requested",
      targetType: "phone_instance",
      targetId: phoneId,
    });
    return { qr: result.qr ?? null };
  }

  /**
   * Re-pair: unlink the current device (clearing saved auth) then start a fresh
   * session so a new QR can be scanned. Destructive — drops the existing live
   * WhatsApp link (TDD §8.1.6).
   */
  async repair(user: AuthUser, phoneId: string) {
    assertAdmin(user);
    const phone = await this.load(user, phoneId);
    const adapter = this.adapters.forPhone(phone);
    const providerInstanceId = phone.providerInstanceId ?? phoneId;
    if (adapter.logout) {
      await adapter.logout({ providerInstanceId });
    } else {
      await adapter.disconnect({ providerInstanceId });
    }
    const result = await adapter.connect({ providerInstanceId });
    await this.db
      .update(schema.phoneInstances)
      .set({
        status: result.qr ? "qr_required" : "disconnected",
        phoneNumber: null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.phoneInstances.id, phoneId));
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "phone.repair_requested",
      targetType: "phone_instance",
      targetId: phoneId,
    });
    return { qr: result.qr ?? null };
  }

  /** Refresh + persist live connection status from the gateway. */
  async status(user: AuthUser, phoneId: string) {
    const phone = await this.load(user, phoneId);
    const adapter = this.adapters.forPhone(phone);
    const live = adapter.getConnectionInfo
      ? await adapter.getConnectionInfo({
          providerInstanceId: phone.providerInstanceId ?? phoneId,
        })
      : {
          status: await adapter.getConnectionStatus({
            providerInstanceId: phone.providerInstanceId ?? phoneId,
          }),
        };
    const mapped = STATUS_MAP[live.status] ?? "degraded";
    await this.db
      .update(schema.phoneInstances)
      .set({
        status: mapped,
        ...(live.phoneNumber ? { phoneNumber: live.phoneNumber } : {}),
        lastSeenAt: new Date(),
        ...(mapped === "connected" ? { lastSyncAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.phoneInstances.id, phoneId));
    return { status: mapped, phoneNumber: live.phoneNumber ?? null };
  }

  /**
   * Sync the groups visible to the linked WhatsApp number into the Channel
   * Registry. Existing mappings are intentionally preserved.
   */
  async syncGroups(user: AuthUser, phoneId: string) {
    assertAdmin(user);
    const phone = await this.load(user, phoneId);
    const adapter = this.adapters.forPhone(phone);
    if (!adapter.fetchChats && !adapter.fetchGroups) {
      throw new BadRequestException("Gateway does not support chat sync");
    }

    const chats = adapter.fetchChats
      ? await adapter.fetchChats({
          providerInstanceId: phone.providerInstanceId ?? phoneId,
        })
      : ((await adapter.fetchGroups?.({
          providerInstanceId: phone.providerInstanceId ?? phoneId,
        })) ?? []);
    const now = new Date();

    const result = await this.db.transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let archived = 0;
      const seenProviderChatIds = new Set<string>();

      for (const chat of chats) {
        const providerChatId = chat.providerChatId.trim();
        if (!providerChatId || seenProviderChatIds.has(providerChatId))
          continue;
        seenProviderChatIds.add(providerChatId);

        const title = chat.title?.trim() || null;
        const [existing] = await tx
          .select({ id: schema.channels.id })
          .from(schema.channels)
          .where(
            and(
              eq(schema.channels.workspaceId, user.workspaceId),
              eq(schema.channels.phoneInstanceId, phoneId),
              eq(schema.channels.providerChatId, providerChatId),
            ),
          )
          .limit(1);

        if (existing) {
          await tx
            .update(schema.channels)
            .set({
              channelType: chat.channelType,
              ...(title ? { title, subject: title } : {}),
              updatedAt: now,
            })
            .where(eq(schema.channels.id, existing.id));
          updated += 1;
          continue;
        }

        await tx.insert(schema.channels).values({
          workspaceId: user.workspaceId,
          phoneInstanceId: phoneId,
          providerChatId,
          channelType: chat.channelType,
          title,
          subject: title,
          status: chat.channelType === "group" ? "unmapped" : "active",
        });
        created += 1;
      }

      const currentChannels = await tx
        .select({
          id: schema.channels.id,
          providerChatId: schema.channels.providerChatId,
        })
        .from(schema.channels)
        .where(
          and(
            eq(schema.channels.workspaceId, user.workspaceId),
            eq(schema.channels.phoneInstanceId, phoneId),
          ),
        );
      const staleProviderChatIds = currentChannels
        .map((channel) => channel.providerChatId)
        .filter((providerChatId) => !seenProviderChatIds.has(providerChatId));
      if (staleProviderChatIds.length > 0) {
        const archivedRows = await tx
          .update(schema.channels)
          .set({
            status: "archived",
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.channels.workspaceId, user.workspaceId),
              eq(schema.channels.phoneInstanceId, phoneId),
              inArray(schema.channels.providerChatId, staleProviderChatIds),
            ),
          )
          .returning({
            id: schema.channels.id,
            providerChatId: schema.channels.providerChatId,
            status: schema.channels.status,
          });
        archived = archivedRows.length;
      }

      await tx
        .update(schema.phoneInstances)
        .set({ lastSeenAt: now, lastSyncAt: now, updatedAt: now })
        .where(eq(schema.phoneInstances.id, phoneId));

      return { total: seenProviderChatIds.size, created, updated, archived };
    });

    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "phone.groups_synced",
      targetType: "phone_instance",
      targetId: phoneId,
      metadata: result,
    });

    void this.syncRecentHistory({
      workspaceId: user.workspaceId,
      phoneInstanceId: phoneId,
      providerInstanceId: phone.providerInstanceId ?? phoneId,
      adapter,
      chats,
    }).catch(() => undefined);

    return result;
  }

  async disconnect(user: AuthUser, phoneId: string) {
    assertAdmin(user);
    const phone = await this.load(user, phoneId);
    const adapter = this.adapters.forPhone(phone);
    await adapter
      .disconnect({ providerInstanceId: phone.providerInstanceId ?? phoneId })
      .catch(() => undefined);
    await this.db
      .update(schema.phoneInstances)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(schema.phoneInstances.id, phoneId));
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "phone.disconnected",
      targetType: "phone_instance",
      targetId: phoneId,
    });
    return { ok: true };
  }

  private async load(user: AuthUser, phoneId: string) {
    const rows = await this.db
      .select({
        id: schema.phoneInstances.id,
        adapterType: schema.phoneInstances.adapterType,
        providerInstanceId: schema.phoneInstances.providerInstanceId,
        gatewayBaseUrl: schema.phoneInstances.gatewayBaseUrl,
        encryptedApiKey: schema.phoneInstances.encryptedApiKey,
      })
      .from(schema.phoneInstances)
      .where(
        and(
          eq(schema.phoneInstances.id, phoneId),
          eq(schema.phoneInstances.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new NotFoundException("Phone instance not found");
    return rows[0];
  }

  private async syncRecentHistory(input: {
    workspaceId: string;
    phoneInstanceId: string;
    providerInstanceId: string;
    adapter: ReturnType<AdapterFactory["forPhone"]>;
    chats: GatewayChat[];
  }): Promise<void> {
    if (!input.adapter.fetchMessages) return;

    const limit = 30;
    const batchSize = 200;
    let batch: NormalizedGatewayEvent[] = [];

    for (const chat of input.chats) {
      let messages: GatewayChatMessage[];
      try {
        messages = await input.adapter.fetchMessages({
          providerInstanceId: input.providerInstanceId,
          providerChatId: chat.providerChatId,
          limit,
        });
      } catch {
        continue;
      }

      for (const message of messages) {
        batch.push(toNormalizedHistoryEvent(message, chat.channelType));
        if (batch.length >= batchSize) {
          await this.enqueueHistoryBatch(input, batch);
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await this.enqueueHistoryBatch(input, batch);
    }
  }

  private async enqueueHistoryBatch(
    input: {
      workspaceId: string;
      phoneInstanceId: string;
    },
    events: NormalizedGatewayEvent[],
  ): Promise<void> {
    await this.queues.messageNormalization.add(
      QUEUE.messageNormalization,
      {
        workspaceId: input.workspaceId,
        phoneInstanceId: input.phoneInstanceId,
        rawEventRefId: null,
        events,
        isReconnectSync: true,
      },
      {
        priority: 9,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );
  }
}

function toNormalizedHistoryEvent(
  message: GatewayChatMessage,
  channelType: NormalizedGatewayEvent["channelType"],
): NormalizedGatewayEvent {
  return {
    adapterType: "clario_gateway",
    providerMessageId: message.providerMessageId,
    providerChatId: message.providerChatId,
    providerSenderId: message.providerSenderId ?? undefined,
    channelType,
    messageType: toKnownMessageType(message.messageType),
    direction: message.direction,
    body: message.body ?? undefined,
    ...(message.media?.length ? { media: message.media } : {}),
    quotedProviderMessageId: message.quotedProviderMessageId ?? undefined,
    providerTimestampMs: message.providerTimestampMs,
    isHistorySync: true,
    raw: message,
  };
}

function toKnownMessageType(
  value: string,
): NormalizedGatewayEvent["messageType"] {
  switch (value) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
    case "reaction":
    case "location":
    case "contact_card":
    case "poll":
    case "system":
    case "deleted":
      return value;
    default:
      return "unknown";
  }
}
