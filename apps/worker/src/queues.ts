/** BullMQ queue names + job payload contracts (TDD §19). */

export const QUEUE = {
  rawEventUpload: "raw-event-upload",
  messageNormalization: "message-normalization",
  mediaDownloadLive: "media-download-live",
  mediaDownloadBackfill: "media-download-backfill",
  outboxSend: "outbox-send",
  backfill: "backfill",
  searchIndex: "search-index",
  notification: "notification",
  auditRetention: "audit-retention",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** Live message normalization runs at the highest priority (TDD §19.2). */
export const JOB_PRIORITY = {
  liveNormalize: 1,
  liveMedia: 1,
  outboxSend: 2,
  backfillNormalize: 8,
  backfillMedia: 9,
  searchIndex: 10,
} as const;

export type NormalizeJob = {
  workspaceId: string;
  phoneInstanceId: string;
  rawEventRefId: string | null;
  /** Normalized events extracted from the raw payload by the adapter. */
  events: import("@clariodesk/types").NormalizedGatewayEvent[];
  /** Phone is currently draining a reconnect backlog. */
  isReconnectSync: boolean;
};

export type MediaDownloadJob = {
  workspaceId: string;
  messageId: string;
  mediaId: string;
  phoneInstanceId: string;
  providerMediaId: string;
  providerMediaKey?: string;
};

export type OutboxSendJob = {
  workspaceId: string;
  outboxId: string;
};
