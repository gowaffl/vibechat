
-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STORAGE BUCKETS CONFIGURATION
-- ============================================================================

-- Vibe Call Recordings Bucket
-- Used by LiveKit Egress to store voice room recordings via S3
-- File size limit: 500MB (524,288,000 bytes) to accommodate longer recordings
-- Updated: 2024-12-19 (previously 25MB, caused 413 EntityTooLarge errors)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vibe-call-recordings',
  'vibe-call-recordings',
  false,  -- Private bucket, recordings are not publicly accessible
  524288000,  -- 500MB limit
  ARRAY['audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'video/mp4'];

-- Uploads Bucket (general file uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'uploads',
  'uploads',
  true,  -- Public bucket
  NULL   -- No file size limit
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MESSAGE ENCRYPTION
-- ============================================================================

-- Message encryption is handled via the decrypt_message_content() function
-- which is SECURITY DEFINER to access vault.decrypted_secrets.
-- 
-- Architecture:
-- 1. Messages are stored encrypted at rest in the message table
-- 2. The message table has RLS policies that enforce chat membership
-- 3. Decryption happens EXPLICITLY in the backend via:
--    - decryptMessageContent() for single messages
--    - decryptMessages() for batch decryption
-- 4. NO automatic decryption views exist (security risk)
--
-- CRITICAL DEVELOPER RULE:
-- Whenever you query the message table and use the 'content' field,
-- you MUST decrypt it first using the encryption service:
--   import { decryptMessages } from "../services/message-encryption";
--   const decrypted = await decryptMessages(messages);
--
-- Decryption is required BEFORE:
-- - AI reading messages (context, summaries, responses)
-- - Displaying messages to users
-- - Translating messages
-- - Searching message content
-- - Processing messages in workflows
-- - Any operation that reads/uses message content
--
-- Decryption is NOT required for:
-- - Reading metadata only (id, userId, chatId, imageUrl, createdAt)
-- - Inserting new messages (content already plaintext)
-- - Deleting messages (only need ID)
--
-- Security Audit Completed: 2024-12-22
-- - Removed message_decrypted view (SECURITY DEFINER bypass risk)
-- - Fixed 5 critical issues where messages weren't decrypted
-- - All 22 route files audited and verified
-- - 100% decryption coverage achieved

-- ============================================================================
-- MESSAGE SEARCH & INDEXING
-- ============================================================================

-- Create GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS message_content_fts_idx ON public.message USING gin (to_tsvector('english', coalesce(content, '')));

-- Create Trigram index for partial/fuzzy match
CREATE INDEX IF NOT EXISTS message_content_trgm_idx ON public.message USING gin (content gin_trgm_ops);

-- Composite indexes for common filters + sorting
CREATE INDEX IF NOT EXISTS message_chat_created_idx ON public.message ("chatId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS message_user_created_idx ON public.message ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS message_type_created_idx ON public.message ("messageType", "createdAt" DESC);

-- Update match_messages function to include recency sorting and better threshold
CREATE OR REPLACE FUNCTION match_messages (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text DEFAULT NULL,
  filter_chat_ids text[] DEFAULT NULL,
  filter_message_types text[] DEFAULT NULL,
  filter_date_from timestamp with time zone DEFAULT NULL,
  filter_date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id text,
  content text,
  similarity float,
  createdAt timestamp without time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    message.id,
    message.content,
    1 - (message.embedding <=> query_embedding) as similarity,
    message."createdAt"
  FROM message
  WHERE 1 - (message.embedding <=> query_embedding) > match_threshold
  AND message.embedding IS NOT NULL -- Filter out null embeddings
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id)
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids))
  AND (filter_message_types IS NULL OR message."messageType" = ANY(filter_message_types))
  AND (filter_date_from IS NULL OR message."createdAt" >= filter_date_from)
  AND (filter_date_to IS NULL OR message."createdAt" <= filter_date_to)
  ORDER BY 
    message."createdAt" DESC -- User requested strictest recency sorting
  LIMIT match_count;
END;
$$;

-- New RPC for High-Performance Text Search
-- CRITICAL: Uses search_vector (plaintext) column, NOT encrypted content
-- Returns empty content string - backend must decrypt using decryptMessages()
-- Fixed: Proper data types (text IDs to match schema) and quoted "createdAt" to preserve case
CREATE OR REPLACE FUNCTION search_messages_text (
  search_query text,
  match_count integer,
  filter_user_id text DEFAULT NULL,
  filter_chat_ids text[] DEFAULT NULL,
  filter_message_types text[] DEFAULT NULL,
  filter_date_from timestamp with time zone DEFAULT NULL,
  filter_date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id text,
  content text,
  rank real,
  "createdAt" timestamp without time zone
)
LANGUAGE plpgsql
AS $$
DECLARE
  formatted_query text;
  prefix_query tsquery;
  web_query tsquery;
BEGIN
  IF trim(search_query) = '' THEN
    RETURN;
  END IF;

  -- 1. Standard Web Search Query (handles quotes, etc.)
  web_query := websearch_to_tsquery('english', search_query);

  -- 2. Prefix Query (for type-ahead feel)
  SELECT string_agg(trim(token) || ':*', ' & ') INTO formatted_query
  FROM regexp_split_to_table(trim(search_query), '\s+') AS token
  WHERE trim(token) != '';

  BEGIN
    prefix_query := to_tsquery('english', formatted_query);
  EXCEPTION WHEN OTHERS THEN
    prefix_query := web_query; -- Fallback
  END;

  RETURN QUERY
  SELECT
    message.id,
    -- CRITICAL: Return empty string - content will be decrypted in backend
    ''::text as content,
    -- Simplified ranking with normalization for consistent 0-1 scores
    -- Normalization flag 32: divides by document length for predictable range
    -- Boost exact phrase matches (web_query) over prefix matches
    GREATEST(
      COALESCE(ts_rank(message.search_vector, web_query, 32), 0) * 2.0,  -- Exact phrase: 2x boost
      COALESCE(ts_rank(message.search_vector, prefix_query, 32), 0)       -- Prefix match: 1x
    )::real as rank,
    message."createdAt"
  FROM message
  WHERE (
    -- Use search_vector (plaintext) instead of content (encrypted)
    message.search_vector @@ web_query
    OR
    message.search_vector @@ prefix_query
  )
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id)
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids))
  AND (filter_message_types IS NULL OR message."messageType" = ANY(filter_message_types))
  AND (filter_date_from IS NULL OR message."createdAt" >= filter_date_from)
  AND (filter_date_to IS NULL OR message."createdAt" <= filter_date_to)
  ORDER BY 
    rank DESC,  -- Sort by relevance first
    message."createdAt" DESC  -- Then by recency as tiebreaker
  LIMIT match_count;
END;
$$;

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

