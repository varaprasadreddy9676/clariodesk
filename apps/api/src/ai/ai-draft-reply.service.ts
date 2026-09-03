import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import type { AppConfig } from "@clariodesk/config";
import { decryptSecret } from "@clariodesk/crypto";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { generateCompletion, type CompletionMessage } from "./ai-completion.js";

const HISTORY_LIMIT = 12;

const SYSTEM_PROMPT =
  "You are a support agent's assistant, drafting one reply to a customer " +
  "in a WhatsApp business inbox. Reply with only the message text the agent " +
  "would send — no preamble, no explanation, no quotation marks. Keep it " +
  "concise and professional, and answer in the same language as the customer.";

/**
 * Turns a configured BYOK connection into an actual feature: a suggested
 * reply draft, built from the channel's recent messages. Never persisted —
 * the draft is returned once and the agent edits or discards it in the
 * composer, same as anything else they type.
 */
@Injectable()
export class AiDraftReplyService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
  ) {}

  async draftReply(
    user: AuthUser,
    channelId: string,
  ): Promise<{ draft: string }> {
    await this.access.assertChannelAccess(user, channelId);

    const [connection] = await this.db
      .select()
      .from(schema.aiProviderConnections)
      .where(
        and(
          eq(schema.aiProviderConnections.workspaceId, user.workspaceId),
          eq(schema.aiProviderConnections.status, "active"),
        ),
      )
      .orderBy(desc(schema.aiProviderConnections.updatedAt))
      .limit(1);
    if (!connection) {
      throw new BadRequestException(
        "No active AI connection configured. Add one in Settings.",
      );
    }

    const history = await this.recentMessages(user.workspaceId, channelId);
    if (history.length === 0) {
      throw new BadRequestException(
        "There's no conversation history yet to draft a reply from.",
      );
    }

    const apiKey = decryptSecret(
      connection.encryptedApiKey,
      this.config.ENCRYPTION_KEY,
    );
    const result = await generateCompletion(
      connection.provider,
      apiKey,
      connection.baseUrl,
      connection.model,
      SYSTEM_PROMPT,
      history,
    );
    if (!result.ok) throw new BadRequestException(result.error);
    return { draft: result.text };
  }

  private async recentMessages(
    workspaceId: string,
    channelId: string,
  ): Promise<CompletionMessage[]> {
    const rows = await this.db
      .select({
        body: schema.messages.body,
        direction: schema.messages.direction,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.workspaceId, workspaceId),
          eq(schema.messages.channelId, channelId),
        ),
      )
      .orderBy(desc(schema.messages.providerTimestamp))
      .limit(HISTORY_LIMIT);

    const chronological = rows
      .filter(
        (row): row is { body: string; direction: "inbound" | "outbound" } =>
          Boolean(row.body?.trim()),
      )
      .reverse()
      .map(
        (row): CompletionMessage => ({
          role: row.direction === "outbound" ? "assistant" : "user",
          content: row.body,
        }),
      );

    return normalizeForCompletion(chronological);
  }
}

/**
 * Providers like Anthropic require strictly alternating roles starting with
 * "user" — merge consecutive same-role messages and drop any leading
 * assistant turn so the history is always valid, regardless of provider.
 */
function normalizeForCompletion(
  messages: CompletionMessage[],
): CompletionMessage[] {
  const withoutLeadingAssistant = [...messages];
  while (withoutLeadingAssistant[0]?.role === "assistant") {
    withoutLeadingAssistant.shift();
  }

  const merged: CompletionMessage[] = [];
  for (const message of withoutLeadingAssistant) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n${message.content}`;
    } else {
      merged.push({ ...message });
    }
  }
  return merged;
}
