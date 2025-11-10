# Local Development Setup

## Prerequisites
- Node.js 18+ installed
- A Supabase account and project

## Step 1: Set up Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to finish setting up (~2 minutes)
3. Go to **SQL Editor** and run the schema:
   - Copy the contents of `supabase/schema-updated.sql`
   - Paste and execute in SQL Editor
4. Get your credentials from **Settings → API**:
   - Project URL (looks like: `https://xxxxx.supabase.co`)
   - Anon/public key (starts with `eyJ...`)

## Step 2: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Create a `.env` file for backend:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Azure Speech (for TTS)
SPEECH_KEY=your-azure-speech-key
SPEECH_REGION=eastus

# Supabase (for backend)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Start Development Server

```bash
npm start
```

This runs both:
- Backend server on `http://localhost:8787`
- Frontend dev server on `http://localhost:5173`

## Step 5: Create Your First Account

1. Go to `http://localhost:5173/auth.html`
2. Sign up with email/password
3. Check your email for verification link
4. Click the verification link
5. You'll be redirected to the app at `http://localhost:5173/`

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists with correct values
- Restart the dev server after creating `.env.local`

### "Failed to fetch" on transcription
- Make sure the backend server is running (`npm run server`)
- Check that you have `OPENAI_API_KEY` in `.env`

### Logout button doesn't work
- Make sure `.env.local` has valid Supabase credentials
- Open browser console to see any errors
- Try clearing browser cache and reloading

### Authentication not working
- Run the SQL schema in Supabase SQL Editor
- Make sure you're using the correct Anon Key (not Service Role Key) in `.env.local`
- Check Supabase logs in dashboard for any errors

