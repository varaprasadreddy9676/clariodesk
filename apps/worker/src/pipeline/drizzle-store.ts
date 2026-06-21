import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@clariodesk/db";
import { schema } from "@clariodesk/db";
import type {
  ChannelContext,
  InsertedMedia,
  InsertMediaRow,
  InsertMessageRow,
  NormalizationStore,
  SenderResolution,
} from "./ports.js";

const {
  channels,
  channelMappings,
  channelMemberships,
  contacts,
  contactIdentities,
  groupMetadataEvents,
  messages,
  messageMedia,
  outboxMessages,
  tickets,
  workspaceUserIdentities,
} = schema;

/** Strip the WhatsApp JID suffix to a bare phone/number. */
function jidToPhone(jid: string): string {
  return jid.split("@")[0]?.replace(/\D/g, "") ?? jid;
}

/**
 * Drizzle-backed implementation of {@link NormalizationStore} (TDD §8).
 * The orchestration logic in `normalize.ts` is tested with a fake; this adapter
 * is covered by integration tests (Testcontainers) — see PROGRESS §6.
 */
export class DrizzleNormalizationStore implements NormalizationStore {
  constructor(private readonly db: Database) {}

  async getOrCreateChannel(input: {
    workspaceId: string;
    phoneInstanceId: string;
    providerChatId: string;
    channelType: "group" | "direct" | "official_direct";
  }): Promise<ChannelContext> {
    const existing = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, input.workspaceId),
          eq(channels.phoneInstanceId, input.phoneInstanceId),
          eq(channels.providerChatId, input.providerChatId),
        ),
      )
      .limit(1);

    let channelId = existing[0]?.id;
    if (!channelId) {
      const inserted = await this.db
        .insert(channels)
        .values({
          workspaceId: input.workspaceId,
          phoneInstanceId: input.phoneInstanceId,
          providerChatId: input.providerChatId,
          channelType: input.channelType,
          status: "unmapped",
        })
        .onConflictDoNothing()
        .returning({ id: channels.id });
      channelId =
        inserted[0]?.id ??
        (
          await this.db
            .select({ id: channels.id })
            .from(channels)
            .where(
              and(
                eq(channels.workspaceId, input.workspaceId),
                eq(channels.phoneInstanceId, input.phoneInstanceId),
                eq(channels.providerChatId, input.providerChatId),
              ),
            )
            .limit(1)
        )[0]?.id;
    }
    if (!channelId) throw new Error("failed to resolve channel id");

    const mapping = await this.db
      .select({
        mappingMode: channelMappings.mappingMode,
        mappingEffectiveAt: channelMappings.mappingEffectiveAt,
        clientId: channelMappings.clientId,
        projectId: channelMappings.projectId,
      })
      .from(channelMappings)
      .where(
        and(
          eq(channelMappings.channelId, channelId),
          eq(channelMappings.status, "active"),
        ),
      )
      .limit(1);

    const m = mapping[0];
    return {
      channelId,
      mappingMode: m?.mappingMode ?? "unmapped",
      mappingEffectiveAtMs: m?.mappingEffectiveAt
        ? m.mappingEffectiveAt.getTime()
        : null,
      clientId: m?.clientId ?? null,
      projectId: m?.projectId ?? null,
    };
  }

  async resolveSender(input: {
    workspaceId: string;
    channelId: string;
    providerSenderId: string | null;
    senderDisplayName: string | null;
    clientId: string | null;
    projectId: string | null;
    phoneInstanceOwner: boolean;
    createIfMissing: boolean;
  }): Promise<SenderResolution> {
    if (!input.providerSenderId) {
      return { contactId: null, isInternal: input.phoneInstanceOwner };
    }

    // Resolve the contact behind this provider id.
    const ident = await this.db
      .select({ contactId: contactIdentities.contactId })
      .from(contactIdentities)
      .where(
        and(
          eq(contactIdentities.workspaceId, input.workspaceId),
          eq(contactIdentities.provider, "whatsapp"),
          eq(contactIdentities.providerUserId, input.providerSenderId),
        ),
      )
      .limit(1);
    let contactId = ident[0]?.contactId ?? null;

    // Auto-create the contact + identity + membership for inbound senders so
    // the contact directory and channel member lists populate (FRS §14).
    if (!contactId && input.createIfMissing) {
      contactId = await this.createContact(
        input.workspaceId,
        input.providerSenderId,
        input.senderDisplayName,
      );
    }
    if (contactId && input.createIfMissing) {
      await this.upsertMembership({
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        contactId,
        clientId: input.clientId,
        projectId: input.projectId,
        displayName: input.senderDisplayName,
      });
    }

    // Explicit channel-membership override wins (FRS §14.6).
    if (contactId) {
      const membership = await this.db
        .select({ override: channelMemberships.isInternalOverride })
        .from(channelMemberships)
        .where(
          and(
            eq(channelMemberships.channelId, input.channelId),
            eq(channelMemberships.contactId, contactId),
          ),
        )
        .limit(1);
      const override = membership[0]?.override;
      if (override !== null && override !== undefined) {
        return { contactId, isInternal: override };
      }
    }

    // Global inference: phone belongs to an active workspace user identity.
    const phone = jidToPhone(input.providerSenderId);
    const internal = await this.db
      .select({ id: workspaceUserIdentities.id })
      .from(workspaceUserIdentities)
      .where(
        and(
          eq(workspaceUserIdentities.workspaceId, input.workspaceId),
          eq(workspaceUserIdentities.phone, phone),
          eq(workspaceUserIdentities.status, "active"),
        ),
      )
      .limit(1);

    return {
      contactId,
      isInternal: internal.length > 0 || input.phoneInstanceOwner,
    };
  }

  /**
   * Create a contact + its provider identity for a newly-seen sender. Races are
   * resolved by the (workspace, phone) unique index — on conflict we return the
   * existing contact rather than failing.
   */
  private async createContact(
    workspaceId: string,
    providerUserId: string,
    displayName: string | null,
  ): Promise<string> {
    const phone = jidToPhone(providerUserId);
    const name = displayName?.trim() || phone;

    const insertedContact = await this.db
      .insert(contacts)
      .values({ workspaceId, primaryPhone: phone, canonicalName: name })
      .onConflictDoNothing()
      .returning({ id: contacts.id });

    let contactId = insertedContact[0]?.id;
    if (!contactId) {
      const existing = await this.db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.workspaceId, workspaceId),
            eq(contacts.primaryPhone, phone),
          ),
        )
        .limit(1);
      contactId = existing[0]?.id;
    }
    if (!contactId) throw new Error("failed to resolve contact");

    await this.db
      .insert(contactIdentities)
      .values({
        workspaceId,
        contactId,
        provider: "whatsapp",
        providerUserId,
        phone,
      })
      .onConflictDoNothing();
    return contactId;
  }

  /** Upsert the contact's membership in this channel, refreshing alias + last-seen. */
  private async upsertMembership(input: {
    workspaceId: string;
    channelId: string;
    contactId: string;
    clientId: string | null;
    projectId: string | null;
    displayName: string | null;
  }): Promise<void> {
    await this.db
      .insert(channelMemberships)
      .values({
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        contactId: input.contactId,
        clientId: input.clientId,
        projectId: input.projectId,
        displayNameInChannel: input.displayName,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [channelMemberships.channelId, channelMemberships.contactId],
        set: {
          displayNameInChannel: input.displayName,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  async findMessageByIdempotency(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.channelId, channelId),
          eq(messages.providerMessageId, providerMessageId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findOutboxByProviderMessageId(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: outboxMessages.id })
      .from(outboxMessages)
      .where(
        and(
          eq(outboxMessages.workspaceId, workspaceId),
          eq(outboxMessages.channelId, channelId),
          eq(outboxMessages.providerMessageId, providerMessageId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async insertMessage(row: InsertMessageRow): Promise<{ id: string }> {
    const inserted = await this.db
      .insert(messages)
      .values(toMessageValues(row))
      .onConflictDoNothing()
      .returning({ id: messages.id });
    if (inserted[0]) return inserted[0];
    // Lost an idempotency race — return the row the winner inserted.
    const existing = await this.findMessageByIdempotency(
      row.workspaceId,
      row.channelId,
      row.providerMessageId,
    );
    if (!existing) throw new Error("insertMessage failed and no existing row");
    return existing;
  }

  async mergeOutboxEcho(
    outboxId: string,
    row: InsertMessageRow,
  ): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(outboxMessages)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(outboxMessages.id, outboxId));
      const inserted = await tx
        .insert(messages)
        .values({ ...toMessageValues(row), status: "sent" })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      if (inserted[0]) return inserted[0];
      const existing = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, row.workspaceId),
            eq(messages.channelId, row.channelId),
            eq(messages.providerMessageId, row.providerMessageId),
          ),
        )
        .limit(1);
      if (!existing[0]) throw new Error("mergeOutboxEcho failed");
      return existing[0];
    });
  }

  async insertMedia(rows: InsertMediaRow[]): Promise<InsertedMedia[]> {
    const newRows: InsertMediaRow[] = [];
    for (const row of rows) {
      if (row.providerMediaId) {
        const existing = await this.db
          .select({ id: messageMedia.id })
          .from(messageMedia)
          .where(
            and(
              eq(messageMedia.messageId, row.messageId),
              eq(messageMedia.providerMediaId, row.providerMediaId),
            ),
          )
          .limit(1);
        if (existing[0]) continue;
      }
      newRows.push(row);
    }
    if (newRows.length === 0) return [];

    const values = newRows.map((row) => ({
      workspaceId: row.workspaceId,
      messageId: row.messageId,
      clientId: row.clientId,
      channelId: row.channelId,
      mediaType: row.mediaType,
      mimeType: row.mimeType,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
      providerMediaId: row.providerMediaId,
      providerMediaKey: row.providerMediaKey,
      source: row.source,
      storageStatus: "pending" as const,
    }));
    const inserted = await this.db
      .insert(messageMedia)
      .values(values)
      .returning({ id: messageMedia.id });
    return inserted.map((r, i) => ({ mediaId: r.id, row: newRows[i]! }));
  }

  async touchChannelLastMessage(channelId: string, at: Date): Promise<void> {
    // Bind the timestamp as an ISO string with an explicit cast: interpolating a
    // raw Date into a sql fragment leaves postgres-js without a type to bind.
    const atIso = at.toISOString();
    await this.db
      .update(channels)
      .set({ lastMessageAt: at })
      .where(
        and(
          eq(channels.id, channelId),
          // Only move the marker forward.
          sql`(${channels.lastMessageAt} is null or ${channels.lastMessageAt} < ${atIso}::timestamptz)`,
        ),
      );
  }

  async markAwaitingResponse(channelId: string, at: Date): Promise<void> {
    // Only set when not already waiting, so the clock tracks the OLDEST
    // unanswered client message.
    await this.db
      .update(channels)
      .set({ awaitingResponseSince: at })
      .where(
        and(
          eq(channels.id, channelId),
          sql`${channels.awaitingResponseSince} is null`,
        ),
      );
  }

  async recordTeamResponse(channelId: string, at: Date): Promise<void> {
    await this.db
      .update(channels)
      .set({ awaitingResponseSince: null, lastAgentReplyAt: at })
      .where(eq(channels.id, channelId));
    // Stamp first response on open tickets in this channel that lack it.
    await this.db
      .update(tickets)
      .set({ firstResponseAt: at })
      .where(
        and(
          eq(tickets.channelId, channelId),
          sql`${tickets.firstResponseAt} is null`,
          sql`${tickets.status} <> 'closed'`,
        ),
      );
  }

  async markMessageDeleted(
    workspaceId: string,
    channelId: string,
    providerMessageId: string,
  ): Promise<string | null> {
    const updated = await this.db
      .update(messages)
      .set({ status: "deleted_on_whatsapp", updatedAt: new Date() })
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.channelId, channelId),
          eq(messages.providerMessageId, providerMessageId),
        ),
      )
      .returning({ id: messages.id });
    return updated[0]?.id ?? null;
  }

  async recordGroupMetadataEvent(input: {
    workspaceId: string;
    channelId: string;
    clientId: string | null;
    projectId: string | null;
    eventType: string;
    oldValue: string | null;
    newValue: string | null;
    providerTimestamp: Date;
  }): Promise<void> {
    await this.db.insert(groupMetadataEvents).values({
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      eventType: input.eventType,
      oldValue: input.oldValue,
      newValue: input.newValue,
      providerTimestamp: input.providerTimestamp,
      reviewStatus: "pending",
    });
    // Keep the channel's stored title fresh on a rename.
    if (input.eventType === "subject_changed" && input.newValue) {
      await this.db
        .update(channels)
        .set({ title: input.newValue, updatedAt: new Date() })
        .where(eq(channels.id, input.channelId));
    }
  }
}

function toMessageValues(row: InsertMessageRow) {
  return {
    workspaceId: row.workspaceId,
    channelId: row.channelId,
    clientId: row.clientId,
    projectId: row.projectId,
    phoneInstanceId: row.phoneInstanceId,
    providerMessageId: row.providerMessageId,
    providerChatId: row.providerChatId,
    providerSenderId: row.providerSenderId,
    senderContactId: row.senderContactId,
    messageType: row.messageType,
    direction: row.direction,
    sentByType: row.sentByType,
    body: row.body,
    quotedProviderMessageId: row.quotedProviderMessageId,
    providerTimestamp: row.providerTimestamp,
    isBackfill: row.isBackfill,
    isLiveEvent: row.isLiveEvent,
    automationSuppressed: row.automationSuppressed,
    automationSuppressedReason: row.automationSuppressedReason,
    slaEligible: row.slaEligible,
    ticketAutoCreateEligible: row.ticketAutoCreateEligible,
    rawEventRefId: row.rawEventRefId,
  };
}
