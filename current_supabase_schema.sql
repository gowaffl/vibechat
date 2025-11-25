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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE IF NOT EXISTS "message" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "content" TEXT NOT NULL DEFAULT '',
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "imageUrl" TEXT,
    "imageDescription" TEXT,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "replyToId" TEXT,
    "aiFriendId" TEXT,
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
-- MIGRATION: make_message_user_id_nullable
-- Date: November 25, 2025
-- ==========================================
-- Make userId nullable in message table to allow AI friends to send messages
-- without being users. AI friends are identified by aiFriendId instead.

ALTER TABLE message 
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE message 
DROP CONSTRAINT IF EXISTS "message_userId_fkey";

ALTER TABLE message 
ADD CONSTRAINT "message_userId_fkey" 
FOREIGN KEY ("userId") 
REFERENCES "user"(id) 
ON DELETE SET NULL;
