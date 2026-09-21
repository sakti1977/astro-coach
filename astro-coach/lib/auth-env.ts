/**
 * NextAuth v4 reads NEXTAUTH_SECRET / NEXTAUTH_URL. Auth.js v5 and some
 * hosts set AUTH_SECRET / AUTH_URL instead. If those names are not
 * mirrored, JWT cookies, CSRF origin checks, withAuth, and API session
 * reads disagree — sign-in appears to work while every /api/* call 401s.
 */
export function resolveAuthEnv(): { secret: string | undefined; url: string | undefined } {
  if (!process.env.NEXTAUTH_SECRET && process.env.AUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
  }
  if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
    process.env.NEXTAUTH_URL = process.env.AUTH_URL;
  }
  return {
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL,
  };
}

resolveAuthEnv();
