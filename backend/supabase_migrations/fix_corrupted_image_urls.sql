-- Migration: Fix corrupted image URLs that were double-prepended
-- Date: 2025-01-26
-- Description: Some image URLs were incorrectly saved with BACKEND_URL prepended to full Supabase Storage URLs
--              e.g., "https://backend.comhttps://supabase.co/storage/..." 
--              This migration extracts the clean Supabase URL

-- Fix user profile images
UPDATE "user"
SET image = SUBSTRING(image FROM POSITION('supabase.co' IN image) - LENGTH('https://xxekfvxdzixesjrbxoju.'))
WHERE image IS NOT NULL 
  AND image LIKE '%supabase.co/storage/%'
  AND LENGTH(image) - LENGTH(REPLACE(image, 'https://', '')) > LENGTH('https://');

-- Fix chat/group images
UPDATE "chat"
SET image = SUBSTRING(image FROM POSITION('supabase.co' IN image) - LENGTH('https://xxekfvxdzixesjrbxoju.'))
WHERE image IS NOT NULL 
  AND image LIKE '%supabase.co/storage/%'
  AND LENGTH(image) - LENGTH(REPLACE(image, 'https://', '')) > LENGTH('https://');

-- Fix message images
UPDATE "message"
SET "imageUrl" = SUBSTRING("imageUrl" FROM POSITION('supabase.co' IN "imageUrl") - LENGTH('https://xxekfvxdzixesjrbxoju.'))
WHERE "imageUrl" IS NOT NULL 
  AND "imageUrl" LIKE '%supabase.co/storage/%'
  AND LENGTH("imageUrl") - LENGTH(REPLACE("imageUrl", 'https://', '')) > LENGTH('https://');

-- Note: This is a one-time fix. The frontend code has been updated to prevent this issue going forward.

