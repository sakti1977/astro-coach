# Jyotish Coach — Vedic Astrology Personal Coach

A personal AI coaching system grounded in Vedic Jyotish astrology. Your chart is calculated with Swiss Ephemeris precision, validated against your real life, and translated into practical guidance.

## Features

- **Accurate Chart Calculation**: Swiss Ephemeris + Lahiri ayanamsha
- **Life Validation**: Yes/no questions calibrate accuracy
- **AI Coaching**: Behavioral guidance, not superstition
- **User Authentication**: Secure login with data sync across devices
- **Cloud Storage**: Supabase-powered persistent storage
- **Multi-Device Sync**: Access your data from anywhere

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Authentication (Optional but Recommended)

For multi-device access and cloud storage:

1. **Quick Setup**: Follow [QUICKSTART.md](./QUICKSTART.md) (10 minutes)
2. **Detailed Guide**: See [AUTHENTICATION.md](./AUTHENTICATION.md)
3. **Database Setup**: Check [supabase/README.md](./supabase/README.md)

**Or skip authentication** and use local storage only (data stays on one device).

### 3. Start the Python Service

The application requires a Python service for ephemeris calculations:

```bash
./start.sh
```

Or manually:

```bash
cd python-service
# Prefer the project venv (kerykeion==5.12.9 is pinned in requirements.txt)
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

Cloud Agent environments auto-start this service via `.cursor/environment.json` (`start`: `./start.sh`, plus tmux `ephemeris-uvicorn`). Next.js defaults `EPHEMERIS_SERVICE_URL` to `http://localhost:8000`; leave the shared secret unset for local/Cloud Agent. **Production one-host** (Docker Compose / Fly / Render / one Railway service) **requires** `EPHEMERIS_SHARED_SECRET` — see the repo-root [README One host](../README.md#one-host). Do not split Next onto Vercel and Python onto Railway.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
astro-coach/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── chart/             # Chart display
│   ├── dasha/             # Dasha timeline
│   ├── coach/             # AI coaching interface
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utility functions
│   ├── auth.ts           # NextAuth configuration
│   ├── supabase.ts       # Supabase client
│   ├── storage-supabase.ts # Storage with sync
│   └── profile.ts        # User profile management
├── python-service/        # Ephemeris calculation service
├── supabase/             # Database migrations
│   ├── migrations/       # SQL schema files
│   └── README.md         # Supabase setup guide
├── AUTHENTICATION.md      # Auth system documentation
├── QUICKSTART.md         # Quick setup guide
└── README.md             # This file
```

## Architecture

### Frontend (Next.js 16 + React 19)

- **App Router**: Modern Next.js routing
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **IndexedDB + localStorage**: Client-side cache; cloud copy is pulled/pushed via `/api/sync`

The browser never talks to the Python service or writes user rows to Supabase
directly. Chart calculation, dasha, transits, muhurta, and all LLM routes go
through Next.js API handlers (rate-limited, session-gated except guest chart/geocode).

### Backend Services

- **Python Service**: Swiss Ephemeris calculations (FastAPI, long-running).
  Deployed endpoints require `EPHEMERIS_SHARED_SECRET` (including Docker
  networks). Not suitable for Vercel serverless.
- **Supabase**: Auth identities + PostgreSQL. App writes use the service-role
  key on the server, scoped to the NextAuth `user.id`.
- **NextAuth.js**: Session management (JWT)

### Data Flow

1. User enters birth data (guest chart calc is allowed; coaching surfaces need sign-in)
2. Next.js `/api/chart` calls the Python service
3. Chart is stored on-device and, when signed in, synced through `/api/sync`
4. Coaching uses Claude with the **stored** natal chart as the source of truth
5. Habits/goals feed back into the coaching prompt so the tracker and the coach share state

## Authentication & Storage

The app supports two modes:

### With Authentication (Recommended)
- Create account with email/password
- Data stored in Supabase PostgreSQL
- Automatic sync across all devices
- Session-verified `/api/sync` (service-role, scoped to your user id)

### Without Authentication
- Data stored locally (localStorage + IndexedDB)
- Works offline
- Limited to single device
- No account required

See [AUTHENTICATION.md](./AUTHENTICATION.md) for setup instructions.

## Environment Variables

Required for authentication (optional otherwise):

```bash
# Claude
ANTHROPIC_API_KEY=sk-ant-...

# Ephemeris
EPHEMERIS_SERVICE_URL=http://localhost:8000
EPHEMERIS_SHARED_SECRET=your-shared-secret-here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional but recommended in production for distributed rate limiting
UPSTASH_REDIS_REST_URL=https://your-upstash-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token

# Push / cron
CRON_SECRET=your-cron-secret-here
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_SUBJECT=mailto:you@example.com
```

See `.env.example` for template.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **Auth**: NextAuth.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: IndexedDB (idb) + localStorage
- **AI**: Anthropic Claude API
- **Ephemeris**: Swiss Ephemeris (Python/FastAPI)
- **Deployment**: one VM/container (Fly / Render / VPS / Railway-only). Not Vercel+Railway.

## Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub repository](https://github.com/vercel/next.js)

### Vedic Astrology Resources

- Swiss Ephemeris: https://www.astro.com/swisseph/
- Lahiri Ayanamsha: Government of India standard
- Vimshottari Dasha: Classical timing system

## Deploy (one host)

Vercel cannot run Swiss Ephemeris. Paying Vercel **and** Railway is how you get “Ephemeris service is not running” when the sidecar sleeps.

Run Next + uvicorn on **one** machine. Full steps, env list, `docker compose up`, Fly/Render/VPS/Railway-only, and what to delete: **[One host](../README.md#one-host)** in the repo root README.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.
