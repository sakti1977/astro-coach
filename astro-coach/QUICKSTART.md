# Quick Start: Setting Up Authentication

This guide will help you set up authentication and cloud storage for Astro Coach in under 10 minutes.

## Prerequisites

- A Supabase account (free tier available at https://supabase.com)

## Step-by-Step Setup

### 1. Create Supabase Project (2 minutes)

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in:
   - **Name**: `astro-coach`
   - **Database Password**: Use a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait for provisioning (~1-2 minutes)

### 2. Set Up Database (2 minutes)

1. In your Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` in this repo
4. Copy all contents and paste into the SQL editor
5. Click **"Run"** or press `Cmd/Ctrl + Enter`
6. You should see "Success. No rows returned" ✓

### 3. Get Your API Keys (1 minute)

1. In Supabase dashboard, go to **Settings** → **API** (left sidebar)
2. You'll see:
   - **Project URL** (starts with `https://`)
   - **anon/public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`)
3. Keep this page open - you'll need these values

### 4. Configure Environment (2 minutes)

1. In the project root, copy the example file:
   ```bash
   cp astro-coach/.env.local.example astro-coach/.env.local
   ```

2. Open `astro-coach/.env.local` and replace:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

   With your actual values from Step 3.

3. The `NEXTAUTH_SECRET` is already generated - leave it as is.

### 5. Start the Application (1 minute)

```bash
cd astro-coach
npm install  # If you haven't already
npm run dev
```

Open http://localhost:3000

### 6. Test Authentication (2 minutes)

1. Click **"Sign in"** in the top right
2. Click **"Sign up"** at the bottom
3. Enter:
   - Email: your-email@example.com
   - Password: at least 6 characters
4. Click **"Create Account"**
5. You should be redirected to the home page with your email shown

**Verify in Supabase**:
1. Go to Supabase dashboard → **Authentication** → **Users**
2. You should see your newly created user ✓

## You're Done! 🎉

Your authentication system is now fully configured:

- ✅ Users can sign up and sign in
- ✅ User data is stored in Supabase
- ✅ Data syncs automatically across devices
- ✅ Row-level security protects user data

## Next Steps

### Test Multi-Device Sync

1. Calculate your birth chart on one device
2. Sign out
3. Sign in on another device (or browser)
4. Your chart should load automatically

### Optional: Enable Email Verification

1. In Supabase dashboard → **Authentication** → **Providers**
2. Click **"Email"**
3. Toggle **"Confirm email"** ON
4. Customize email templates if desired

### Optional: Add Social Login (Google, GitHub, etc.)

1. In Supabase dashboard → **Authentication** → **Providers**
2. Enable your desired provider (e.g., Google)
3. Follow provider-specific setup instructions
4. Update `lib/auth.ts` to add the provider

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env.local` values
- Ensure no extra spaces or quotes
- Restart `npm run dev` after changes

### Can't create account
- Check Supabase project is running (not paused)
- Verify email format is valid
- Check browser console for specific errors

### Data not syncing
- Verify you're signed in (email shown in header)
- Check browser console for errors
- Review Supabase dashboard → **Logs** → **Database**

## Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Add environment variables in your platform's settings
2. Update `NEXTAUTH_URL` to your production domain:
   ```
   NEXTAUTH_URL=https://your-domain.com
   ```
3. Keep the same Supabase credentials (or create a separate production project)

## Need Help?

- 📖 Full documentation: `AUTHENTICATION.md`
- 🗄️ Supabase setup guide: `supabase/README.md`
- 🐛 Issues: Open a GitHub issue

---

**Security Note**: Never commit `.env.local` to version control. It's already in `.gitignore`.
