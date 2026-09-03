CREATE TABLE "canned_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canned_responses_ws_idx" ON "canned_responses" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canned_responses_ws_title_uq" ON "canned_responses" USING btree ("workspace_id","title");--> statement-breakpoint
CREATE INDEX "canned_responses_fts_idx" ON "canned_responses" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("body", '')));