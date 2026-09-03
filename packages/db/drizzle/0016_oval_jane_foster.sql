CREATE TYPE "public"."ai_connection_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai', 'google', 'azure_openai', 'custom');--> statement-breakpoint
CREATE TABLE "ai_provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"label" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"base_url" text,
	"model" text,
	"status" "ai_connection_status" DEFAULT 'active' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"last_health_check_ok" boolean,
	"last_health_check_error" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_connections" ADD CONSTRAINT "ai_provider_connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_connections_ws_idx" ON "ai_provider_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_connections_ws_label_uq" ON "ai_provider_connections" USING btree ("workspace_id","label");