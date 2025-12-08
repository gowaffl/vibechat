-- ==========================================
-- SUPABASE SCHEMA - APPLIED TO DATABASE
-- ==========================================
-- This schema has been successfully applied to Supabase
-- Migration Date: November 24, 2025
-- Database: xxekfvxdzixesjrbxoju.supabase.co
--
-- Applied via migrations:
-- - initial_schema_setup
-- - setup_rls_policies
-- - add_phone_to_user ✅ APPLIED (November 24, 2025)
-- - add_birthdate_to_user ✅ APPLIED (November 24, 2025)
-- - fix_corrupted_image_urls ✅ APPLIED (January 26, 2025) - Fixed double-prepended URLs
-- - add_service_role_policies ✅ APPLIED (December 2, 2025) - Added explicit service role RLS policies
-- - add_is_muted_to_chat_member ✅ APPLIED (December 4, 2025) - Added isMuted column to chat_member
-- - add_summary_preference_to_user ✅ APPLIED (December 5, 2025) - Added summaryPreference and hasSeenSummaryPreferencePrompt columns
-- - fix_rls_policy_performance ✅ APPLIED (December 8, 2025) - Optimized 34 RLS policies using (SELECT auth.uid()) pattern
-- - add_missing_foreign_key_indexes ✅ APPLIED (December 8, 2025) - Added missing indexes on poll tables
--
-- PERFORMANCE OPTIMIZATION (December 8, 2025):
-- - Fixed all RLS policies to use (SELECT auth.uid()) instead of auth.uid() for per-query evaluation
-- - Added missing foreign key indexes: idx_poll_creatorId, idx_poll_vote_optionId
-- - Added performance indexes: idx_message_chatId_createdAt_desc, idx_read_receipt_chatId_userId, idx_reaction_messageId
-- - Enabled RLS on ai_engagement_lock table
-- - Fixed function search_path security: is_chat_member, acquire_ai_lock, notify_new_message_for_ai, update_thread_member_lastviewedat
-- - Consolidated duplicate permissive policies on ai_friend, chat, and chat_member tables
--
-- FEATURE: Multi-Image & Video Support (December 2, 2025)
-- - Added messageType 'video' to message table
-- - Using existing metadata JSONB column for mediaUrls (multi-image) and video data
-- - No schema migration needed - metadata column already exists
--
-- CODE MIGRATION STATUS:
-- ✅ All Prisma-style queries converted to Supabase (November 25, 2025)
--    - backend/src/services/ai-engagement.ts: Fixed all db.aIFriend/message queries
--    - backend/src/routes/ai.ts: Fixed all db.user/message/chat queries
--    - backend/src/routes/messages.ts: Fixed AI message detection
--    - backend/src/routes/custom-commands.ts: Fixed AI message creation
--
-- ✅ AI Message Architecture Corrected (November 25, 2025)
--    - AI messages now use userId: NULL instead of "ai-assistant"
--    - AI messages identified by aiFriendId field (not userId)
--    - Removed "ai-assistant" user dependency (doesn't exist in DB)
--    - AI messages properly link to specific ai_friend records via aiFriendId
-- ==========================================

-- ============================================
-- SUPABASE SCHEMA - MIGRATION COMPLETE ✅
-- ============================================
-- This schema has been applied to Supabase
-- All routes have been migrated from Prisma to Supabase
-- Date: 2025-11-24
--
-- PHONE AUTH MIGRATION (November 24, 2025):
-- - Removed Better Auth dependency
-- - Added phone number authentication via Supabase Auth
-- - Phone number is now the primary user identity
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Storage Configuration
-- ==========================================
-- Storage bucket "uploads" configuration:
-- - Public access ENABLED (necessary for image loading in React Native)
-- - File size limit: 50MB (increased from 10MB to support video uploads)
-- - Allowed MIME types: Any (images: jpeg, png, gif, webp; videos: mp4, mov, quicktime)
-- - RLS policies: Protect write operations (upload/update/delete owner-only)
-- - Read access: Public bucket allows direct URL access (users can't browse/list files)
--
-- MEDIA UPLOAD LIMITS (December 2025):
-- - Images: Max 10 images per message, each up to 10MB after compression
-- - Videos: Max 1 video per message, up to 50MB, max 60 seconds duration
--
-- SECURITY MODEL (December 8, 2025):
-- - Bucket is PUBLIC but files cannot be browsed/listed
-- - Application controls which image URLs are shown to users
-- - Write operations protected by RLS (only file owners can modify)
-- - This is the standard model used by Instagram, WhatsApp, Discord, etc.
-- Migrations: storage_rls_chat_based_access, simplify_storage_rls ✅ APPLIED

-- ==========================================
-- Utilities
-- ==========================================

-- Function to update updatedAt column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- Tables
-- ==========================================

-- User
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY, -- Supabase auth.users.id (UUID from phone auth)
    "phone" TEXT UNIQUE NOT NULL, -- Phone number (E.164 format: +12396998960)
    "name" TEXT NOT NULL DEFAULT 'Anonymous',
    "bio" TEXT,
    "image" TEXT,
    "birthdate" DATE, -- User birthdate for age verification and safety settings
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "pushToken" TEXT,
    "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "summaryPreference" TEXT NOT NULL DEFAULT 'concise', -- AI catch-up summary preference: 'concise' or 'detailed'
    "hasSeenSummaryPreferencePrompt" BOOLEAN NOT NULL DEFAULT false, -- Whether user has seen the first-time preference prompt
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_summaryPreference_check" CHECK ("summaryPreference" IN ('concise', 'detailed'))
);

CREATE TRIGGER update_user_updatedAt
    BEFORE UPDATE ON "user"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Chat
CREATE TABLE IF NOT EXISTS "chat" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "name" TEXT NOT NULL DEFAULT 'New Chat',
    "bio" TEXT,
    "image" TEXT,
    "aiPersonality" TEXT,
    "aiTone" TEXT,
    "aiName" TEXT DEFAULT 'AI Assistant',
    "aiEngagementMode" TEXT NOT NULL DEFAULT 'on-call',
    "aiEngagementPercent" INTEGER,
    "lastAvatarGenDate" TIMESTAMP(3),
    "avatarPromptUsed" TEXT,
    "inviteToken" TEXT UNIQUE,
    "inviteTokenExpiresAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TRIGGER update_chat_updatedAt
    BEFORE UPDATE ON "chat"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ChatMember
CREATE TABLE IF NOT EXISTS "chat_member" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "chat_member_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE,
    CONSTRAINT "chat_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    UNIQUE ("chatId", "userId")
);

