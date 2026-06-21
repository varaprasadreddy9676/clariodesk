import type { Channel, Message } from "../types.js";

function timeValue(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function channelPriority(channel: Channel): number {
  if (channel.unread > 0) return 0;
  if (channel.awaitingResponseSince) return 1;
  return 2;
}

/**
 * Approximate WhatsApp chat ordering:
 * unread chats first, then waiting-for-reply threads, then the rest by newest activity.
 */
export function sortChannelsLikeWhatsApp(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const priorityDelta = channelPriority(a) - channelPriority(b);
    if (priorityDelta !== 0) return priorityDelta;

    const activityDelta =
      timeValue(b.lastActivityAt) - timeValue(a.lastActivityAt);
    if (activityDelta !== 0) return activityDelta;

    return a.title.localeCompare(b.title);
  });
}

/**
 * WhatsApp conversations read oldest-to-newest in the visible pane.
 * The API delivers newest-first pages, so we normalize the UI order here.
 */
export function sortMessagesLikeWhatsApp(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeDelta = timeValue(a.timestampAt) - timeValue(b.timestampAt);
    if (timeDelta !== 0) return timeDelta;
    return a.id.localeCompare(b.id);
  });
}
