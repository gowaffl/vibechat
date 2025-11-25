-- Add phone column to user table for WhatsApp-style authentication
-- Migration: add_phone_to_user
-- Date: 2025-11-24

-- Add phone column (unique, required for new users)
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Create unique index on phone
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_key" ON "user"("phone");

-- Add comment explaining the phone format
COMMENT ON COLUMN "user"."phone" IS 'Phone number in E.164 format (e.g., +12396998960)';

