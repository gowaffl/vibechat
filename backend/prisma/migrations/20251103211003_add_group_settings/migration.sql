-- CreateTable
CREATE TABLE "group_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global-chat',
    "name" TEXT NOT NULL DEFAULT 'Vibecode Chat',
    "bio" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