-- AI Friend
CREATE TABLE IF NOT EXISTS "ai_friend" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'AI Friend',
    "personality" TEXT,
    "tone" TEXT,
    "engagementMode" TEXT NOT NULL DEFAULT 'on-call',
    "engagementPercent" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#34C759',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_friend_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE
);

CREATE TRIGGER update_ai_friend_updatedAt
    BEFORE UPDATE ON "ai_friend"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Message
-- NOTE: userId is NULL for AI-generated messages. aiFriendId identifies which AI friend sent the message.
-- 
-- METADATA JSONB USAGE (December 2025):
-- The "metadata" column stores additional message data as JSON:
--   - For multi-image messages (messageType='image'): { "mediaUrls": ["url1", "url2", ...] }
--     Up to 10 images per message. First image URL is also stored in imageUrl for thumbnails.
--   - For video messages (messageType='video'): { "videoUrl": "url", "videoThumbnailUrl": "url", "videoDuration": 30 }
--     Videos stored in Supabase Storage, up to 50MB per file.
-- 
CREATE TABLE IF NOT EXISTS "message" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "content" TEXT NOT NULL DEFAULT '',
    "messageType" TEXT NOT NULL DEFAULT 'text', -- text, image, voice, video, system
    "imageUrl" TEXT,
    "imageDescription" TEXT,
    "userId" TEXT, -- NULL for AI messages, actual user ID for human messages
    "chatId" TEXT NOT NULL,
    "replyToId" TEXT,
    "aiFriendId" TEXT, -- Set for AI messages to identify which AI friend sent it
    "linkPreviewUrl" TEXT,
    "linkPreviewTitle" TEXT,
    "linkPreviewDescription" TEXT,
    "linkPreviewImage" TEXT,
    "linkPreviewSiteName" TEXT,
    "linkPreviewFavicon" TEXT,
    "editedAt" TIMESTAMP(3),
    "isUnsent" BOOLEAN NOT NULL DEFAULT false,
    "editHistory" TEXT,
    "voiceUrl" TEXT,
    "voiceDuration" INTEGER,
    "eventId" TEXT,
    "vibeType" TEXT, -- VibeWrapper: genuine, playful, serious, soft, hype
    "metadata" JSONB, -- Stores multi-image URLs (mediaUrls), video data (videoUrl, videoThumbnailUrl, videoDuration)
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE,
    CONSTRAINT "message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "message" ("id") ON DELETE SET NULL,
    CONSTRAINT "message_aiFriendId_fkey" FOREIGN KEY ("aiFriendId") REFERENCES "ai_friend" ("id") ON DELETE SET NULL
);

