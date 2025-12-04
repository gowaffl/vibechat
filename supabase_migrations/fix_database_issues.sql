-- Fix database issues: RLS, Indexes, and Policies

-- 1. Enable RLS on group_settings and add policies
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read group_settings
CREATE POLICY "Authenticated users can read group settings"
ON public.group_settings FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated users to update group_settings (Assuming global shared access per user request for "any user")
CREATE POLICY "Authenticated users can update group settings"
ON public.group_settings FOR UPDATE
USING (auth.role() = 'authenticated');


-- 2. Fix custom_slash_command policies
-- First, ensure RLS is enabled (it was reported as enabled but no policies)
ALTER TABLE public.custom_slash_command ENABLE ROW LEVEL SECURITY;

-- Helper function to check chat membership (if not already robust)
-- We'll fix the search_path issue reported by linter for existing functions first

CREATE OR REPLACE FUNCTION public.is_chat_member(chat_id text, user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_member
    WHERE "chatId" = chat_id AND "userId" = user_id
  );
END;
$$;

-- Policies for custom_slash_command
CREATE POLICY "Chat members can read custom commands"
ON public.custom_slash_command FOR SELECT
USING (public.is_chat_member("chatId", auth.uid()));

CREATE POLICY "Chat members can insert custom commands"
ON public.custom_slash_command FOR INSERT
WITH CHECK (public.is_chat_member("chatId", auth.uid()));

CREATE POLICY "Chat members can update custom commands"
ON public.custom_slash_command FOR UPDATE
USING (public.is_chat_member("chatId", auth.uid()));

CREATE POLICY "Chat members can delete custom commands"
ON public.custom_slash_command FOR DELETE
USING (public.is_chat_member("chatId", auth.uid()));


-- 3. Update Chat and AI Friend policies to allow ANY member to update (per user request)

-- Drop existing restrictive policies on Chat if they exist (checking names is hard in SQL script without dynamic SQL, so we'll create new ones or replace)
-- Instead of dropping specific named policies which might fail if they don't exist, let's add the permissive ones.
-- Note: Supabase combines policies with OR. So adding a more permissive policy is enough.

CREATE POLICY "Chat members can update chat details"
ON public.chat FOR UPDATE
USING (public.is_chat_member(id, auth.uid()));

-- Update AI Friend policies
CREATE POLICY "Chat members can update AI friends"
ON public.ai_friend FOR UPDATE
USING (public.is_chat_member("chatId", auth.uid()));

CREATE POLICY "Chat members can delete AI friends"
ON public.ai_friend FOR DELETE
USING (public.is_chat_member("chatId", auth.uid()));

CREATE POLICY "Chat members can insert AI friends"
ON public.ai_friend FOR INSERT
WITH CHECK (public.is_chat_member("chatId", auth.uid()));


-- 4. Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_chatId ON public.message("chatId");
CREATE INDEX IF NOT EXISTS idx_message_userId ON public.message("userId");
CREATE INDEX IF NOT EXISTS idx_message_aiFriendId ON public.message("aiFriendId");
CREATE INDEX IF NOT EXISTS idx_message_replyToId ON public.message("replyToId");

CREATE INDEX IF NOT EXISTS idx_bookmark_messageId ON public.bookmark("messageId");
CREATE INDEX IF NOT EXISTS idx_chat_creatorId ON public.chat("creatorId");
CREATE INDEX IF NOT EXISTS idx_mention_mentionedByUserId ON public.mention("mentionedByUserId");
CREATE INDEX IF NOT EXISTS idx_reaction_messageId ON public.reaction("messageId");
CREATE INDEX IF NOT EXISTS idx_read_receipt_chatId ON public.read_receipt("chatId");
CREATE INDEX IF NOT EXISTS idx_read_receipt_messageId ON public.read_receipt("messageId");
CREATE INDEX IF NOT EXISTS idx_event_response_optionId ON public.event_response("optionId");


-- 5. Remove duplicate index on User table
-- The linter reported user_phone_key and user_phone_key1
DROP INDEX IF EXISTS public.user_phone_key1;


-- 6. Consolidate User policies
-- We drop the duplicate/conflicting policies and recreate clean ones
-- Note: This carries a risk if we drop the wrong ones. Safest is to leave them if they just cause a warning, but better to clean up.
-- We will attempt to drop known policy names from the linter report.

DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user;

-- Recreate single clear update policy
CREATE POLICY "Users can update own profile"
ON public.user FOR UPDATE
USING (auth.uid() = id);


DROP POLICY IF EXISTS "Enable read access for all users" ON public.user;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user;

-- Recreate single clear select policy
CREATE POLICY "Everyone can read user profiles"
ON public.user FOR SELECT
USING (true);


-- 7. Fix search_path for other functions reported
CREATE OR REPLACE FUNCTION public.is_self(user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN auth.uid() = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;










