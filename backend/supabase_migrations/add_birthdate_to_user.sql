ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "birthdate" DATE;
COMMENT ON COLUMN "user"."birthdate" IS 'User birthdate for age verification and safety settings';

