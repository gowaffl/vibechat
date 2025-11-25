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

