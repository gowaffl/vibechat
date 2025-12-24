-- FIX: Drop conflicting search functions and create single definitive version
-- Problem: Two versions exist (uuid and text parameter types) causing PGRST203 error
-- Date: 2024-12-24

-- Step 1: Drop ALL versions of the function to start clean
DROP FUNCTION IF EXISTS public.search_messages_text(text, integer, uuid, uuid[], text[], timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.search_messages_text(text, integer, text, text[], text[], timestamp with time zone, timestamp with time zone);

-- Step 2: Create single definitive version with TEXT types (matching our schema)
CREATE OR REPLACE FUNCTION public.search_messages_text (
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
    ''::text as content,  -- Empty - decrypted in backend
    -- Simplified ranking: use GREATEST to pick best match type
    GREATEST(
      COALESCE(ts_rank(message.search_vector, web_query, 32), 0) * 2.0,  -- Exact: 2x boost
      COALESCE(ts_rank(message.search_vector, prefix_query, 32), 0)       -- Prefix: 1x
    )::real as rank,
    message."createdAt"
  FROM message
  WHERE (
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
    rank DESC,
    message."createdAt" DESC
  LIMIT match_count;
END;
$$;

