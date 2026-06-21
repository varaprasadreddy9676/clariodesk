import { pgEnum } from "drizzle-orm/pg-core";
import {
  CHANNEL_STATUSES,
  CHANNEL_TYPES,
  CONNECTION_MODES,
  GATEWAY_ADAPTER_TYPES,
  MAPPING_MODES,
  MEDIA_SOURCES,
  MEDIA_STORAGE_STATUSES,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TYPES,
  OUTBOX_STATUSES,
  PHONE_STATUSES,
  POLICY_STATUSES,
  SEND_MODES,
  SENT_BY_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  WORKSPACE_ROLES,
} from "@clariodesk/types";

// Postgres enums mirror the canonical TS unions in @clariodesk/types so the
// database and application can never drift (TDD §6).
export const adapterTypeEnum = pgEnum("adapter_type", GATEWAY_ADAPTER_TYPES);
export const connectionModeEnum = pgEnum("connection_mode", CONNECTION_MODES);
export const phoneStatusEnum = pgEnum("phone_status", PHONE_STATUSES);
export const channelTypeEnum = pgEnum("channel_type", CHANNEL_TYPES);
export const channelStatusEnum = pgEnum("channel_status", CHANNEL_STATUSES);
export const mappingModeEnum = pgEnum("mapping_mode", MAPPING_MODES);
export const messageTypeEnum = pgEnum("message_type", MESSAGE_TYPES);
export const messageDirectionEnum = pgEnum(
  "message_direction",
  MESSAGE_DIRECTIONS,
);
export const sentByTypeEnum = pgEnum("sent_by_type", SENT_BY_TYPES);
export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);
export const sendModeEnum = pgEnum("send_mode", SEND_MODES);
export const outboxStatusEnum = pgEnum("outbox_status", OUTBOX_STATUSES);
export const policyStatusEnum = pgEnum("policy_status", POLICY_STATUSES);
export const mediaStorageStatusEnum = pgEnum(
  "media_storage_status",
  MEDIA_STORAGE_STATUSES,
);
export const mediaSourceEnum = pgEnum("media_source", MEDIA_SOURCES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const ticketPriorityEnum = pgEnum("ticket_priority", TICKET_PRIORITIES);
export const workspaceRoleEnum = pgEnum("workspace_role", WORKSPACE_ROLES);
