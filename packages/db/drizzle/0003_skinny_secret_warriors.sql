ALTER TABLE "channels" ADD COLUMN "awaiting_response_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "last_agent_reply_at" timestamp with time zone;