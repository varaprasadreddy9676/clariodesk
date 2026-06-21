import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { RealtimePublisher } from "@clariodesk/events";
import type {
  CreateDirectConversationInput,
  CreateGroupConversationInput,
} from "@clariodesk/schemas";
import type { AuthUser } from "../common/auth-context.js";
import { AuditService } from "../common/audit.service.js";
import { AdapterFactory } from "../core/adapters.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { TOKENS } from "../tokens.js";

type CreatedConversation = {
  channelId: string;
  providerChatId: string;
  outboxId: string | null;
};

type CommandReservation = {
  id: string;
  providerChatId: string | null;
  completed?: CreatedConversation;
};

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.ADAPTERS) private readonly adapters: AdapterFactory,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(TOKENS.REALTIME) private readonly realtime: RealtimePublisher,
  ) {}

  async createDirect(
    user: AuthUser,
    input: CreateDirectConversationInput,
  ): Promise<CreatedConversation> {
    this.assertCanCreate(user);
    const phone = await this.loadPhone(user, input.phoneInstanceId);
    const command = await this.beginCommand(
      user,
      phone.id,
      input.idempotencyKey,
      "direct",
    );
    if (command.completed) return command.completed;

    try {
      const adapter = this.adapters.forPhone(phone);
      if (!adapter.resolveNumber) {
        throw new BadRequestException(
          "This phone route cannot start new chats",
        );
      }
      const resolved = await adapter.resolveNumber({
        providerInstanceId: phone.providerInstanceId ?? phone.id,
        phoneNumber: input.phoneNumber,
      });
      if (!resolved.registered || !resolved.providerContactId) {
        throw new BadRequestException(
          "This number is not registered on WhatsApp",
        );
      }
      await this.saveProviderChatId(command.id, resolved.providerContactId);
      const channelId = await this.ensureChannel({
        user,
        phoneId: phone.id,
        providerChatId: resolved.providerContactId,
        channelType: "direct",
        title: input.phoneNumber,
      });
      const queued = await this.outbox.send(user, {
        channelId,
        body: input.initialMessage,
        useSendDelay: false,
        idempotencyKey: input.idempotencyKey,
      });
      const result = {
        channelId,
        providerChatId: resolved.providerContactId,
        outboxId: queued.outboxId,
      };
      await this.completeCommand(command.id, result);
      await this.recordCreated(user, channelId, "direct");
      return result;
    } catch (error) {
      await this.failCommand(command.id, error);
      throw error;
    }
  }

  async createGroup(
    user: AuthUser,
    input: CreateGroupConversationInput,
  ): Promise<CreatedConversation> {
    this.assertCanCreate(user);
    const phone = await this.loadPhone(user, input.phoneInstanceId);
    const command = await this.beginCommand(
      user,
      phone.id,
      input.idempotencyKey,
      "group",
    );
    if (command.completed) return command.completed;

    try {
      const adapter = this.adapters.forPhone(phone);
      if (!adapter.resolveNumber || !adapter.createGroup) {
        throw new BadRequestException("This phone route cannot create groups");
      }
      const providerInstanceId = phone.providerInstanceId ?? phone.id;
      let providerChatId = command.providerChatId;
      if (!providerChatId) {
        const resolved = await Promise.all(
          input.participantPhoneNumbers.map(async (phoneNumber) => ({
            phoneNumber,
            result: await adapter.resolveNumber?.({
              providerInstanceId,
              phoneNumber,
            }),
          })),
        );
        const invalid = resolved
          .filter(
            (item) =>
              !item.result?.registered || !item.result.providerContactId,
          )
          .map((item) => item.phoneNumber);
        if (invalid.length) {
          throw new BadRequestException({
            message: "Some participants are not registered on WhatsApp",
            invalidParticipants: invalid,
          });
        }
        const participantIds = [
          ...new Set(
            resolved.flatMap((item) =>
              item.result?.providerContactId
                ? [item.result.providerContactId]
                : [],
            ),
          ),
        ];
        const created = await adapter.createGroup({
          providerInstanceId,
          title: input.title,
          participantIds,
        });
        providerChatId = created.providerChatId;
        await this.saveProviderChatId(command.id, providerChatId);
      }
      const channelId = await this.ensureChannel({
        user,
        phoneId: phone.id,
        providerChatId,
        channelType: "group",
        title: input.title,
      });
      const queued = input.initialMessage
        ? await this.outbox.send(user, {
            channelId,
            body: input.initialMessage,
            useSendDelay: false,
            idempotencyKey: input.idempotencyKey,
          })
        : null;
      const result = {
        channelId,
        providerChatId,
        outboxId: queued?.outboxId ?? null,
      };
      await this.completeCommand(command.id, result);
      await this.recordCreated(user, channelId, "group");
      return result;
    } catch (error) {
      await this.failCommand(command.id, error);
      throw error;
    }
  }

  private async beginCommand(
    user: AuthUser,
    phoneInstanceId: string,
    idempotencyKey: string,
    commandType: "direct" | "group",
  ): Promise<CommandReservation> {
    const [created] = await this.db
      .insert(schema.conversationCommands)
      .values({
        workspaceId: user.workspaceId,
        phoneInstanceId,
        createdByUserId: user.userId,
        idempotencyKey,
        commandType,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: schema.conversationCommands.id });
    if (created) return { id: created.id, providerChatId: null };

    const [existing] = await this.db
      .select()
      .from(schema.conversationCommands)
      .where(
        and(
          eq(schema.conversationCommands.workspaceId, user.workspaceId),
          eq(schema.conversationCommands.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Conversation command reservation failed");
    if (existing.commandType !== commandType) {
      throw new ConflictException(
        "Idempotency key was used for another command",
      );
    }
    if (
      existing.status === "completed" &&
      existing.channelId &&
      existing.providerChatId
    ) {
      return {
        id: existing.id,
        providerChatId: existing.providerChatId,
        completed: {
          channelId: existing.channelId,
          providerChatId: existing.providerChatId,
          outboxId: existing.outboxId,
        },
      };
    }
    const stale = existing.updatedAt.getTime() < Date.now() - 5 * 60_000;
    if (existing.status === "pending" && !stale) {
      throw new ConflictException(
        "Conversation creation is already in progress",
      );
    }
    await this.db
      .update(schema.conversationCommands)
      .set({ status: "pending", failureReason: null, updatedAt: new Date() })
      .where(eq(schema.conversationCommands.id, existing.id));
    return { id: existing.id, providerChatId: existing.providerChatId };
  }

  private async saveProviderChatId(id: string, providerChatId: string) {
    await this.db
      .update(schema.conversationCommands)
      .set({ providerChatId, updatedAt: new Date() })
      .where(eq(schema.conversationCommands.id, id));
  }

  private async completeCommand(id: string, result: CreatedConversation) {
    await this.db
      .update(schema.conversationCommands)
      .set({ ...result, status: "completed", updatedAt: new Date() })
      .where(eq(schema.conversationCommands.id, id));
  }

  private async failCommand(id: string, error: unknown) {
    const reason = error instanceof Error ? error.message : "Unknown failure";
    await this.db
      .update(schema.conversationCommands)
      .set({
        status: "failed",
        failureReason: reason.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(schema.conversationCommands.id, id));
  }

  private assertCanCreate(user: AuthUser): void {
    if (user.role === "viewer") {
      throw new ForbiddenException("Viewers cannot create conversations");
    }
  }

  private async loadPhone(user: AuthUser, phoneId: string) {
    const [phone] = await this.db
      .select()
      .from(schema.phoneInstances)
      .where(
        and(
          eq(schema.phoneInstances.id, phoneId),
          eq(schema.phoneInstances.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    if (!phone) throw new NotFoundException("Phone route not found");
    if (phone.status !== "connected" && phone.status !== "syncing") {
      throw new ServiceUnavailableException(
        "Reconnect this phone before continuing",
      );
    }
    return phone;
  }

  private async ensureChannel(input: {
    user: AuthUser;
    phoneId: string;
    providerChatId: string;
    channelType: "direct" | "group";
    title: string;
  }): Promise<string> {
    const [existing] = await this.db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(
        and(
          eq(schema.channels.workspaceId, input.user.workspaceId),
          eq(schema.channels.phoneInstanceId, input.phoneId),
          eq(schema.channels.providerChatId, input.providerChatId),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
    const [created] = await this.db
      .insert(schema.channels)
      .values({
        workspaceId: input.user.workspaceId,
        phoneInstanceId: input.phoneId,
        providerChatId: input.providerChatId,
        channelType: input.channelType,
        title: input.title,
        subject: input.title,
        status: input.channelType === "direct" ? "active" : "unmapped",
      })
      .returning({ id: schema.channels.id });
    if (!created) throw new Error("Failed to create channel");
    return created.id;
  }

  private async recordCreated(
    user: AuthUser,
    channelId: string,
    channelType: "direct" | "group",
  ): Promise<void> {
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "conversation.created",
      targetType: "channel",
      targetId: channelId,
      metadata: { channelType },
    });
    await this.realtime.publish({
      type: "channel.updated",
      workspaceId: user.workspaceId,
      channelId,
      payload: { reason: "conversation_created", channelType },
    });
  }
}
