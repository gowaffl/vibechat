-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'New Chat',
    "bio" TEXT,
    "image" TEXT,
    "aiPersonality" TEXT,
    "aiTone" TEXT,
    "aiName" TEXT DEFAULT 'AI Assistant',
    "aiEngagementMode" TEXT NOT NULL DEFAULT 'on-call',
    "aiEngagementPercent" INTEGER,
    "lastAvatarGenDate" DATETIME,
    "avatarPromptUsed" TEXT,
    "inviteToken" TEXT,
    "inviteTokenExpiresAt" DATETIME,
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chat" ("aiName", "aiPersonality", "aiTone", "avatarPromptUsed", "bio", "createdAt", "creatorId", "id", "image", "inviteToken", "inviteTokenExpiresAt", "lastAvatarGenDate", "name", "updatedAt") SELECT "aiName", "aiPersonality", "aiTone", "avatarPromptUsed", "bio", "createdAt", "creatorId", "id", "image", "inviteToken", "inviteTokenExpiresAt", "lastAvatarGenDate", "name", "updatedAt" FROM "chat";
DROP TABLE "chat";
ALTER TABLE "new_chat" RENAME TO "chat";
CREATE UNIQUE INDEX "chat_inviteToken_key" ON "chat"("inviteToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
