-- CreateTable
CREATE TABLE "thread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💬',
    "creatorId" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "filterRules" TEXT NOT NULL,
    "memberIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thread_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "message_tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_tag_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "thread_member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thread_member_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "finalizedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "optionType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_option_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionId" TEXT,
    "responseType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_response_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "event_response_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "event_option" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL,
    "resultUrl" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "conversation_summary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summaryType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageRange" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "thread_chatId_idx" ON "thread"("chatId");

-- CreateIndex
CREATE INDEX "message_tag_messageId_idx" ON "message_tag"("messageId");

-- CreateIndex
CREATE INDEX "message_tag_tagType_tagValue_idx" ON "message_tag"("tagType", "tagValue");

-- CreateIndex
CREATE INDEX "thread_member_userId_idx" ON "thread_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_member_threadId_userId_key" ON "thread_member"("threadId", "userId");

-- CreateIndex
CREATE INDEX "event_chatId_idx" ON "event"("chatId");

-- CreateIndex
CREATE INDEX "event_status_idx" ON "event"("status");

-- CreateIndex
CREATE INDEX "event_option_eventId_idx" ON "event_option"("eventId");

-- CreateIndex
CREATE INDEX "event_response_eventId_idx" ON "event_response"("eventId");

-- CreateIndex
CREATE INDEX "event_response_userId_idx" ON "event_response"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_response_eventId_userId_optionId_key" ON "event_response"("eventId", "userId", "optionId");

-- CreateIndex
CREATE INDEX "media_reaction_messageId_idx" ON "media_reaction"("messageId");

-- CreateIndex
CREATE INDEX "media_reaction_userId_idx" ON "media_reaction"("userId");

-- CreateIndex
CREATE INDEX "conversation_summary_chatId_userId_idx" ON "conversation_summary"("chatId", "userId");

-- CreateIndex
CREATE INDEX "conversation_summary_expiresAt_idx" ON "conversation_summary"("expiresAt");
