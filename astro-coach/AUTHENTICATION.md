# Authentication & User Data Storage

This document explains the authentication system and user data storage implementation for Astro Coach.

## Overview

The application now includes:
- **Authentication**: Email/password authentication using NextAuth.js
- **Database**: Supabase PostgreSQL for persistent user data storage
- **Sync**: Automatic synchronization between local storage and Supabase
- **Security**: Row-level security policies to protect user data

## Architecture

### Authentication Flow

1. User signs up or signs in via `/auth/signin`
2. NextAuth.js validates credentials against Supabase Auth
3. Session is created with JWT tokens
4. User data automatically syncs from Supabase to local storage
5. All updates are synced back to Supabase

### Data Storage Layers

1. **localStorage**: User profile (birth data, chart, dashas, validation, goals, habits, chat history, coaching)
2. **IndexedDB**: Coaching observations (larger, structured data)
3. **Supabase**: Persistent cloud storage for both profile and observations

### Sync Strategy

- **On Login**: Data syncs FROM Supabase TO local storage
- **On Data Change**: Data syncs FROM local storage TO Supabase
- **Conflict Resolution**: Server data takes precedence (last-write-wins)

## Setup Instructions

### 1. Install Dependencies

Already installed:
```bash
npm install next-auth @supabase/supabase-js
```

### 2. Set Up Supabase

Follow the detailed guide in `supabase/README.md`:

1. Create a Supabase project at https://supabase.com
2. Run the SQL migration from `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and API keys
4. Update `.env.local` with your credentials

### 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=wB4uLfZ5ewiY0Pt0Ghwe4bleLH6KK8OmQpO5tO9cOyg=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Test Authentication

```bash
npm run dev
```

Navigate to http://localhost:3000/auth/signin and create an account.

## Usage

### Authentication Components

#### Sign In/Sign Up Page

Located at `/auth/signin`, this page handles both sign-in and sign-up flows:

```tsx
import { signIn } from "next-auth/react"

await signIn("credentials", {
  email: "user@example.com",
  password: "password",
  mode: "signin", // or "signup"
})
```

#### Protected Routes

Wrap any page that requires authentication:

```tsx
import ProtectedRoute from "@/components/ProtectedRoute"

export default function MyPage() {
  return (
    <ProtectedRoute>
      {/* Your protected content */}
    </ProtectedRoute>
  )
}
```

#### Session Management

Access user session data:

```tsx
import { useSession, signOut } from "next-auth/react"

function MyComponent() {
  const { data: session } = useSession()

  if (session) {
    return (
      <div>
        <p>Logged in as {session.user.email}</p>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    )
  }

  return <p>Not logged in</p>
}
```

### Data Synchronization

#### Auto Sync Hook

The `useDataSync` hook automatically syncs data on login:

```tsx
import { useDataSync } from "@/lib/useDataSync"

function MyComponent() {
  const { syncToServer } = useDataSync()

  // Manually trigger sync
  await syncToServer()
}
```

#### Storage Adapter

The storage adapter handles all sync operations:

```tsx
import { storage } from "@/lib/storage-supabase"

// Manually sync to server
await storage.syncToServer(userId)

// Manually sync from server
await storage.syncFromServer(userId)
```

## Database Schema

### user_profiles Table

Stores all user profile data in JSONB columns for flexibility:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| birth_data | JSONB | Birth information |
| chart | JSONB | Calculated natal chart |
| dashas | JSONB | Dasha periods |
| validation | JSONB | Validation questions/results |
| goals | JSONB | User goals |
| habits | JSONB | Habit tracking |
| chat_history | JSONB | AI chat history |
| coaching | JSONB | Coaching metadata |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### coaching_observations Table

Stores detailed coaching observations:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| observation_id | TEXT | Client-side ID |
| timestamp | TIMESTAMP | Observation time |
| text | TEXT | Observation content |
| category | TEXT | Category (behavior/emotion/pattern/goal/block) |
| exchange_index | INTEGER | Session exchange number |
| created_at | TIMESTAMP | Creation time |

## Security

### Row-Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access their own data
- All operations (SELECT, INSERT, UPDATE, DELETE) are restricted to the authenticated user
- Server-side code can bypass RLS using the service role key

### API Key Security

- **Anon Key**: Safe for client-side use, protected by RLS
- **Service Role Key**: Server-side only, bypasses RLS - never expose to client

### Authentication Security

- Passwords are hashed by Supabase Auth
- JWT tokens are used for session management
- Tokens are stored securely in HTTP-only cookies (via NextAuth)

## Troubleshooting

### "Invalid API key" Error

- Verify environment variables are set correctly
- Restart development server after changing `.env.local`
- Check that you're using the anon key for client-side code

### Data Not Syncing

- Check browser console for errors
- Verify user is authenticated (`session.user.id` exists)
- Check Supabase logs in dashboard
- Ensure RLS policies are correctly configured

### Authentication Failing

- Verify Supabase project is running
- Check that email authentication is enabled in Supabase
- Verify NEXTAUTH_SECRET is set
- Check network tab for API errors

## Migration from Local Storage

The system is designed for seamless migration:

1. **First-time users**: Sign up → data saves to Supabase
2. **Existing users**: Sign up → local data remains → manually recalculate chart → data syncs to Supabase
3. **Multi-device**: Log in on new device → data syncs from Supabase

### Manual Migration

If you have existing local data and want to preserve it:

1. Sign up for an account
2. Your existing localStorage data remains intact
3. The next time you save data (e.g., recalculate chart), it syncs to Supabase
4. From then on, all devices sync through Supabase

## Development vs Production

### Development

- Use `.env.local` for local configuration
- Supabase project can be in development mode
- NEXTAUTH_URL should be `http://localhost:3000`

### Production

- Set environment variables in your deployment platform (Vercel, Netlify, etc.)
- Use production Supabase project
- Update NEXTAUTH_URL to your production domain
- Enable email confirmation in Supabase Auth settings

## Future Enhancements

Potential improvements:

- OAuth providers (Google, GitHub, etc.)
- Email verification on signup
- Password reset flow
- Account deletion
- Export user data (GDPR compliance)
- Real-time sync using Supabase Realtime
- Offline support with sync queue

## Support

For issues:
- Check this documentation first
- Review `supabase/README.md` for Supabase-specific setup
- Check browser console and network tab
- Review Supabase dashboard logs
- Open an issue on GitHub
