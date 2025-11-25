-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_group_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global-chat',
    "name" TEXT NOT NULL DEFAULT 'VibeChat',
    "bio" TEXT,
    "image" TEXT,
    "aiPersonality" TEXT,
    "aiTone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageHistory" TEXT NOT NULL DEFAULT '[]',
    "lastAvatarGenDate" DATETIME,
    "avatarPromptUsed" TEXT
);
INSERT INTO "new_group_settings" ("aiPersonality", "aiTone", "avatarPromptUsed", "bio", "createdAt", "id", "image", "lastAvatarGenDate", "messageHistory", "name", "updatedAt") SELECT "aiPersonality", "aiTone", "avatarPromptUsed", "bio", "createdAt", "id", "image", "lastAvatarGenDate", "messageHistory", "name", "updatedAt" FROM "group_settings";
DROP TABLE "group_settings";
ALTER TABLE "new_group_settings" RENAME TO "group_settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
