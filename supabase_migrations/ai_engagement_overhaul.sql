-- Migration: AI Engagement Overhaul
-- Description: Adds Realtime triggers for AI engagement, distributed locking, and persistent cooldowns

-- 1. Enable Realtime for message table if not already enabled
-- Ensure the realtime publication exists and add message table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE message;

-- 2. Create ai_engagement_lock table for distributed locking
CREATE TABLE IF NOT EXISTS ai_engagement_lock (
  chat_id TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NOT NULL,  -- server instance ID or worker ID
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient cleanup of expired locks
CREATE INDEX IF NOT EXISTS idx_ai_lock_expires ON ai_engagement_lock(expires_at);

-- 3. Add last_response_at to ai_friend for persistent cooldown tracking
ALTER TABLE ai_friend ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;

-- 4. Create function to broadcast new messages via Realtime
-- This allows the backend to listen for new messages without polling
CREATE OR REPLACE FUNCTION notify_new_message_for_ai()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Only notify for user messages (not AI messages) and not system messages
  -- AI messages have a non-null aiFriendId
  IF NEW."aiFriendId" IS NULL AND NEW."messageType" != 'system' THEN
    
    payload = jsonb_build_object(
      'chatId', NEW."chatId",
      'messageId', NEW.id,
      'content', NEW.content,
      'userId', NEW."userId",
      'createdAt', NEW."createdAt"
    );

    -- Broadcast to the 'ai-engagement' channel
    -- This uses pg_notify which Supabase Realtime listens to
    PERFORM pg_notify(
      'ai_engagement_new_message',
      payload::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for the notification
DROP TRIGGER IF EXISTS message_ai_engagement_trigger ON message;
CREATE TRIGGER message_ai_engagement_trigger
  AFTER INSERT ON message
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message_for_ai();

-- Note: We are using pg_notify directly instead of realtime.send() because 
-- realtime.send() is sometimes restricted or requires specific setup.
-- The backend will listen to Postgres notifications or standard Realtime changes.
-- Since we enabled Realtime on the table in step 1, standard Realtime subscription 
-- in the backend will also work for INSERT events.

