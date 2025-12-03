-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Chat creators can update AI friends" ON "ai_friend";
DROP POLICY IF EXISTS "Chat creators can delete AI friends" ON "ai_friend";

-- Ensure we have policies for all members to manage AI friends
-- Drop these if they exist to recreate them cleanly, avoiding duplicates
DROP POLICY IF EXISTS "Chat members can update AI friends" ON "ai_friend";
DROP POLICY IF EXISTS "Chat members can delete AI friends" ON "ai_friend";
DROP POLICY IF EXISTS "Chat members can insert AI friends" ON "ai_friend";

-- Create comprehensive policies for chat members using explicit user check
CREATE POLICY "Chat members can update AI friends" ON "ai_friend"
  FOR UPDATE USING (
    public.is_chat_member("chatId", auth.uid()::text)
  );

CREATE POLICY "Chat members can delete AI friends" ON "ai_friend"
  FOR DELETE USING (
    public.is_chat_member("chatId", auth.uid()::text)
  );

CREATE POLICY "Chat members can insert AI friends" ON "ai_friend"
  FOR INSERT WITH CHECK (
    public.is_chat_member("chatId", auth.uid()::text)
  );
