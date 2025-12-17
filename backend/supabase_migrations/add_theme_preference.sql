-- Add themePreference column to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "themePreference" text DEFAULT 'system'
  CHECK ("themePreference" IN ('light', 'dark', 'system'));

