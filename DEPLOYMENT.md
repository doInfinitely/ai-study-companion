# Deployment Guide - AI Study Companion

This guide covers deploying the AI Study Companion to Vercel with Supabase for authentication and database.

## Architecture Overview

- **Frontend**: Vite app hosted on Vercel
- **Backend**: Express API converted to Vercel serverless functions
- **Database**: Supabase PostgreSQL with pgvector extension
- **Authentication**: Supabase Auth (email/password, OAuth providers)
- **Storage**: Supabase Storage for audio uploads
- **Vector Store**: Supabase pgvector for conversation embeddings

## Prerequisites

- Vercel account
- Supabase account
- Azure Speech Services key (for TTS)
- OpenAI API key

## Step 1: Set Up Supabase

### 1.1 Create a New Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Choose organization and name your project (e.g., "ai-study-companion")
4. Set a strong database password (save this!)
5. Choose a region close to your users
6. Wait for the project to be created (~2 minutes)

### 1.2 Enable pgvector Extension

1. In Supabase dashboard, go to **SQL Editor**
2. Run this SQL:

```sql
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.3 Create Database Schema

Run the SQL from `supabase/schema.sql` in the SQL Editor:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
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

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE conversations.id = messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

-- Vector embeddings table (for RAG context retrieval)
CREATE TABLE public.conversation_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversation_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embeddings" ON public.conversation_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE conversations.id = conversation_embeddings.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

-- Index for fast similarity search
CREATE INDEX ON public.conversation_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function to search similar conversations
CREATE OR REPLACE FUNCTION match_conversations(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    conversation_embeddings.id,
    conversation_embeddings.conversation_id,
    conversation_embeddings.content,
    1 - (conversation_embeddings.embedding <=> query_embedding) as similarity,
    conversation_embeddings.metadata
  FROM conversation_embeddings
  INNER JOIN conversations ON conversations.id = conversation_embeddings.conversation_id
  WHERE 
    (user_id_filter IS NULL OR conversations.user_id = user_id_filter)
    AND 1 - (conversation_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY conversation_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.4 Configure Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable desired providers:
   - **Email**: Already enabled (password-based login)
   - **Google**: Optional (add OAuth credentials)
   - **GitHub**: Optional (add OAuth credentials)
3. Configure email templates in **Authentication** → **Email Templates**
4. Set site URL in **Authentication** → **URL Configuration**:
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs: `https://your-domain.vercel.app/**`

### 1.5 Get Supabase Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (safe for client-side)
   - **service_role key**: `eyJhbGc...` (keep secret, server-side only!)

## Step 2: Configure Environment Variables

### 2.1 Local Development

Create `.env.local`:

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Server-side only (DO NOT prefix with VITE_)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OpenAI
OPENAI_API_KEY=sk-...

# Azure Speech
SPEECH_KEY=your-azure-speech-key
SPEECH_REGION=eastus
```

### 2.2 Vercel Environment Variables

Add these in Vercel dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
SPEECH_KEY=your-azure-speech-key
SPEECH_REGION=eastus
```

Make sure to set them for **Production**, **Preview**, and **Development** environments.

## Step 3: Convert Express to Vercel Serverless Functions

Create `api/` directory structure:

```
api/
├── chat.js           # Chat endpoints
├── conversations.js  # Conversation CRUD
├── transcribe.js     # Whisper transcription
├── emotion.js        # Emotion detection
├── tts.js            # Text-to-speech
└── _lib/
    ├── supabase.js   # Supabase client
    └── vector.js     # Vector store helpers
```

## Step 4: Update Frontend for Authentication

Add login/signup UI and Supabase client initialization.

## Step 5: Deploy to Vercel

### 5.1 Install Vercel CLI (optional)

```bash
npm install -g vercel
```

### 5.2 Deploy via GitHub

1. Push code to GitHub repository
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add environment variables (see Step 2.2)
6. Click **Deploy**

### 5.3 Deploy via CLI

```bash
vercel --prod
```

## Step 6: Post-Deployment

### 6.1 Update Supabase Site URL

1. Go to Supabase dashboard → **Authentication** → **URL Configuration**
2. Set Site URL to your Vercel domain: `https://your-app.vercel.app`
3. Add redirect URLs: `https://your-app.vercel.app/**`

### 6.2 Test Authentication

1. Visit your deployed app
2. Sign up with a new account
3. Verify email works
4. Test login/logout

### 6.3 Monitor Logs

- **Vercel logs**: Vercel dashboard → Deployments → Select deployment → Logs
- **Supabase logs**: Supabase dashboard → Database → Logs

## Security Checklist

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Service role key only used server-side
- ✅ Anon key used for client-side operations
- ✅ CORS configured properly
- ✅ Environment variables set correctly
- ✅ API rate limiting (consider Vercel Edge Config)
- ✅ Input validation on all endpoints

## Cost Estimates

### Supabase (Free Tier)
- 500 MB database storage
- 1 GB file storage
- 50,000 monthly active users
- 2 GB bandwidth

### Vercel (Hobby - Free)
- 100 GB bandwidth
- Unlimited deployments
- Serverless function execution: 100 GB-hours

### OpenAI (Pay-as-you-go)
- GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Embeddings: ~$0.02 per 1M tokens
- Whisper: ~$0.006 per minute

### Azure Speech Services (Free Tier)
- 500,000 characters per month (TTS)
- Then ~$16 per 1M characters

## Scaling Considerations

### When you outgrow free tiers:

1. **Database**: Upgrade Supabase to Pro ($25/month)
2. **Hosting**: Upgrade Vercel to Pro ($20/month)
3. **Optimize costs**:
   - Cache embeddings to reduce OpenAI API calls
   - Use Redis for session storage
   - Implement rate limiting per user
   - Compress audio uploads

## Troubleshooting

### "Invalid API key" errors
- Check environment variables are set correctly in Vercel
- Ensure no trailing spaces in keys

### "User not authenticated" errors
- Verify RLS policies are correct
- Check JWT token is being passed in headers

### Vector search not working
- Ensure pgvector extension is enabled
- Check embeddings are being created properly
- Verify similarity threshold isn't too high

### TTS not working on Vercel
- Check Azure credentials
- Verify serverless function timeout (max 10s on Hobby, 60s on Pro)

## Next Steps

1. Add email notifications (Supabase can send transactional emails)
2. Implement social OAuth (Google, GitHub)
3. Add analytics (Vercel Analytics, PostHog)
4. Set up monitoring (Sentry, LogRocket)
5. Add payment processing (Stripe) for premium features
6. Implement session recording review feature

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Issues**: File bugs in your GitHub repo

