-- ==========================================
-- VIBECHAT DATABASE SCHEMA (December 2025)
-- ==========================================

-- ==========================================
-- SEMANTIC SEARCH
-- ==========================================
-- Add embedding column to message table
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS message_embedding_idx ON public.message USING hnsw ("embedding" vector_cosine_ops);

-- Function to match messages by embedding similarity
CREATE OR REPLACE FUNCTION match_messages (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text DEFAULT NULL,
  filter_chat_ids text[] DEFAULT NULL,
  filter_message_types text[] DEFAULT NULL,
  filter_date_from timestamp with time zone DEFAULT NULL,
  filter_date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    message.id,
    message.content,
    1 - (message.embedding <=> query_embedding) as similarity
  FROM message
  WHERE 1 - (message.embedding <=> query_embedding) > match_threshold
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id)
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids))
  AND (filter_message_types IS NULL OR message."messageType" = ANY(filter_message_types))
  AND (filter_date_from IS NULL OR message."createdAt" >= filter_date_from)
  AND (filter_date_to IS NULL OR message."createdAt" <= filter_date_to)
  ORDER BY (message.embedding <=> query_embedding) ASC
  LIMIT match_count;
END;
$$;

-- Add themePreference column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "themePreference" text DEFAULT 'system'
  CHECK ("themePreference" IN ('light', 'dark', 'system'));

