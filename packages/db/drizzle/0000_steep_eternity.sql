CREATE TYPE "public"."adapter_type" AS ENUM('evolution', 'waha', 'openwa', 'meta_cloud');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'archived', 'muted', 'unmapped');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('group', 'direct', 'official_direct');--> statement-breakpoint
CREATE TYPE "public"."connection_mode" AS ENUM('linked_device', 'official_api');--> statement-breakpoint
CREATE TYPE "public"."mapping_mode" AS ENUM('unmapped', 'single_client', 'mixed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_source" AS ENUM('live', 'backfill', 'upload');--> statement-breakpoint
CREATE TYPE "public"."media_storage_status" AS ENUM('pending', 'downloaded', 'failed', 'expired', 'purged', 'quarantined');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('received', 'sent', 'delivered', 'read', 'failed', 'deleted_on_whatsapp', 'purged');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'video', 'audio', 'document', 'sticker', 'reaction', 'location', 'contact_card', 'poll', 'system', 'deleted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'waiting_delay', 'policy_blocked', 'queued', 'sending', 'sent', 'failed', 'retrying', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."phone_status" AS ENUM('connected', 'syncing', 'disconnected', 'qr_required', 'degraded', 'restricted', 'archived');--> statement-breakpoint
CREATE TYPE "public"."policy_status" AS ENUM('allowed', 'blocked', 'needs_approval');--> statement-breakpoint
CREATE TYPE "public"."send_mode" AS ENUM('immediate', 'delayed', 'scheduled', 'bulk');--> statement-breakpoint
CREATE TYPE "public"."sent_by_type" AS ENUM('client_user', 'dashboard_agent', 'phone_user', 'automation', 'ai', 'system', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'pending', 'closed');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('admin', 'agent', 'viewer');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" DEFAULT 'agent' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"plan_type" text DEFAULT 'free' NOT NULL,
	"default_timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gateway_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phone_instance_id" uuid NOT NULL,
	"encrypted_session" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"adapter_type" "adapter_type" NOT NULL,
	"phone_number" text,
	"display_name" text NOT NULL,
	"connection_mode" "connection_mode" DEFAULT 'linked_device' NOT NULL,
	"status" "phone_status" DEFAULT 'qr_required' NOT NULL,
	"gateway_node_id" text,
	"provider_instance_id" text,
	"risk_level" text DEFAULT 'normal' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"mapping_mode" "mapping_mode" DEFAULT 'unmapped' NOT NULL,
	"mapping_effective_at" timestamp with time zone NOT NULL,
	"mapped_by_user_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phone_instance_id" uuid NOT NULL,
	"provider_chat_id" text NOT NULL,
	"channel_type" "channel_type" NOT NULL,
	"title" text,
	"subject" text,
	"avatar_url" text,
	"status" "channel_status" DEFAULT 'unmapped' NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_metadata_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by_contact_id" uuid,
	"provider_timestamp" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"display_name_in_channel" text,
	"role_in_channel" text,
	"is_internal_override" boolean,
	"is_client_side_override" boolean,
	"is_verified" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'whatsapp' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"phone" text,
	"source" text DEFAULT 'whatsapp' NOT NULL,
	"confidence_score" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"primary_phone" text NOT NULL,
	"canonical_name" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"is_internal_global" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"phone" text NOT NULL,
	"verified_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"client_id" uuid,
	"channel_id" uuid NOT NULL,
	"storage_key" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" bigint,
	"sha256_hash" text,
	"media_type" "message_type" NOT NULL,
	"storage_status" "media_storage_status" DEFAULT 'pending' NOT NULL,
	"source" "media_source" DEFAULT 'live' NOT NULL,
	"provider_media_id" text,
	"provider_media_key" text,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"phone_instance_id" uuid NOT NULL,
	"provider_message_id" text NOT NULL,
	"provider_chat_id" text NOT NULL,
	"provider_sender_id" text,
	"sender_contact_id" uuid,
	"message_type" "message_type" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sent_by_type" "sent_by_type" DEFAULT 'unknown' NOT NULL,
	"sent_by_user_id" uuid,
	"body" text,
	"quoted_provider_message_id" text,
	"quoted_message_id" uuid,
	"provider_timestamp" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_backfill" boolean DEFAULT false NOT NULL,
	"is_live_event" boolean DEFAULT true NOT NULL,
	"automation_suppressed" boolean DEFAULT false NOT NULL,
	"automation_suppressed_reason" text,
	"sla_eligible" boolean DEFAULT false NOT NULL,
	"ticket_auto_create_eligible" boolean DEFAULT false NOT NULL,
	"raw_event_ref_id" uuid,
	"status" "message_status" DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"client_id" uuid,
	"phone_instance_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"message_type" "message_type" DEFAULT 'text' NOT NULL,
	"body" text,
	"media_id" uuid,
	"quoted_message_id" uuid,
	"send_mode" "send_mode" DEFAULT 'immediate' NOT NULL,
	"send_after" timestamp with time zone,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"policy_status" "policy_status" DEFAULT 'allowed' NOT NULL,
	"failure_reason" text,
	"provider_message_id" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_event_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phone_instance_id" uuid NOT NULL,
	"adapter_type" "adapter_type" NOT NULL,
	"provider_event_id" text,
	"channel_id" uuid,
	"event_type" text NOT NULL,
	"provider_timestamp" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"compressed_size_bytes" integer,
	"sha256_hash" text,
	"object_key" text NOT NULL,
	"retention_until" timestamp with time zone,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid,
	"ticket_id" uuid,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"channel_id" uuid NOT NULL,
	"source_message_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"assigned_user_id" uuid,
	"created_by_user_id" uuid,
	"first_response_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access_level" text DEFAULT 'agent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access_level" text DEFAULT 'agent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_channel_read_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_users" ADD CONSTRAINT "workspace_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_sessions" ADD CONSTRAINT "gateway_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_sessions" ADD CONSTRAINT "gateway_sessions_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_instances" ADD CONSTRAINT "phone_instances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_mappings" ADD CONSTRAINT "channel_mappings_mapped_by_user_id_users_id_fk" FOREIGN KEY ("mapped_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_metadata_events" ADD CONSTRAINT "group_metadata_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_metadata_events" ADD CONSTRAINT "group_metadata_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_metadata_events" ADD CONSTRAINT "group_metadata_events_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_identities" ADD CONSTRAINT "workspace_user_identities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_identities" ADD CONSTRAINT "workspace_user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_user_identities" ADD CONSTRAINT "workspace_user_identities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_contact_id_contacts_id_fk" FOREIGN KEY ("sender_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_raw_event_ref_id_raw_event_refs_id_fk" FOREIGN KEY ("raw_event_ref_id") REFERENCES "public"."raw_event_refs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_event_refs" ADD CONSTRAINT "raw_event_refs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_event_refs" ADD CONSTRAINT "raw_event_refs_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_event_refs" ADD CONSTRAINT "raw_event_refs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_assignments" ADD CONSTRAINT "channel_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_assignments" ADD CONSTRAINT "channel_assignments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_assignments" ADD CONSTRAINT "channel_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_read_state" ADD CONSTRAINT "user_channel_read_state_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_read_state" ADD CONSTRAINT "user_channel_read_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_read_state" ADD CONSTRAINT "user_channel_read_state_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_ws_idx" ON "clients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_ws_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_users_ws_user_uq" ON "workspace_users" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_users_ws_idx" ON "workspace_users" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_sessions_phone_uq" ON "gateway_sessions" USING btree ("phone_instance_id");--> statement-breakpoint
CREATE INDEX "gateway_sessions_ws_idx" ON "gateway_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "phone_instances_ws_idx" ON "phone_instances" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_instances_ws_provider_uq" ON "phone_instances" USING btree ("workspace_id","adapter_type","provider_instance_id");--> statement-breakpoint
CREATE INDEX "channel_mappings_channel_idx" ON "channel_mappings" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_mappings_one_active_uq" ON "channel_mappings" USING btree ("channel_id") WHERE "channel_mappings"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "channels_ws_phone_chat_uq" ON "channels" USING btree ("workspace_id","phone_instance_id","provider_chat_id");--> statement-breakpoint
CREATE INDEX "channels_ws_status_idx" ON "channels" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "group_metadata_events_channel_idx" ON "group_metadata_events" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "group_metadata_events_review_idx" ON "group_metadata_events" USING btree ("workspace_id","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_memberships_channel_contact_uq" ON "channel_memberships" USING btree ("channel_id","contact_id");--> statement-breakpoint
CREATE INDEX "channel_memberships_contact_idx" ON "channel_memberships" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_identities_provider_uq" ON "contact_identities" USING btree ("workspace_id","provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "contact_identities_contact_idx" ON "contact_identities" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_ws_phone_uq" ON "contacts" USING btree ("workspace_id","primary_phone");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_user_identities_ws_phone_uq" ON "workspace_user_identities" USING btree ("workspace_id","phone");--> statement-breakpoint
CREATE INDEX "workspace_user_identities_user_idx" ON "workspace_user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_media_message_idx" ON "message_media" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_media_status_idx" ON "message_media" USING btree ("storage_status");--> statement-breakpoint
CREATE INDEX "message_media_hash_idx" ON "message_media" USING btree ("workspace_id","sha256_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_idempotency_uq" ON "messages" USING btree ("workspace_id","channel_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_ws_channel_time_idx" ON "messages" USING btree ("workspace_id","channel_id","provider_timestamp");--> statement-breakpoint
CREATE INDEX "messages_ws_client_time_idx" ON "messages" USING btree ("workspace_id","client_id","provider_timestamp");--> statement-breakpoint
CREATE INDEX "outbox_ws_status_idx" ON "outbox_messages" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "outbox_send_after_idx" ON "outbox_messages" USING btree ("send_after");--> statement-breakpoint
CREATE INDEX "outbox_provider_msg_idx" ON "outbox_messages" USING btree ("workspace_id","channel_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "raw_event_refs_ws_idx" ON "raw_event_refs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "raw_event_refs_retention_idx" ON "raw_event_refs" USING btree ("retention_until");--> statement-breakpoint
CREATE INDEX "internal_notes_channel_idx" ON "internal_notes" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "internal_notes_ticket_idx" ON "internal_notes" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_ws_client_status_idx" ON "tickets" USING btree ("workspace_id","client_id","status");--> statement-breakpoint
CREATE INDEX "tickets_ws_assignee_idx" ON "tickets" USING btree ("workspace_id","assigned_user_id");--> statement-breakpoint
CREATE INDEX "tickets_channel_idx" ON "tickets" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_assignments_uq" ON "channel_assignments" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "channel_assignments_user_idx" ON "channel_assignments" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_assignments_uq" ON "client_assignments" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "client_assignments_user_idx" ON "client_assignments" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_channel_read_state_uq" ON "user_channel_read_state" USING btree ("user_id","channel_id");--> statement-breakpoint
CREATE INDEX "audit_logs_ws_time_idx" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");