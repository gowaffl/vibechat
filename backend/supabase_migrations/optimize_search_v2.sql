
-- Update search_messages_text for better partial matching and case insensitivity
CREATE OR REPLACE FUNCTION public.search_messages_text(
  search_query text, 
  match_count integer, 
  filter_user_id text DEFAULT NULL::text, 
  filter_chat_ids text[] DEFAULT NULL::text[], 
  filter_message_types text[] DEFAULT NULL::text[], 
  filter_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  filter_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(id text, content text, rank double precision, createdat timestamp without time zone)
LANGUAGE plpgsql
AS $function$
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
  -- Convert "Hello Wor" -> "Hello:* & Wor:*"
  -- We split by non-alphanumeric chars to get tokens
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
    message.content,
    -- Rank Calculation:
    -- Prefer Exact Phrase/Web Match > Prefix Match > Substring Match
    (
      ts_rank_cd(to_tsvector('english', coalesce(message.content, '')), web_query) * 1.5 + -- Bonus for exact/web match
      ts_rank_cd(to_tsvector('english', coalesce(message.content, '')), prefix_query) +
      CASE WHEN message.content ILIKE '%' || search_query || '%' THEN 0.1 ELSE 0 END
    ) as rank,
    message."createdAt"
  FROM message
  WHERE (
    -- 1. Full Text Web Match
    to_tsvector('english', coalesce(message.content, '')) @@ web_query
    OR
    -- 2. Full Text Prefix Match
    to_tsvector('english', coalesce(message.content, '')) @@ prefix_query
    OR
    -- 3. Trigram/ILIKE Fallback (Case Insensitive Substring)
    message.content ILIKE '%' || search_query || '%'
  )
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id)
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids))
  AND (filter_message_types IS NULL OR message."messageType" = ANY(filter_message_types))
  AND (filter_date_from IS NULL OR message."createdAt" >= filter_date_from)
  AND (filter_date_to IS NULL OR message."createdAt" <= filter_date_to)
  ORDER BY 
    message."createdAt" DESC
  LIMIT match_count;
END;
$function$;

-- Update match_messages with lower threshold for better recall
CREATE OR REPLACE FUNCTION public.match_messages(
  query_embedding vector, 
  match_threshold double precision, 
  match_count integer, 
  filter_user_id text DEFAULT NULL::text, 
  filter_chat_ids text[] DEFAULT NULL::text[], 
  filter_message_types text[] DEFAULT NULL::text[], 
  filter_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  filter_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(id text, content text, similarity double precision, createdat timestamp without time zone)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    message.id,
    message.content,
    1 - (message.embedding <=> query_embedding) as similarity,
    message."createdAt"
  FROM message
  WHERE 1 - (message.embedding <=> query_embedding) > (match_threshold - 0.15) -- Lower threshold by default (allow looser semantic matches)
  AND message.embedding IS NOT NULL
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id)
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids))
  AND (filter_message_types IS NULL OR message."messageType" = ANY(filter_message_types))
  AND (filter_date_from IS NULL OR message."createdAt" >= filter_date_from)
  AND (filter_date_to IS NULL OR message."createdAt" <= filter_date_to)
  ORDER BY 
    message."createdAt" DESC
  LIMIT match_count;
END;
$function$;

