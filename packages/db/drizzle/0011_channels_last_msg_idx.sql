-- Covers ORDER BY isPinned DESC, lastMessageAt DESC on the channel list query.
-- Without this, the channel list is a full workspace scan sorted in memory.
CREATE INDEX IF NOT EXISTS "channels_ws_last_msg_idx"
  ON "channels" ("workspace_id", "last_message_at");
