-- CreateTable
CREATE TABLE "custom_slash_command" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "command" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_slash_command_command_key" ON "custom_slash_command"("command");
