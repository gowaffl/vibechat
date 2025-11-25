-- CreateTable
CREATE TABLE "read_receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "read_receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "read_receipt_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "read_receipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Anonymous',
    "bio" TEXT,
    "image" TEXT,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "pushToken" TEXT,
    "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_user" ("bio", "createdAt", "hasCompletedOnboarding", "id", "image", "name", "updatedAt") SELECT "bio", "createdAt", "hasCompletedOnboarding", "id", "image", "name", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "read_receipt_userId_chatId_idx" ON "read_receipt"("userId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "read_receipt_userId_messageId_key" ON "read_receipt"("userId", "messageId");
