
-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS message_content_fts_idx ON public.message USING gin (to_tsvector('english', coalesce(content, '')));

-- Create Trigram index for partial/fuzzy match
CREATE INDEX IF NOT EXISTS message_content_trgm_idx ON public.message USING gin (content gin_trgm_ops);

-- Composite indexes for common filters + sorting
CREATE INDEX IF NOT EXISTS message_chat_created_idx ON public.message ("chatId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS message_user_created_idx ON public.message ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS message_type_created_idx ON public.message ("messageType", "createdAt" DESC);

-- Drop existing functions to allow signature changes
DROP FUNCTION IF EXISTS match_messages(vector, double precision, integer, text, text[], text[], timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS match_messages(vector, double precision, integer, text, text[]);
DROP FUNCTION IF EXISTS search_messages_text(text, integer, text, text[], text[], timestamp with time zone, timestamp with time zone);

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
CREATE OR REPLACE FUNCTION search_messages_text (
  search_query text,
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
  rank float,
  createdAt timestamp without time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    message.id,
    message.content,
    ts_rank_cd(to_tsvector('english', coalesce(message.content, '')), websearch_to_tsquery('english', search_query)) as rank,
    message."createdAt"
  FROM message
  WHERE (
    -- Full Text Match
    to_tsvector('english', coalesce(message.content, '')) @@ websearch_to_tsquery('english', search_query)
    OR
    -- Fallback to simple ILIKE for partial words (prefix search) using Trigram index
    message.content ILIKE '%' || search_query || '%'
  )
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
