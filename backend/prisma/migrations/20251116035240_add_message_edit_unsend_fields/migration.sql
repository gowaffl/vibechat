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
    "chatId" TEXT NOT NULL,
    "replyToId" TEXT,
    "linkPreviewUrl" TEXT,
    "linkPreviewTitle" TEXT,
    "linkPreviewDescription" TEXT,
    "linkPreviewImage" TEXT,
    "linkPreviewSiteName" TEXT,
    "linkPreviewFavicon" TEXT,
    "editedAt" DATETIME,
    "isUnsent" BOOLEAN NOT NULL DEFAULT false,
    "editHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_message" ("chatId", "content", "createdAt", "id", "imageDescription", "imageUrl", "linkPreviewDescription", "linkPreviewFavicon", "linkPreviewImage", "linkPreviewSiteName", "linkPreviewTitle", "linkPreviewUrl", "messageType", "replyToId", "userId") SELECT "chatId", "content", "createdAt", "id", "imageDescription", "imageUrl", "linkPreviewDescription", "linkPreviewFavicon", "linkPreviewImage", "linkPreviewSiteName", "linkPreviewTitle", "linkPreviewUrl", "messageType", "replyToId", "userId" FROM "message";
DROP TABLE "message";
ALTER TABLE "new_message" RENAME TO "message";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
