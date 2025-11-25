-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_reaction" ("createdAt", "emoji", "id", "messageId", "userId") SELECT "createdAt", "emoji", "id", "messageId", "userId" FROM "reaction";
DROP TABLE "reaction";
ALTER TABLE "new_reaction" RENAME TO "reaction";
CREATE UNIQUE INDEX "reaction_userId_messageId_emoji_key" ON "reaction"("userId", "messageId", "emoji");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
