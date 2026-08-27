import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { schema } from "@clariodesk/db";
import type { WorkerDeps } from "../context.js";
import type { PushNotifyJob } from "../queues.js";
import { PushService } from "../notify/push.service.js";
import { usersWithChannelAccess } from "../notify/recipients.js";

const BODY_PREVIEW_MAX_CHARS = 80;

/**
 * Sends a Web Push notification for one inbound message to every workspace
 * member who can see the channel and does NOT currently have the app open
 * (checked via realtime presence — TDD-adjacent, PWA notifications).
 */
export function makeNotifyPushProcessor(deps: WorkerDeps) {
  const push = new PushService(deps.config, deps.db, deps.logger);

  return async (job: Job<PushNotifyJob>): Promise<void> => {
    const { workspaceId, channelId, messageId } = job.data;
    const log = deps.logger.child({
      workspace_id: workspaceId,
      channel_id: channelId,
      job_id: job.id,
    });

    const rows = await deps.db
      .select({
        body: schema.messages.body,
        messageType: schema.messages.messageType,
        senderName: schema.contacts.canonicalName,
        channelTitle: schema.channels.title,
      })
      .from(schema.messages)
      .leftJoin(
        schema.contacts,
        eq(schema.contacts.id, schema.messages.senderContactId),
      )
      .innerJoin(
        schema.channels,
        eq(schema.channels.id, schema.messages.channelId),
      )
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    const message = rows[0];
    if (!message) {
      log.warn({ message_id: messageId }, "notify-push: message not found");
      return;
    }

    const recipients = await usersWithChannelAccess(
      deps.db,
      workspaceId,
      channelId,
    );
    if (recipients.length === 0) return;

    const online = await deps.presence.onlineUserIds(workspaceId);
    const targets = recipients.filter((id) => !online.has(id));
    if (targets.length === 0) return; // everyone who can see it is already looking

    const title = message.senderName ?? message.channelTitle ?? "New message";
    const body = previewText(message.body, message.messageType);

    await push.notifyUsers(workspaceId, targets, {
      title,
      body,
      url: `/channel/${channelId}`,
      tag: channelId,
    });

    log.debug({ recipient_count: targets.length }, "push notification sent");
  };
}

function previewText(body: string | null, messageType: string): string {
  if (body) {
    return body.length > BODY_PREVIEW_MAX_CHARS
      ? `${body.slice(0, BODY_PREVIEW_MAX_CHARS)}…`
      : body;
  }
  switch (messageType) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎤 Voice message";
    case "document":
      return "📄 Document";
    default:
      return "New message";
  }
}
