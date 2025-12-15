-- Add isRestricted column to chat table
ALTER TABLE public.chat ADD COLUMN "isRestricted" boolean DEFAULT false;

-- Update the chat view or any relevant functions if necessary (none found in immediate context, but good practice to keep in mind)

