-- Feature Request Table
CREATE TABLE IF NOT EXISTS "feature_request" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, planned, in_progress, completed, rejected
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "feature_request_status_check" CHECK ("status" IN ('pending', 'planned', 'in_progress', 'completed', 'rejected'))
);

CREATE TRIGGER update_feature_request_updatedAt
    BEFORE UPDATE ON "feature_request"
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Feature Vote Table
CREATE TABLE IF NOT EXISTS "feature_vote" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL, -- up, down
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE,
    CONSTRAINT "feature_vote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "feature_request" ("id") ON DELETE CASCADE,
    CONSTRAINT "feature_vote_voteType_check" CHECK ("voteType" IN ('up', 'down')),
    UNIQUE ("userId", "requestId")
);

-- Changelog Entry Table
CREATE TABLE IF NOT EXISTS "changelog_entry" (
    "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "feature_request_userId_idx" ON "feature_request"("userId");
CREATE INDEX IF NOT EXISTS "feature_request_status_idx" ON "feature_request"("status");
CREATE INDEX IF NOT EXISTS "feature_request_score_idx" ON "feature_request"("score" DESC);
CREATE INDEX IF NOT EXISTS "feature_vote_userId_idx" ON "feature_vote"("userId");
CREATE INDEX IF NOT EXISTS "feature_vote_requestId_idx" ON "feature_vote"("requestId");
CREATE INDEX IF NOT EXISTS "changelog_entry_publishedAt_idx" ON "changelog_entry"("publishedAt" DESC);

-- RLS Policies

-- feature_request
ALTER TABLE "feature_request" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feature requests" ON "feature_request"
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create feature requests" ON "feature_request"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own feature requests" ON "feature_request"
    FOR UPDATE USING (auth.uid()::text = "userId");

-- feature_vote
ALTER TABLE "feature_vote" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feature votes" ON "feature_vote"
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON "feature_vote"
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own votes" ON "feature_vote"
    FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own votes" ON "feature_vote"
    FOR DELETE USING (auth.uid()::text = "userId");

-- changelog_entry
ALTER TABLE "changelog_entry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changelog" ON "changelog_entry"
    FOR SELECT USING (true);

-- Only service role can manage changelog (no public write access)


-- Function to calculate score and vote counts
CREATE OR REPLACE FUNCTION update_feature_request_score()
RETURNS TRIGGER AS $$
DECLARE
    target_request_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_request_id := OLD."requestId";
    ELSE
        target_request_id := NEW."requestId";
    END IF;

    UPDATE "feature_request"
    SET 
        "upvotes" = (SELECT COUNT(*) FROM "feature_vote" WHERE "requestId" = target_request_id AND "voteType" = 'up'),
        "downvotes" = (SELECT COUNT(*) FROM "feature_vote" WHERE "requestId" = target_request_id AND "voteType" = 'down'),
        "score" = (
            (SELECT COUNT(*) FROM "feature_vote" WHERE "requestId" = target_request_id AND "voteType" = 'up') - 
            (SELECT COUNT(*) FROM "feature_vote" WHERE "requestId" = target_request_id AND "voteType" = 'down')
        )
    WHERE "id" = target_request_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vote updates
CREATE TRIGGER update_feature_request_score_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "feature_vote"
    FOR EACH ROW
    EXECUTE PROCEDURE update_feature_request_score();
