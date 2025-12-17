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
