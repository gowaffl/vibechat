-- Optimize message search ranking with simplified, normalized scoring
-- Date: 2024-12-24
-- Purpose: Replace complex ts_rank_cd with simpler ts_rank for predictable 0-1 scores

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