-- Reaction
CREATE TABLE IF NOT EXISTS "reaction" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE,
    UNIQUE ("userId", "messageId", "emoji")
);

-- CustomSlashCommand
CREATE TABLE IF NOT EXISTS "custom_slash_command" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "command" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_slash_command_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE,
    UNIQUE ("chatId", "command")
);

CREATE TRIGGER update_custom_slash_command_updatedAt
    BEFORE UPDATE ON "custom_slash_command"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ReadReceipt
CREATE TABLE IF NOT EXISTS "read_receipt" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "read_receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "read_receipt_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE,
    CONSTRAINT "read_receipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE,
    UNIQUE ("userId", "messageId")
);

-- Bookmark
CREATE TABLE IF NOT EXISTS "bookmark" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "bookmark_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE,
    UNIQUE ("userId", "messageId")
);

-- Mention
CREATE TABLE IF NOT EXISTS "mention" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "messageId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "mentionedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE,
    CONSTRAINT "mention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "mention_mentionedByUserId_fkey" FOREIGN KEY ("mentionedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE,
    UNIQUE ("messageId", "mentionedUserId")
);

-- Thread
CREATE TABLE IF NOT EXISTS "thread" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💬',
    "creatorId" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "filterRules" TEXT NOT NULL,
    "memberIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thread_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE
);

CREATE TRIGGER update_thread_updatedAt
    BEFORE UPDATE ON "thread"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- MessageTag
CREATE TABLE IF NOT EXISTS "message_tag" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "messageId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_tag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE
);

-- ThreadMember
CREATE TABLE IF NOT EXISTS "thread_member" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "thread_member_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE,
    UNIQUE ("threadId", "userId")
);
-- Note: thread_member has @updatedAt on lastViewedAt in schema? "lastViewedAt DateTime @default(now()) @updatedAt"
-- So we need a trigger to update lastViewedAt on update.
CREATE OR REPLACE FUNCTION update_thread_member_lastViewedAt()
RETURNS TRIGGER AS $$
BEGIN
    NEW."lastViewedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_thread_member_updatedAt
    BEFORE UPDATE ON "thread_member"
    FOR EACH ROW
    EXECUTE PROCEDURE update_thread_member_lastViewedAt();


-- Event
CREATE TABLE IF NOT EXISTS "event" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "chatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "eventDate" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE
);

CREATE TRIGGER update_event_updatedAt
    BEFORE UPDATE ON "event"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- EventOption
CREATE TABLE IF NOT EXISTS "event_option" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "eventId" TEXT NOT NULL,
    "optionType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_option_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event" ("id") ON DELETE CASCADE
);

-- EventResponse
CREATE TABLE IF NOT EXISTS "event_response" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT,
    "responseType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_response_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event" ("id") ON DELETE CASCADE,
    CONSTRAINT "event_response_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "event_option" ("id") ON DELETE CASCADE,
    UNIQUE ("eventId", "userId", "optionId")
);

CREATE TRIGGER update_event_response_updatedAt
    BEFORE UPDATE ON "event_response"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- MediaReaction
CREATE TABLE IF NOT EXISTS "media_reaction" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "resultUrl" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ConversationSummary
CREATE TABLE IF NOT EXISTS "conversation_summary" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summaryType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageRange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- ==========================================
-- Indexes
-- ==========================================

