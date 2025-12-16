-- Add voiceTranscription column to message table
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS "voiceTranscription" text;

