import type { Channel, Message } from "../types.js";

function timeValue(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

export type ChannelView = "all" | "groups" | "direct" | "unread" | "archived";

/**
 * WhatsApp-style ordering with provider-confirmed pins kept above activity.
 */
export function sortChannelsLikeWhatsApp(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const pinDelta = Number(b.isPinned) - Number(a.isPinned);
    if (pinDelta !== 0) return pinDelta;

    const activityDelta =
      timeValue(b.lastActivityAt) - timeValue(a.lastActivityAt);
    if (activityDelta !== 0) return activityDelta;

    return a.id.localeCompare(b.id);
  });
}

export function filterChannelsByView(
  channels: Channel[],
  view: ChannelView,
): Channel[] {
  return channels.filter((channel) => {
    if (view === "archived") return channel.status === "archived";
    if (channel.status === "archived") return false;
    if (view === "groups") return channel.channelType === "group";
    if (view === "direct") return channel.channelType !== "group";
    if (view === "unread") return channel.isMarkedUnread || channel.unread > 0;
    return true;
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
