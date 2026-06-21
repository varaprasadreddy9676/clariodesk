CREATE TABLE "conversation_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"phone_instance_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"idempotency_key" uuid NOT NULL,
	"command_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_chat_id" text,
	"channel_id" uuid,
	"outbox_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_commands" ADD CONSTRAINT "conversation_commands_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_commands" ADD CONSTRAINT "conversation_commands_phone_instance_id_phone_instances_id_fk" FOREIGN KEY ("phone_instance_id") REFERENCES "public"."phone_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_commands" ADD CONSTRAINT "conversation_commands_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_commands" ADD CONSTRAINT "conversation_commands_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_commands_ws_key_uq" ON "conversation_commands" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "conversation_commands_status_idx" ON "conversation_commands" USING btree ("workspace_id","status");