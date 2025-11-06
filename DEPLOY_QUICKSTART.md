# Quick Deployment Guide

Get your AI Study Companion deployed in 15 minutes!

## Prerequisites

- GitHub account
- Vercel account (free)
- Supabase account (free)
- OpenAI API key
- Azure Speech Services key

## Step 1: Set Up Supabase (5 minutes)

1. **Create project** at https://supabase.com
   - Click "New Project"
   - Name it (e.g., "ai-study-companion")
   - Set database password (save it!)
   - Choose region

2. **Run database setup**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/schema.sql`
   - Paste and run it

3. **Get your credentials**
   - Go to Settings → API
   - Copy:
     - Project URL (e.g., `https://xxxxx.supabase.co`)
     - `anon` public key (starts with `eyJhbGc...`)
     - `service_role` key (starts with `eyJhbGc...`)

4. **Configure authentication**
   - Go to Authentication → Providers
   - Email is already enabled ✓
   - Optional: Enable Google or GitHub OAuth

## Step 2: Deploy to Vercel (5 minutes)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ai-study-companion.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your repo
   - Click "Import"

3. **Add environment variables** (click "Add" for each):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   OPENAI_API_KEY=sk-...
   SPEECH_KEY=your-azure-key
   SPEECH_REGION=eastus
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live!

## Step 3: Final Configuration (3 minutes)

1. **Update Supabase redirect URL**
   - Copy your Vercel URL (e.g., `https://your-app.vercel.app`)
   - Go to Supabase → Authentication → URL Configuration
   - Set **Site URL**: `https://your-app.vercel.app`
   - Set **Redirect URLs**: `https://your-app.vercel.app/**`

2. **Test it out**
   - Visit your Vercel URL
   - You should see the auth page
   - Sign up with email
   - Check your email for verification
   - Sign in and start chatting!

## Step 4: Custom Domain (Optional)

1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records (Vercel will show you what to add)
4. Wait for DNS propagation (~10 minutes)
5. Update Supabase Site URL to your custom domain

## Troubleshooting

### "Missing Supabase credentials" error
- Check environment variables are set in Vercel
- Make sure no trailing spaces in values
- Redeploy after adding variables

### Email verification not working
- Check Supabase email settings
- Verify redirect URLs are correct
- Check spam folder

### TTS not working
- Verify Azure credentials
- Check SPEECH_KEY and SPEECH_REGION are correct
- Note: Free tier has limits

### Vector search not finding context
- Make sure conversations exist in database
- Check OpenAI API key is valid
- Verify embeddings are being created (check Supabase logs)

## What's Next?

- 🎨 Customize the Live2D avatar parameters
- 📧 Configure email templates in Supabase
- 🔐 Set up OAuth providers (Google, GitHub)
- 📊 Add analytics with Vercel Analytics
- 💰 Add Stripe for premium features
- 🎯 Implement session tracking and goals

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Issues**: Create an issue in your GitHub repo

---

**🎉 Congratulations!** Your AI Study Companion is now live and ready to help students achieve their learning goals!

