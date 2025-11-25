-- Allow users to insert their own profile
CREATE POLICY "Enable insert for users based on user_id" ON "user"
FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

