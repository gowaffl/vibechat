
-- Add search_vector column for secure server-side text search
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast text search
CREATE INDEX IF NOT EXISTS message_search_idx ON public.message USING GIN (search_vector);

-- Update the encryption trigger function to populate search_vector before encryption
CREATE OR REPLACE FUNCTION public.encrypt_message_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Only process text content, not system messages or empty content
  IF NEW.content IS NOT NULL 
     AND NEW.content != '' 
     AND (NEW."userId" IS NOT NULL OR NEW."aiFriendId" IS NOT NULL) THEN
    
    -- 1. Populate search_vector from PLAINTEXT content (before encryption)
    -- We use 'english' configuration which handles stemming (running -> run)
    NEW.search_vector := to_tsvector('english', NEW.content);
    
    -- 2. Encrypt the content
    NEW.content := encrypt_message_content(NEW.content);
    NEW.is_encrypted := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

