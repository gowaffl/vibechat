-- Migration: optimize_message_queries
-- Description: Adds compound index for efficient message pagination by chatId and createdAt

-- Create compound index for message pagination
CREATE INDEX IF NOT EXISTS idx_message_chatid_createdat 
ON public.message ("chatId", "createdAt" DESC);

-- This index allows for extremely fast queries like:
-- SELECT * FROM message WHERE "chatId" = ? ORDER BY "createdAt" DESC LIMIT ?

