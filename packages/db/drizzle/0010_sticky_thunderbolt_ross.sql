ALTER TABLE "channels" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "is_muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_channel_read_state" ADD COLUMN "is_marked_unread" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "channels"
SET "is_muted" = true,
    "status" = CASE
      WHEN "channel_type" = 'direct' THEN 'active'::"channel_status"
      ELSE 'unmapped'::"channel_status"
    END
WHERE "status" = 'muted'::"channel_status";
