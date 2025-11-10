-- AI Study Companion Database Schema
-- Run this in Supabase SQL Editor after creating your project

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Conversations table (stores messages as JSONB array)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Vector embeddings table (for RAG context retrieval)
CREATE TABLE IF NOT EXISTS public.conversation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversation_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS for embeddings (needed for serverless functions)
CREATE POLICY "Service role can manage all embeddings" ON public.conversation_embeddings
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.conversation_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_embeddings_conversation_id ON public.conversation_embeddings(conversation_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to search similar conversation chunks
CREATE OR REPLACE FUNCTION match_conversation_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  exclude_conversation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  conversation_id uuid,
  conversation_title text,
  content text,
  similarity float
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id as conversation_id,
    c.title as conversation_title,
    ce.content,
    1 - (ce.embedding <=> query_embedding) as similarity
  FROM conversation_embeddings ce
  JOIN conversations c ON c.id = ce.conversation_id
  WHERE 
    (exclude_conversation_id IS NULL OR ce.conversation_id != exclude_conversation_id)
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION match_conversation_chunks TO authenticated, service_role;

-- User preferences table for avatar customization
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_customization JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

