-- ==========================================
-- RLS POLICIES FOR VOICE ROOMS
-- ==========================================

-- Enable RLS on voice room tables
ALTER TABLE public.voice_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_participant ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- VOICE_ROOM POLICIES
-- ==========================================

-- Policy: Users can view voice rooms for chats they're members of
CREATE POLICY "Users can view voice rooms in their chats"
ON public.voice_room
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_member
    WHERE chat_member."chatId" = voice_room."chatId"
    AND chat_member."userId" = auth.uid()
  )
);

-- Policy: Users can create voice rooms in chats they're members of
CREATE POLICY "Users can create voice rooms in their chats"
ON public.voice_room
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_member
    WHERE chat_member."chatId" = voice_room."chatId"
    AND chat_member."userId" = auth.uid()
  )
);

-- Policy: Users can update voice rooms they created
CREATE POLICY "Users can update voice rooms they created"
ON public.voice_room
FOR UPDATE
USING ("createdBy" = auth.uid());

-- Policy: Backend service can update any voice room (for webhooks)
-- Note: This assumes you have a service role key for backend operations
-- The backend should use the service role key, not user JWT

-- ==========================================
-- VOICE_PARTICIPANT POLICIES
-- ==========================================

-- Policy: Users can view participants in voice rooms they have access to
CREATE POLICY "Users can view participants in accessible voice rooms"
ON public.voice_participant
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.voice_room
    INNER JOIN public.chat_member 
      ON chat_member."chatId" = voice_room."chatId"
    WHERE voice_room.id = voice_participant."voiceRoomId"
    AND chat_member."userId" = auth.uid()
  )
);

-- Policy: Users can insert themselves as participants
CREATE POLICY "Users can join voice rooms as participants"
ON public.voice_participant
FOR INSERT
WITH CHECK (
  "userId" = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.voice_room
    INNER JOIN public.chat_member 
      ON chat_member."chatId" = voice_room."chatId"
    WHERE voice_room.id = voice_participant."voiceRoomId"
    AND chat_member."userId" = auth.uid()
  )
);

-- Policy: Users can update their own participant record
CREATE POLICY "Users can update their own participation"
ON public.voice_participant
FOR UPDATE
USING ("userId" = auth.uid());

-- Policy: Users can delete their own participant record
CREATE POLICY "Users can leave voice rooms"
ON public.voice_participant
FOR DELETE
USING ("userId" = auth.uid());

-- ==========================================
-- IMPORTANT NOTES
-- ==========================================

-- 1. Backend operations (webhooks, cleanup jobs) should use the service role key
--    which bypasses RLS. Don't use user JWTs for backend operations.

-- 2. The frontend should use user JWTs (from supabaseClient) for all operations.

-- 3. Test these policies thoroughly:
--    - Try to view rooms from other chats (should fail)
--    - Try to join rooms in chats you're not a member of (should fail)
--    - Try to update other users' participant records (should fail)

