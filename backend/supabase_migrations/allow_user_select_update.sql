-- Allow users to read their own profile (and potentially others if your app allows it)
-- For now, let's allow reading ANY profile (public profiles)
CREATE POLICY "Enable read access for all users" ON "user"
FOR SELECT USING (true);

-- Allow users to update ONLY their own profile
CREATE POLICY "Enable update for users based on user_id" ON "user"
FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

-- Ensure RLS is enabled (already done, but good for completeness)
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

