# Deploying to Vercel - Quick Guide

## Step 1: Set up Supabase

1. Create a Supabase project at https://supabase.com
2. Run the SQL schema:
   - Go to SQL Editor
   - Copy contents of `supabase/schema-updated.sql`
   - Execute the SQL
3. Get your credentials from **Settings → API**:
   - Project URL
   - Anon/public key
   - Service role key

## Step 2: Push to GitHub

```bash
git add -A
git commit -m "Configure Vite for multiple HTML pages"
git push
```

## Step 3: Deploy to Vercel

1. Go to https://vercel.com
2. Import your GitHub repository
3. Vercel will auto-detect the Vite framework

## Step 4: Add Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

### Frontend Variables (starts with VITE_)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...your-anon-key
```

### Backend Variables (for serverless functions)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...your-service-role-key
OPENAI_API_KEY=sk-...your-openai-key
SPEECH_KEY=your-azure-speech-key
SPEECH_REGION=eastus
```

**Important:** 
- Frontend vars need `VITE_` prefix
- Service role key is different from anon key (has more permissions)
- Add all variables to "Production", "Preview", and "Development" environments

## Step 5: Redeploy

After adding environment variables, redeploy:
- Go to Deployments tab
- Click the three dots on the latest deployment
- Click "Redeploy"

## Step 6: Test

1. Go to `your-site.vercel.app/auth.html`
2. Sign up for an account
3. Verify your email
4. Log in and start chatting!

## Troubleshooting

### 404 on auth.html
- Make sure `vite.config.js` exists with multi-page config
- Redeploy after adding the config file

### "Missing Supabase environment variables"
- Check that VITE_ prefixed variables are set in Vercel
- They must be available at build time
- Redeploy after adding variables

### API calls fail
- Check serverless function logs in Vercel dashboard
- Make sure backend env vars (without VITE_) are set
- Verify SUPABASE_SERVICE_KEY is the service role key, not anon key

### Supabase RLS errors
- Make sure you ran the full schema from `schema-updated.sql`
- Check that the `match_conversation_chunks` function exists
- Verify RLS policies are created

