# Astro Coach — Vedic Astrology Personal Coach

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
uvicorn main:app --port 8000
```

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
- **IndexedDB + localStorage**: Client-side caching

### Backend Services

- **Python Service**: Swiss Ephemeris calculations (FastAPI)
- **Supabase**: Authentication + PostgreSQL database
- **NextAuth.js**: Session management

### Data Flow

1. User enters birth data
2. Frontend calls Python service for chart calculation
3. Chart data stored locally and synced to Supabase
4. AI coaching uses Claude API with chart context
5. All user data syncs across devices via Supabase

## Authentication & Storage

The app supports two modes:

### With Authentication (Recommended)
- Create account with email/password
- Data stored in Supabase PostgreSQL
- Automatic sync across all devices
- Secure with row-level security

### Without Authentication
- Data stored locally (localStorage + IndexedDB)
- Works offline
- Limited to single device
- No account required

See [AUTHENTICATION.md](./AUTHENTICATION.md) for setup instructions.

## Environment Variables

Required for authentication (optional otherwise):

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

See `.env.local.example` for template.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **Auth**: NextAuth.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: IndexedDB (idb) + localStorage
- **AI**: Anthropic Claude API
- **Ephemeris**: Swiss Ephemeris (Python/FastAPI)
- **Deployment**: Vercel (recommended)

## Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub repository](https://github.com/vercel/next.js)

### Vedic Astrology Resources

- Swiss Ephemeris: https://www.astro.com/swisseph/
- Lahiri Ayanamsha: Government of India standard
- Vimshottari Dasha: Classical timing system

## Deploy on Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXTAUTH_URL` (your production URL)
   - `NEXTAUTH_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for details.

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
