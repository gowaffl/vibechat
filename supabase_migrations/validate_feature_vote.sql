-- Check function to prevent self-voting
CREATE OR REPLACE FUNCTION check_self_vote()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "feature_request"
    WHERE id = NEW."requestId"
    AND "userId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION 'Users cannot vote on their own feature requests';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for before insert
DROP TRIGGER IF EXISTS check_self_vote_trigger ON "feature_vote";
CREATE TRIGGER check_self_vote_trigger
  BEFORE INSERT ON "feature_vote"
  FOR EACH ROW
  EXECUTE PROCEDURE check_self_vote();
