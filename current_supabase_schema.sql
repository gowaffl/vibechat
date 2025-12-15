
-- ==========================================
-- CHAT PERMISSIONS (December 2025)
-- ==========================================
-- Add isRestricted column to chat table
ALTER TABLE public.chat ADD COLUMN "isRestricted" boolean DEFAULT false;
