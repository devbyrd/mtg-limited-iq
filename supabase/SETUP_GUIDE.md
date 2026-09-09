# Supabase Cloud Authentication & Multi-Device Sync Setup Guide

MTG Limited IQ uses Supabase for free, serverless authentication and offline-first cloud synchronization.

---

## 1. Create a Free Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create an account.
2. Click **New project**, select your organization, and choose a project name (e.g. `mtg-limited-iq`).
3. Set a database password and choose your nearest region.
4. Wait ~2 minutes for the database to provision.

---

## 2. Run the Database Migration Script

1. In your Supabase project dashboard, navigate to the **SQL Editor** tab (left sidebar icon with `>_`).
2. Click **New query**.
3. Copy the entire content of [`supabase/schema.sql`](./schema.sql) and paste it into the editor.
4. Click **Run** (or `Cmd/Ctrl + Enter`).
5. You should see `Success. No rows returned`.

### What This Created:
- `public.profiles`: Stores user display names, avatars, and timestamps.
- `public.user_stats`: Stores user XP, levels, quiz streaks, missed cards, and set mastery telemetry.
- `public.card_evaluations`: Stores individual card grades, pick priorities, and notes with unique constraint `(user_id, set_code, card_name)`.
- **Row-Level Security (RLS)**: Enforces strict data isolation (`auth.uid() = user_id`) so players can never read or write other players' evaluations.
- **Triggers**: Automatic `handle_new_user()` trigger initializes profile and stats rows upon auth signup, and `handle_updated_at()` updates timestamps.

---

## 3. Configure Local Environment Variables

1. In your Supabase dashboard, go to **Project Settings** (gear icon) -> **API**.
2. Find:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public` key (e.g., `eyJhbGciOi...`)
3. In your local project repository, create a `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Paste your values into `.env`:
   ```env
   VITE_SUPABASE_URL=https://xyzcompany.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. Restart your local development server (`npm run dev`). The Navbar sync status will switch from `Local 💾` to `Synced ✓`!

---

## 4. Enable Authentication Providers

In the Supabase dashboard, navigate to **Authentication** -> **Providers**.

### A. Email & Magic Link (Enabled by default)
- Under **Email**, toggle **Enable Email provider** ON.
- You can enable or disable **Confirm email** depending on whether you want instant signups or required verification links.

### B. Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. In Authorized Redirect URIs, add your Supabase redirect URL:
   `https://<your-project-id>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into Supabase -> **Authentication** -> **Providers** -> **Google**.
5. Toggle Google provider **ON** and save.

### C. Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a **New Application** -> Go to **OAuth2**.
3. Under Redirects, add:
   `https://<your-project-id>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into Supabase -> **Authentication** -> **Providers** -> **Discord**.
5. Toggle Discord provider **ON** and save.

### D. Apple / GitHub OAuth (Optional)
- Follow the same callback URL pattern: `https://<your-project-id>.supabase.co/auth/v1/callback`.

---

## 5. Production Deployment (Vercel / Cloudflare Pages / Netlify)

When deploying the frontend to production:
1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your hosting platform's Environment Variables.
2. In Supabase -> **Authentication** -> **URL Configuration**:
   - Set **Site URL** to your production domain (e.g. `https://mtg-limited-iq.vercel.app`).
   - Add `https://mtg-limited-iq.vercel.app/**` to **Redirect URLs**.
