# Supabase Setup Guide

This guide explains how to set up Supabase for the Astro Coach application.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the project details:
   - Project name: `astro-coach`
   - Database password: Generate a strong password
   - Region: Choose the region closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (1-2 minutes)

## Step 2: Run Database Migrations

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click "Run" to execute the migration

This will create:
- `user_profiles` table with JSONB columns for flexible data storage
- `coaching_observations` table for coaching session data
- Row Level Security (RLS) policies to ensure users can only access their own data
- Indexes for better query performance

## Step 3: Configure Environment Variables

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - Project URL
   - anon/public key
   - service_role key (keep this secret!)

3. Update `.env.local` in your project root:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=wB4uLfZ5ewiY0Pt0Ghwe4bleLH6KK8OmQpO5tO9cOyg=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 4: Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Make sure **Email** is enabled
3. Configure email templates (optional):
   - Go to **Authentication** > **Email Templates**
   - Customize the confirmation and password reset emails

## Step 5: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/auth/signin
3. Create a new account
4. Verify that the user is created in Supabase:
   - Go to **Authentication** > **Users** in Supabase dashboard
   - You should see your newly created user

## Optional: Set Up Custom Domain

For production deployments:

1. In Supabase dashboard, go to **Settings** > **Custom Domains**
2. Follow the instructions to set up a custom domain
3. Update `NEXT_PUBLIC_SUPABASE_URL` in your production environment variables

## Security Notes

- Never commit `.env.local` to version control
- Use environment variables in your deployment platform (Vercel, Netlify, etc.)
- The `service_role` key bypasses Row Level Security - only use it in server-side code
- The `anon` key is safe to use in client-side code - it's protected by RLS policies

## Database Schema

### user_profiles

Stores all user profile data including birth charts, validation results, goals, and habits.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users (unique) |
| birth_data | JSONB | Birth date, time, location |
| chart | JSONB | Calculated natal chart |
| dashas | JSONB | Dasha periods |
| validation | JSONB | Validation questions and results |
| goals | JSONB | User goals |
| habits | JSONB | Habit tracking data |
| chat_history | JSONB | AI coaching chat history |
| coaching | JSONB | Coaching profile and metadata |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### coaching_observations

Stores detailed coaching observations for analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| observation_id | TEXT | Client-generated observation ID |
| timestamp | TIMESTAMP | When observation was made |
| text | TEXT | Observation content |
| category | TEXT | Observation category |
| exchange_index | INTEGER | Session exchange number |
| created_at | TIMESTAMP | Record creation time |

## Troubleshooting

### "Invalid API key" error

- Check that your environment variables are correct
- Make sure you're using the `anon` key for client-side code
- Restart your development server after changing `.env.local`

### "Permission denied" errors

- Verify that RLS policies are set up correctly
- Check that users are properly authenticated
- Review the SQL migration was executed successfully

### Data not syncing

- Check browser console for errors
- Verify network requests in browser DevTools
- Check Supabase logs in the dashboard under **Logs**

## Migration from localStorage

The app will automatically sync data from localStorage to Supabase when a user first logs in. The migration happens transparently:

1. User creates account or logs in
2. `useDataSync` hook loads data from Supabase
3. If no server data exists, local data remains active
4. When user saves new data, it syncs to Supabase
5. On subsequent logins, data loads from Supabase

## Support

For issues with Supabase setup, consult:
- Supabase Documentation: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
