/**
 * Object-storage key builders (TDD §6.13, §9.3).
 *
 * SECURITY: media keys use an opaque `mediaId`, never the original filename —
 * WhatsApp filenames are frequently sensitive (TDD §23.3). Pure + testable.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** raw-events/{workspace}/{yyyy}/{mm}/{dd}/{eventId}.json.gz */
export function rawEventKey(
  workspaceId: string,
  eventId: string,
  at: Date,
): string {
  const yyyy = at.getUTCFullYear();
  const mm = pad2(at.getUTCMonth() + 1);
  const dd = pad2(at.getUTCDate());
  return `raw-events/${workspaceId}/${yyyy}/${mm}/${dd}/${eventId}.json.gz`;
}

/** media/{workspace}/{client}/{channel}/{yyyy}/{mm}/{messageId}/{mediaId} */
export function mediaKey(input: {
  workspaceId: string;
  clientId: string | null;
  channelId: string;
  messageId: string;
  mediaId: string;
  at: Date;
}): string {
  const yyyy = input.at.getUTCFullYear();
  const mm = pad2(input.at.getUTCMonth() + 1);
  const client = input.clientId ?? "_unmapped";
  return `media/${input.workspaceId}/${client}/${input.channelId}/${yyyy}/${mm}/${input.messageId}/${input.mediaId}`;
}