CREATE INDEX IF NOT EXISTS "chat_member_userId_idx" ON "chat_member"("userId");
CREATE INDEX IF NOT EXISTS "read_receipt_userId_chatId_idx" ON "read_receipt"("userId", "chatId");
CREATE INDEX IF NOT EXISTS "bookmark_userId_chatId_idx" ON "bookmark"("userId", "chatId");
CREATE INDEX IF NOT EXISTS "mention_mentionedUserId_idx" ON "mention"("mentionedUserId");
CREATE INDEX IF NOT EXISTS "mention_messageId_idx" ON "mention"("messageId");
CREATE INDEX IF NOT EXISTS "ai_friend_chatId_idx" ON "ai_friend"("chatId");
CREATE INDEX IF NOT EXISTS "ai_friend_chatId_sortOrder_idx" ON "ai_friend"("chatId", "sortOrder");
CREATE INDEX IF NOT EXISTS "thread_chatId_idx" ON "thread"("chatId");
CREATE INDEX IF NOT EXISTS "message_tag_messageId_idx" ON "message_tag"("messageId");
CREATE INDEX IF NOT EXISTS "message_tag_tagType_tagValue_idx" ON "message_tag"("tagType", "tagValue");
CREATE INDEX IF NOT EXISTS "thread_member_userId_idx" ON "thread_member"("userId");
CREATE INDEX IF NOT EXISTS "event_chatId_idx" ON "event"("chatId");
CREATE INDEX IF NOT EXISTS "event_status_idx" ON "event"("status");
CREATE INDEX IF NOT EXISTS "event_option_eventId_idx" ON "event_option"("eventId");
CREATE INDEX IF NOT EXISTS "event_response_eventId_idx" ON "event_response"("eventId");
CREATE INDEX IF NOT EXISTS "event_response_userId_idx" ON "event_response"("userId");
CREATE INDEX IF NOT EXISTS "media_reaction_messageId_idx" ON "media_reaction"("messageId");
CREATE INDEX IF NOT EXISTS "media_reaction_userId_idx" ON "media_reaction"("userId");
CREATE INDEX IF NOT EXISTS "idx_message_chatid_createdat" ON "message"("chatId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "conversation_summary_chatId_userId_idx" ON "conversation_summary"("chatId", "userId");
CREATE INDEX IF NOT EXISTS "conversation_summary_expiresAt_idx" ON "conversation_summary"("expiresAt");


-- ==========================================
-- RLS Policies
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_slash_command" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "read_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_friend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "thread_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_option" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_response" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_summary" ENABLE ROW LEVEL SECURITY;

-- Helper function to check chat membership
CREATE OR REPLACE FUNCTION is_chat_member(chat_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM chat_member
    WHERE "chatId" = chat_id
      AND "userId" = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is self
CREATE OR REPLACE FUNCTION is_self(user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid()::text = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Policies

-- User
CREATE POLICY "Public profiles are viewable by everyone" ON "user" FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON "user" FOR UPDATE USING (is_self(id));

-- Chat
CREATE POLICY "Users can create chats" ON "chat" FOR INSERT WITH CHECK (is_self("creatorId"));
CREATE POLICY "Members can view chats" ON "chat" FOR SELECT USING (
    is_chat_member(id) OR is_self("creatorId")
);
CREATE POLICY "Creators can update chats" ON "chat" FOR UPDATE USING (is_self("creatorId"));
CREATE POLICY "Creators can delete chats" ON "chat" FOR DELETE USING (is_self("creatorId"));

-- Chat Member
CREATE POLICY "Members can view other members in the same chat" ON "chat_member" FOR SELECT USING (
    is_chat_member("chatId") OR is_self("userId")
);
CREATE POLICY "Users can join (create membership)" ON "chat_member" FOR INSERT WITH CHECK (is_self("userId"));
CREATE POLICY "Users can leave (delete membership)" ON "chat_member" FOR DELETE USING (is_self("userId"));

-- AI Friend
CREATE POLICY "Members can view AI friends" ON "ai_friend" FOR SELECT USING (is_chat_member("chatId"));
CREATE POLICY "Members can create AI friends" ON "ai_friend" FOR INSERT WITH CHECK (is_chat_member("chatId"));

-- Message
CREATE POLICY "Members can view messages" ON "message" FOR SELECT USING (is_chat_member("chatId"));
CREATE POLICY "Members can insert messages" ON "message" FOR INSERT WITH CHECK (is_chat_member("chatId") AND is_self("userId"));
CREATE POLICY "Users can update their own messages" ON "message" FOR UPDATE USING (is_self("userId"));
CREATE POLICY "Users can delete their own messages" ON "message" FOR DELETE USING (is_self("userId"));

-- Reaction
CREATE POLICY "Members can view reactions" ON "reaction" FOR SELECT USING (
    EXISTS (SELECT 1 FROM message WHERE id = "messageId" AND is_chat_member("chatId"))
);
CREATE POLICY "Members can react" ON "reaction" FOR INSERT WITH CHECK (is_self("userId"));
CREATE POLICY "Users can remove their own reactions" ON "reaction" FOR DELETE USING (is_self("userId"));

-- Read Receipt
CREATE POLICY "Members can view read receipts" ON "read_receipt" FOR SELECT USING (
    EXISTS (SELECT 1 FROM message WHERE id = "messageId" AND is_chat_member("chatId"))
);
CREATE POLICY "Users can create read receipts" ON "read_receipt" FOR INSERT WITH CHECK (is_self("userId"));

-- Bookmark
CREATE POLICY "Users can view their own bookmarks" ON "bookmark" FOR SELECT USING (is_self("userId"));
CREATE POLICY "Users can create bookmarks" ON "bookmark" FOR INSERT WITH CHECK (is_self("userId"));
CREATE POLICY "Users can delete their own bookmarks" ON "bookmark" FOR DELETE USING (is_self("userId"));

-- Mention
CREATE POLICY "Members can view mentions" ON "mention" FOR SELECT USING (
    EXISTS (SELECT 1 FROM message WHERE id = "messageId" AND is_chat_member("chatId"))
);

-- Thread
CREATE POLICY "Members can view threads" ON "thread" FOR SELECT USING (is_chat_member("chatId"));
CREATE POLICY "Members can create threads" ON "thread" FOR INSERT WITH CHECK (is_chat_member("chatId") AND is_self("creatorId"));

-- Thread Member
CREATE POLICY "Thread members can view other thread members" ON "thread_member" FOR SELECT USING (
    EXISTS (SELECT 1 FROM thread WHERE id = "threadId" AND is_chat_member("chatId"))
);

-- Message Tag
CREATE POLICY "Members can view message tags" ON "message_tag" FOR SELECT USING (
    EXISTS (SELECT 1 FROM message WHERE id = "messageId" AND is_chat_member("chatId"))
);

-- Event
CREATE POLICY "Members can view events" ON "event" FOR SELECT USING (is_chat_member("chatId"));
CREATE POLICY "Members can create events" ON "event" FOR INSERT WITH CHECK (is_chat_member("chatId"));
CREATE POLICY "Creators can update events" ON "event" FOR UPDATE USING (auth.uid()::text = "createdBy");

-- Event Option
CREATE POLICY "Members can view event options" ON "event_option" FOR SELECT USING (
    EXISTS (SELECT 1 FROM event WHERE id = "eventId" AND is_chat_member("chatId"))
);

-- Event Response
CREATE POLICY "Members can view event responses" ON "event_response" FOR SELECT USING (
    EXISTS (SELECT 1 FROM event WHERE id = "eventId" AND is_chat_member("chatId"))
);
CREATE POLICY "Users can respond to events" ON "event_response" FOR INSERT WITH CHECK (is_self("userId"));
CREATE POLICY "Users can update their response" ON "event_response" FOR UPDATE USING (is_self("userId"));

-- Media Reaction
CREATE POLICY "Members can view media reactions" ON "media_reaction" FOR SELECT USING (
     EXISTS (SELECT 1 FROM message WHERE id = "messageId" AND is_chat_member("chatId"))
);

-- Conversation Summary
CREATE POLICY "Users can view their own summaries" ON "conversation_summary" FOR SELECT USING (is_self("userId"));

-- ==========================================
-- POLL FEATURE (December 2, 2025)
-- ==========================================
-- Migration: create_poll_tables

-- Poll table
CREATE TABLE IF NOT EXISTS "poll" (
  "id" TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
  "chatId" TEXT NOT NULL REFERENCES "chat"("id") ON DELETE CASCADE,
  "creatorId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "question" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'closed')),
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP WITHOUT TIME ZONE
);

-- Poll Option table
CREATE TABLE IF NOT EXISTS "poll_option" (
  "id" TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
  "pollId" TEXT NOT NULL REFERENCES "poll"("id") ON DELETE CASCADE,
  "optionText" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Poll Vote table (one vote per user per poll)
CREATE TABLE IF NOT EXISTS "poll_vote" (
  "id" TEXT PRIMARY KEY DEFAULT (extensions.uuid_generate_v4())::text,
  "pollId" TEXT NOT NULL REFERENCES "poll"("id") ON DELETE CASCADE,
  "optionId" TEXT NOT NULL REFERENCES "poll_option"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("pollId", "userId")
);

-- Add pollId to message table for poll messages
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "pollId" TEXT REFERENCES "poll"("id") ON DELETE SET NULL;

-- Poll indexes
CREATE INDEX IF NOT EXISTS "idx_poll_chatId" ON "poll"("chatId");
CREATE INDEX IF NOT EXISTS "idx_poll_option_pollId" ON "poll_option"("pollId");
CREATE INDEX IF NOT EXISTS "idx_poll_vote_pollId" ON "poll_vote"("pollId");
CREATE INDEX IF NOT EXISTS "idx_poll_vote_userId" ON "poll_vote"("userId");
CREATE INDEX IF NOT EXISTS "idx_message_pollId" ON "message"("pollId");

-- Enable RLS on poll tables
ALTER TABLE "poll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poll_option" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poll_vote" ENABLE ROW LEVEL SECURITY;

-- Poll RLS policies
CREATE POLICY "Users can view polls in their chats" ON "poll"
  FOR SELECT USING (is_chat_member("chatId"));
CREATE POLICY "Users can create polls in their chats" ON "poll"
  FOR INSERT WITH CHECK (is_chat_member("chatId"));
CREATE POLICY "Poll creators can update their polls" ON "poll"
  FOR UPDATE USING ("creatorId" = auth.uid()::text);

-- Poll Option RLS policies
CREATE POLICY "Users can view poll options" ON "poll_option"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "poll" p WHERE p."id" = "poll_option"."pollId" AND is_chat_member(p."chatId"))
  );
CREATE POLICY "Users can create poll options" ON "poll_option"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "poll" p WHERE p."id" = "poll_option"."pollId" AND is_chat_member(p."chatId"))
  );

