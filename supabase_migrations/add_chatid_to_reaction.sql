-- Migration: add_chatid_to_reaction
-- Description: Adds chatId to reaction table for efficient Realtime filtering

-- 1. Add nullable chatId column
ALTER TABLE "reaction" ADD COLUMN IF NOT EXISTS "chatId" TEXT;

-- 2. Backfill chatId from message table
UPDATE "reaction" r
SET "chatId" = m."chatId"
FROM "message" m
WHERE r."messageId" = m."id"
  AND r."chatId" IS NULL;

-- 3. Make chatId NOT NULL (assuming all reactions have messages with chatIds)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "reaction" WHERE "chatId" IS NULL) THEN
        ALTER TABLE "reaction" ALTER COLUMN "chatId" SET NOT NULL;
    END IF;
END $$;

-- 4. Add Foreign Key
ALTER TABLE "reaction" 
    DROP CONSTRAINT IF EXISTS "reaction_chatId_fkey";

ALTER TABLE "reaction" 
    ADD CONSTRAINT "reaction_chatId_fkey" 
    FOREIGN KEY ("chatId") 
    REFERENCES "chat" ("id") 
    ON DELETE CASCADE;

-- 5. Add Index for performance
CREATE INDEX IF NOT EXISTS "reaction_chatId_idx" ON "reaction"("chatId");

-- 6. Update RLS policy to use chatId directly (more efficient)
-- Use explicit subquery to avoid function ambiguity
DROP POLICY IF EXISTS "Members can view reactions" ON "reaction";
CREATE POLICY "Members can view reactions" ON "reaction" FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM "chat_member" cm 
      WHERE cm."chatId" = "reaction"."chatId" 
      AND cm."userId" = auth.uid()::text
    )
);
