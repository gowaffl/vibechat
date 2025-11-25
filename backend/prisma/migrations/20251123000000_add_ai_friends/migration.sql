-- CreateTable
CREATE TABLE "ai_friend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'AI Friend',
    "personality" TEXT,
    "tone" TEXT,
    "engagementMode" TEXT NOT NULL DEFAULT 'on-call',
    "engagementPercent" INTEGER,
    "color" TEXT NOT NULL DEFAULT '#34C759',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_friend_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ai_friend_chatId_idx" ON "ai_friend"("chatId");

-- CreateIndex
CREATE INDEX "ai_friend_chatId_sortOrder_idx" ON "ai_friend"("chatId", "sortOrder");

-- AlterTable: Add aiFriendId to message table
ALTER TABLE "message" ADD COLUMN "aiFriendId" TEXT;

-- Data Migration: Migrate existing Chat AI settings to AIFriend records
-- For each chat with AI settings, create a corresponding AIFriend record
INSERT INTO "ai_friend" ("id", "chatId", "name", "personality", "tone", "engagementMode", "engagementPercent", "color", "sortOrder", "createdAt", "updatedAt")
SELECT 
    'ai-friend-' || "id" as "id",
    "id" as "chatId",
    COALESCE("aiName", 'AI Friend') as "name",
    "aiPersonality" as "personality",
    "aiTone" as "tone",
    "aiEngagementMode" as "engagementMode",
    "aiEngagementPercent" as "engagementPercent",
    '#34C759' as "color",
    0 as "sortOrder",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "chat";

-- Link existing AI messages to the migrated AI friends
-- Update messages where userId is 'ai-assistant' to reference the corresponding AIFriend
UPDATE "message" 
SET "aiFriendId" = 'ai-friend-' || "chatId"
WHERE "userId" = 'ai-assistant';

