-- Enable vector extension (should be enabled already but good practice)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to message table
ALTER TABLE public.message ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS message_embedding_idx ON public.message USING hnsw ("embedding" vector_cosine_ops);

-- Function to match messages by embedding similarity
CREATE OR REPLACE FUNCTION match_messages (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text DEFAULT NULL,
  filter_chat_ids text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    message.id,
    message.content,
    1 - (message.embedding <=> query_embedding) as similarity
  FROM message
  WHERE 1 - (message.embedding <=> query_embedding) > match_threshold
  AND (filter_user_id IS NULL OR message."userId" = filter_user_id) -- Optional user filter
  AND (filter_chat_ids IS NULL OR message."chatId" = ANY(filter_chat_ids)) -- Optional chat filter
  ORDER BY message.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

