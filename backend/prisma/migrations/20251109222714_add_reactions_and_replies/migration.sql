-- CreateTable
CREATE TABLE "reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL DEFAULT '',
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "imageUrl" TEXT,
    "imageDescription" TEXT,
    "userId" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_message" ("content", "createdAt", "id", "imageDescription", "imageUrl", "messageType", "userId") SELECT "content", "createdAt", "id", "imageDescription", "imageUrl", "messageType", "userId" FROM "message";
DROP TABLE "message";
ALTER TABLE "new_message" RENAME TO "message";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "reaction_userId_messageId_emoji_key" ON "reaction"("userId", "messageId", "emoji");
