-- Migration: Increase file size limit for vibe-call-recordings bucket
-- Date: 2024-12-19
-- Reason: Voice room recordings were failing with 413 EntityTooLarge errors
-- The previous 25MB limit was too small for longer voice conversations

-- Update the vibe-call-recordings bucket to allow up to 500MB files
-- This accommodates longer voice room recordings while still being reasonable
UPDATE storage.buckets 
SET file_size_limit = 524288000  -- 500MB in bytes
WHERE id = 'vibe-call-recordings';

-- Verify the update
SELECT 
  id, 
  name, 
  file_size_limit, 
  file_size_limit / 1048576 as size_limit_mb,
  public
FROM storage.buckets
WHERE id = 'vibe-call-recordings';