-- Add timezone column to user table (for scheduling workflows)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- ==========================================
-- AI WORKFLOW AUTOMATION (December 2025)
-- ==========================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS ai_workflow (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "chatId" TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    "creatorId" TEXT NOT NULL REFERENCES "user"(id),
    name TEXT NOT NULL,
    description TEXT,
    "triggerType" TEXT NOT NULL CHECK ("triggerType" IN ('message_pattern', 'scheduled', 'ai_mention', 'keyword', 'time_based')),
    "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "actionType" TEXT NOT NULL CHECK ("actionType" IN ('create_event', 'create_poll', 'send_message', 'ai_response', 'summarize', 'remind')),
    "actionConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "isEnabled" BOOLEAN DEFAULT true,
    "cooldownMinutes" INTEGER DEFAULT 5,
    "lastTriggeredAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow execution log
CREATE TABLE IF NOT EXISTS ai_workflow_execution (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "workflowId" TEXT NOT NULL REFERENCES ai_workflow(id) ON DELETE CASCADE,
    "triggeredBy" TEXT,
    status TEXT CHECK (status IN ('success', 'failed', 'skipped')),
    "resultData" JSONB,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled AI actions
CREATE TABLE IF NOT EXISTS ai_scheduled_action (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "chatId" TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    "creatorId" TEXT NOT NULL REFERENCES "user"(id),
    "actionType" TEXT NOT NULL CHECK ("actionType" IN ('daily_summary', 'weekly_recap', 'reminder', 'custom')),
    schedule TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    config JSONB DEFAULT '{}'::jsonb,
    "lastRunAt" TIMESTAMP,
    "nextRunAt" TIMESTAMP,
    "isEnabled" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- COMMUNITY MARKETPLACE (December 2025)
-- ==========================================

-- Community-shared AI Friends (Personas)
CREATE TABLE IF NOT EXISTS community_ai_friend (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "originalAiFriendId" TEXT REFERENCES ai_friend(id) ON DELETE SET NULL,
    "creatorUserId" TEXT NOT NULL REFERENCES "user"(id),
    name TEXT NOT NULL,
    personality TEXT,
    tone TEXT,
    description TEXT,
    category TEXT CHECK (category IN ('productivity', 'entertainment', 'support', 'creative', 'utility', 'other')),
    tags TEXT[] DEFAULT '{}',
    "cloneCount" INTEGER DEFAULT 0,
    "isPublic" BOOLEAN DEFAULT true,
    "isFeatured" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Community-shared Custom Commands
CREATE TABLE IF NOT EXISTS community_command (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "originalCommandId" TEXT REFERENCES custom_slash_command(id) ON DELETE SET NULL,
    "creatorUserId" TEXT NOT NULL REFERENCES "user"(id),
    command TEXT NOT NULL,
    prompt TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('productivity', 'entertainment', 'creative', 'utility', 'other')),
    tags TEXT[] DEFAULT '{}',
    "cloneCount" INTEGER DEFAULT 0,
    "isPublic" BOOLEAN DEFAULT true,
    "isFeatured" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track user clones for ranking
CREATE TABLE IF NOT EXISTS community_clone (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "userId" TEXT NOT NULL REFERENCES "user"(id),
    "itemType" TEXT NOT NULL CHECK ("itemType" IN ('ai_friend', 'command')),
    "communityItemId" TEXT NOT NULL,
    "targetChatId" TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    "clonedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "communityItemId", "targetChatId")
);

-- ==========================================
-- AI-NATIVE COMMUNICATION (December 2025)
-- ==========================================

-- User translation preferences
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS 
    "translationPreferences" JSONB DEFAULT '{"enabled": false, "targetLanguage": null, "autoDetect": true}'::jsonb;

-- Message translations cache
CREATE TABLE IF NOT EXISTS message_translation (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "messageId" TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "translatedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("messageId", "targetLanguage")
);

-- Context card cache
CREATE TABLE IF NOT EXISTS context_card (
    id TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
    "chatId" TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    "sourceMessageIds" TEXT[] DEFAULT '{}',
    "expiresAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- VOICE ROOMS (VIBE CALLS) (December 2025)
-- ==========================================

-- Voice Rooms Table
CREATE TABLE IF NOT EXISTS public.voice_room (
    "id" text NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "chatId" text NOT NULL,
    "name" text,
    "createdBy" text NOT NULL,
    "isActive" boolean DEFAULT true,
    "startedAt" timestamp without time zone DEFAULT now(),
    "endedAt" timestamp without time zone,
    "liveKitRoomId" text,
    "recordingUrl" text,
    "transcription" text,
    "summary" text,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("chatId") REFERENCES public.chat("id") ON DELETE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES public.user("id")
);

-- Voice Participants Table
CREATE TABLE IF NOT EXISTS public.voice_participant (
    "id" text NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "voiceRoomId" text NOT NULL,
    "userId" text NOT NULL,
    "joinedAt" timestamp without time zone DEFAULT now(),
    "leftAt" timestamp without time zone,
    "role" text DEFAULT 'speaker',
    "isMuted" boolean DEFAULT false,
    "createdAt" timestamp without time zone DEFAULT now(),
    PRIMARY KEY ("id"),
    FOREIGN KEY ("voiceRoomId") REFERENCES public.voice_room("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES public.user("id")
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_room_chatId ON public.voice_room("chatId");
CREATE INDEX IF NOT EXISTS idx_voice_room_isActive ON public.voice_room("isActive");
CREATE INDEX IF NOT EXISTS idx_voice_participant_voiceRoomId ON public.voice_participant("voiceRoomId");
CREATE INDEX IF NOT EXISTS idx_voice_participant_userId ON public.voice_participant("userId");

-- Enable RLS
ALTER TABLE public.voice_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_participant ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_room
CREATE POLICY IF NOT EXISTS "Users can view voice rooms in their chats"
ON public.voice_room FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_member
    WHERE chat_member."chatId" = voice_room."chatId"
    AND chat_member."userId" = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can create voice rooms in their chats"
ON public.voice_room FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_member
    WHERE chat_member."chatId" = voice_room."chatId"
    AND chat_member."userId" = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can update voice rooms they created"
ON public.voice_room FOR UPDATE
USING ("createdBy" = auth.uid());

-- RLS Policies for voice_participant
CREATE POLICY IF NOT EXISTS "Users can view participants in accessible voice rooms"
ON public.voice_participant FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.voice_room
    INNER JOIN public.chat_member 
      ON chat_member."chatId" = voice_room."chatId"
    WHERE voice_room.id = voice_participant."voiceRoomId"
    AND chat_member."userId" = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Users can join voice rooms as participants"
ON public.voice_participant FOR INSERT
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

CREATE POLICY IF NOT EXISTS "Users can update their own participation"
ON public.voice_participant FOR UPDATE
USING ("userId" = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can leave voice rooms"
ON public.voice_participant FOR DELETE
USING ("userId" = auth.uid());
