-- AlterTable
ALTER TABLE chat ADD COLUMN inviteToken TEXT;

-- CreateIndex
CREATE UNIQUE INDEX chat_inviteToken_key ON chat(inviteToken);
