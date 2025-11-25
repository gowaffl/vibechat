-- CreateTable
CREATE TABLE "chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'New Chat',
    "bio" TEXT,
    "image" TEXT,
    "aiPersonality" TEXT,
    "aiTone" TEXT,
    "lastAvatarGenDate" DATETIME,
    "avatarPromptUsed" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_member_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migration: Convert existing data from group_settings to a default chat
-- Step 1: Create a default chat from group_settings (use first user as creator)
INSERT INTO "chat" ("id", "name", "bio", "image", "aiPersonality", "aiTone", "lastAvatarGenDate", "avatarPromptUsed", "creatorId", "createdAt", "updatedAt")
SELECT
    'default-chat',
    COALESCE(gs.name, 'VibeChat'),
    gs.bio,
    gs.image,
    gs.aiPersonality,
    gs.aiTone,
    gs.lastAvatarGenDate,
    gs.avatarPromptUsed,
    (SELECT id FROM "user" ORDER BY createdAt ASC LIMIT 1),
    gs.createdAt,
    gs.updatedAt
FROM "group_settings" gs
WHERE gs.id = 'global-chat';

-- Step 2: Add all existing users as members of the default chat
INSERT INTO "chat_member" ("id", "chatId", "userId", "joinedAt")
SELECT
    'member-' || u.id,
    'default-chat',
    u.id,
    u.createdAt
FROM "user" u;

-- Step 3: Create new message table with chatId
CREATE TABLE "message_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL DEFAULT '',
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "imageUrl" TEXT,
    "imageDescription" TEXT,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "replyToId" TEXT,
    "linkPreviewUrl" TEXT,
    "linkPreviewTitle" TEXT,
    "linkPreviewDescription" TEXT,
    "linkPreviewImage" TEXT,
    "linkPreviewSiteName" TEXT,
    "linkPreviewFavicon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_new_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_new_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_new_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "message_new" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 4: Copy all existing messages to the default chat
INSERT INTO "message_new"
SELECT
    id,
    content,
    messageType,
    imageUrl,
    imageDescription,
    userId,
    'default-chat' as chatId,
    replyToId,
    linkPreviewUrl,
    linkPreviewTitle,
    linkPreviewDescription,
    linkPreviewImage,
    linkPreviewSiteName,
    linkPreviewFavicon,
    createdAt
FROM "message";

-- Step 5: Drop old message table and rename new one
DROP TABLE "message";
ALTER TABLE "message_new" RENAME TO "message";

-- Step 6: Create new custom_slash_command table with chatId
CREATE TABLE "custom_slash_command_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "command" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_slash_command_new_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 7: Copy all existing custom commands to the default chat
INSERT INTO "custom_slash_command_new"
SELECT
    id,
    command,
    prompt,
    'default-chat' as chatId,
    createdAt,
    updatedAt
FROM "custom_slash_command";

-- Step 8: Drop old custom_slash_command table and rename new one
DROP TABLE "custom_slash_command";
ALTER TABLE "custom_slash_command_new" RENAME TO "custom_slash_command";

-- Step 9: Drop group_settings table (data is now in chat table)
DROP TABLE "group_settings";

-- CreateIndex
CREATE UNIQUE INDEX "chat_member_chatId_userId_key" ON "chat_member"("chatId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_slash_command_chatId_command_key" ON "custom_slash_command"("chatId", "command");
