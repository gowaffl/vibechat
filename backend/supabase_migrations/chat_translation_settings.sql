-- Add translation settings to chat_member table
ALTER TABLE public.chat_member 
ADD COLUMN IF NOT EXISTS translation_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS translation_language text DEFAULT 'en';

-- Update the view or functions if necessary (usually not needed for simple column additions unless specific RPCs use them)

