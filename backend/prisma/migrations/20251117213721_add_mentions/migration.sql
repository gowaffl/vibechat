-- CreateTable
CREATE TABLE "mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "mentionedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mention_mentionedByUserId_fkey" FOREIGN KEY ("mentionedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "mention_mentionedUserId_idx" ON "mention"("mentionedUserId");

-- CreateIndex
CREATE INDEX "mention_messageId_idx" ON "mention"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "mention_messageId_mentionedUserId_key" ON "mention"("messageId", "mentionedUserId");
