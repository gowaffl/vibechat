-- Allow chat creators to update and delete AI friends
CREATE POLICY "Chat creators can update AI friends" ON "ai_friend" FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM chat WHERE id = "chatId" AND "creatorId" = auth.uid()::text
  )
);

CREATE POLICY "Chat creators can delete AI friends" ON "ai_friend" FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM chat WHERE id = "chatId" AND "creatorId" = auth.uid()::text
  )
);