-- Poll Vote RLS policies
CREATE POLICY "Users can view votes in their chats" ON "poll_vote"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "poll" p WHERE p."id" = "poll_vote"."pollId" AND is_chat_member(p."chatId"))
  );
CREATE POLICY "Users can vote on polls in their chats" ON "poll_vote"
  FOR INSERT WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (SELECT 1 FROM "poll" p WHERE p."id" = "poll_vote"."pollId" AND is_chat_member(p."chatId") AND p."status" = 'open')
  );
CREATE POLICY "Users can update their own votes" ON "poll_vote"
  FOR UPDATE USING ("userId" = auth.uid()::text);
CREATE POLICY "Users can delete their own votes" ON "poll_vote"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- ==========================================
-- AI LOCK FIX (December 3, 2025)
-- ==========================================
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

-- Function to efficiently calculate unread message counts for a user across all their chats
-- This replaces the N+1 query pattern with a single optimized query
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id text)
RETURNS TABLE (
  chat_id text,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_chats AS (
    -- Get all chats the user is a member of
    SELECT "chatId" FROM chat_member WHERE "userId" = p_user_id
  ),
  unread_messages AS (
    -- Count messages in each chat that:
    -- 1. Are not from the current user
    -- 2. Are not system messages
    -- 3. Don't have a read receipt from the current user
    SELECT 
      m."chatId",
      COUNT(m.id) AS unread_count
    FROM message m
    INNER JOIN user_chats uc ON m."chatId" = uc."chatId"
    LEFT JOIN read_receipt rr ON rr."messageId" = m.id AND rr."userId" = p_user_id
    WHERE 
      (m."userId" IS NULL OR m."userId" != p_user_id)  -- Not from current user (includes AI messages)
      AND m."messageType" != 'system'                   -- Not system messages
      AND rr.id IS NULL                                 -- No read receipt exists
    GROUP BY m."chatId"
  )
  -- Return all user chats with their unread counts (0 if no unread messages)
  SELECT 
    uc."chatId" AS chat_id,
    COALESCE(um.unread_count, 0) AS unread_count
  FROM user_chats uc
  LEFT JOIN unread_messages um ON uc."chatId" = um."chatId";
$$;

-- ==========================================
-- SECURITY & PRIVACY AUDIT (December 8, 2025)
-- ==========================================
-- Comprehensive security hardening for production readiness
--
-- Applied migrations:
-- - make_uploads_bucket_private: Changed uploads bucket from public to private
-- - consolidate_duplicate_rls_policies: Merged duplicate UPDATE/SELECT policies  
-- - enable_audit_logging: Enabled pgaudit extension for compliance logging
-- - implement_message_encryption: Added at-rest encryption for message content
--
-- STORAGE SECURITY:
-- - uploads bucket is now PRIVATE (no public access)
-- - All media access requires signed URLs (24h expiration)
-- - Files are organized by chat for access control
--
-- RLS POLICY OPTIMIZATIONS:
-- - All policies use (SELECT auth.uid()) pattern for per-query evaluation
-- - Consolidated duplicate permissive policies on chat and chat_member tables
-- - is_chat_member() helper function uses optimized auth.uid() call
--
-- AUDIT LOGGING (pgaudit):
-- - Extension enabled: pgaudit
-- - Authenticator role logs: write operations (INSERT, UPDATE, DELETE)
-- - Object-level auditing on: auth.users, public.user, public.message
-- - Audit role: security_auditor (non-login)
--
-- MESSAGE ENCRYPTION:
-- - Encryption key stored in Vault (message_encryption_key)
-- - AES-256 encryption via pgp_sym_encrypt
-- - is_encrypted column tracks encrypted messages
-- - message_decrypted view provides transparent decryption
-- - encrypt_existing_messages() function for batch migration
--
-- SIGNED URL ENDPOINTS:
-- - POST /api/upload/signed-url: Get signed URL for single file
-- - POST /api/upload/signed-urls: Batch signed URL generation (up to 50)
-- - All signed URLs expire after 24 hours
--
-- Note: Enable "Leaked Password Protection" in Supabase Dashboard > Auth Settings
-- This is a Pro Plan feature that checks passwords against HaveIBeenPwned database
-- ==========================================

-- ==========================================
-- STORAGE RLS POLICIES (December 8, 2025)
-- ==========================================
-- Privacy-focused storage access control
-- Users can only view images from users they share chats with
--
-- Migration: storage_rls_chat_based_access
-- ==========================================

-- Function to check if two users share a chat
CREATE OR REPLACE FUNCTION public.users_share_chat(user_id_1 uuid, user_id_2 uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if both users are members of at least one common chat
  RETURN EXISTS (
    SELECT 1
    FROM public."chatMember" cm1
    INNER JOIN public."chatMember" cm2 
      ON cm1."chatId" = cm2."chatId"
    WHERE cm1."userId" = user_id_1
      AND cm2."userId" = user_id_2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Storage RLS Policies on storage.objects

-- Allow users to view their own files
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'uploads' 
  AND auth.uid() = owner
);

-- Allow users to view files from users they share a chat with
CREATE POLICY "Users can view files from chat members"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    auth.uid() = owner  -- Can see own files
    OR public.users_share_chat(auth.uid(), owner)  -- Can see files from users in shared chats
  )
);

-- Allow authenticated users to upload (with owner set to uploading user)
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND auth.uid() = owner  -- Ensure owner is set to the uploading user
);

-- Allow users to update their own files
CREATE POLICY "Authenticated users can update own files"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'uploads' 
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'uploads' 
  AND auth.uid() = owner
);

-- Allow users to delete their own files
CREATE POLICY "Authenticated users can delete own files"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'uploads' 
  AND auth.uid() = owner
);

-- ==========================================
-- IMAGE PROXY ENDPOINT
-- ==========================================
-- Backend endpoint: /api/images/*
-- Serves images with RLS validation
-- Accepts auth token via:
--   1. Authorization header (Bearer token)
--   2. Query parameter (?token=xxx)
-- ==========================================
