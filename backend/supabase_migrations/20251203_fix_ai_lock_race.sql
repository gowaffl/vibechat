-- Fix for race condition in AI lock acquisition
-- Function to atomically acquire AI lock by cleaning up expired locks and inserting new one

CREATE OR REPLACE FUNCTION acquire_ai_lock(
  p_chat_id TEXT,
  p_locked_by TEXT,
  p_expiry_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lock_acquired BOOLEAN;
BEGIN
  -- Attempt to delete expired lock first
  DELETE FROM ai_engagement_lock
  WHERE chat_id = p_chat_id AND expires_at < NOW();

  -- Attempt to insert new lock
  BEGIN
    INSERT INTO ai_engagement_lock (chat_id, locked_by, expires_at)
    VALUES (p_chat_id, p_locked_by, NOW() + (p_expiry_seconds || ' seconds')::interval);
    lock_acquired := TRUE;
  EXCEPTION WHEN unique_violation THEN
    lock_acquired := FALSE;
  END;

  RETURN lock_acquired;
END;
$$;

