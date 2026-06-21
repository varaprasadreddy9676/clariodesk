import { z } from "zod";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  MAPPING_MODES,
  WORKSPACE_ROLES,
} from "@clariodesk/types";

/**
 * Zod schemas for API request boundaries (CLAUDE.md: "Validate all user input
 * before processing… fail fast with clear error messages"). Shared so the
 * frontend can reuse the same contracts.
 */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const createProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const mapChannelSchema = z.object({
  channelId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  mappingMode: z.enum(MAPPING_MODES),
  notes: z.string().max(2000).optional(),
});
export type MapChannelInput = z.infer<typeof mapChannelSchema>;

export const sendReplySchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().min(1).max(4096),
  quotedMessageId: z.string().uuid().optional(),
  /** Hold the message for the configured send-delay before dispatch. */
  useSendDelay: z.boolean().default(true),
});
export type SendReplyInput = z.infer<typeof sendReplySchema>;

export const createInternalNoteSchema = z.object({
  channelId: z.string().uuid(),
  ticketId: z.string().uuid().optional(),
  body: z.string().min(1).max(8000),
});
export type CreateInternalNoteInput = z.infer<typeof createInternalNoteSchema>;

export const createTicketSchema = z.object({
  channelId: z.string().uuid(),
  sourceMessageId: z.string().uuid(),
  // For mixed-mode channels the client/project must be chosen explicitly
  // (TDD §11.4); for single_client channels it is inherited server-side.
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(8000).optional(),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
  assignedUserId: z.string().uuid().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedUserId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(8000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided.",
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(WORKSPACE_ROLES),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const createPhoneSchema = z.object({
  adapterType: z.literal("clario_gateway").default("clario_gateway"),
  displayName: z.string().min(1).max(200),
  /** Clario Gateway session handle. */
  providerInstanceId: z.string().min(1).max(200),
  phoneNumber: z.string().max(40).optional(),
  /** Optional per-phone gateway credentials (apiKey is encrypted at rest). */
  gatewayBaseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).max(500).optional(),
});
export type CreatePhoneInput = z.infer<typeof createPhoneSchema>;

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(200),
  role: z.enum(WORKSPACE_ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const assignClientSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  accessLevel: z.enum(["agent", "viewer"]).default("agent"),
});
export type AssignClientInput = z.infer<typeof assignClientSchema>;

export const assignChannelSchema = z.object({
  userId: z.string().uuid(),
  channelId: z.string().uuid(),
  accessLevel: z.enum(["agent", "viewer"]).default("agent"),
});
export type AssignChannelInput = z.infer<typeof assignChannelSchema>;

export const cursorPaginationSchema = z.object({
  beforeProviderTimestampMs: z.coerce.number().int().optional(),
  beforeMessageId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
