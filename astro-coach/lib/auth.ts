import "@/lib/auth-env"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { NextAuthOptions, Session } from "next-auth"
import { JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabaseAdmin } from "@/lib/supabase-admin"

function createAuthSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // Per-request server client. The shared browser client in lib/supabase.ts
  // defaults to persistSession and is a process-wide singleton — on the
  // NextAuth route that leaks Auth sessions across concurrent sign-ins.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const DEFAULT_PROFILE = {
  birth_data: null,
  chart: null,
  dashas: null,
  validation: {
    questions: [],
    accuracyScore: 0,
    confirmedThemes: [],
    isValidated: false,
  },
  goals: [],
  habits: [],
  chat_history: [],
  coaching: {
    behaviorProfile: [],
    lastUpdated: new Date().toISOString(),
    phase: "gathering",
    exchangeCount: 0,
    planDelivered: false,
    tonePreference: "jyotish",
    includeReligiousSolutions: false,
    preferredLanguage: "en-IN",
  },
}

async function ensureProfile(userId: string, fallback?: SupabaseClient | null) {
  // Service-role client: the anon client here has no Supabase Auth session
  // (NextAuth holds the JWT), so RLS would reject this upsert unless we
  // just signed this user in on `fallback`.
  const client = supabaseAdmin ?? fallback
  if (!client) return
  const { error } = await client
    .from("user_profiles")
    .upsert(
      { user_id: userId, ...DEFAULT_PROFILE },
      { onConflict: "user_id", ignoreDuplicates: true }
    )
  if (error) console.error("Profile upsert error:", error)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:       { label: "Email",        type: "email" },
        password:    { label: "Password",     type: "password" },
        phone:       { label: "Phone",        type: "text" },
        otp:         { label: "OTP",          type: "text" },
        mode:        { label: "Mode",         type: "text" },
        // mode values:
        //   "signin"     — email + password sign-in
        //   "signup"     — email + password sign-up
        //   "phone-otp"  — phone OTP verified once on the server
      },
      async authorize(credentials: Record<string, string> | undefined) {
        const supabase = createAuthSupabase()
        if (!supabase) {
          throw new Error(
            "Authentication is not configured. Please set Supabase environment variables."
          )
        }
        if (!credentials?.mode) {
          throw new Error("Authentication mode is required")
        }

        // ── Phone OTP ────────────────────────────────────────────────────────
        if (credentials.mode === "phone-otp") {
          if (!credentials.phone || !credentials.otp) {
            throw new Error("Phone number and OTP are required for phone authentication")
          }

          const { data, error } = await supabase.auth.verifyOtp({
            phone: credentials.phone,
            token: credentials.otp,
            type: "sms",
          })

          const user = data.user
          if (error || !user) {
            throw new Error("Invalid or expired OTP session. Please try again.")
          }

          await ensureProfile(user.id, supabase)

          return {
            id: user.id,
            email: user.email ?? "",
            phone: user.phone ?? credentials.phone ?? "",
          }
        }

        // ── Email / Password ─────────────────────────────────────────────────
        if (!credentials.email || !credentials.password) {
          throw new Error("Email and password are required")
        }

        try {
          if (credentials.mode === "signup") {
            const { data: authData, error: signUpError } =
              await supabase.auth.signUp({
                email: credentials.email,
                password: credentials.password,
              })

            if (signUpError) throw signUpError

            // Supabase returns user:null when email confirmation is required
            // OR when the email is already registered (silent, to prevent enumeration)
            if (!authData.user) {
              throw new Error(
                "Account created — please check your email for a confirmation link. " +
                "If you already registered, try signing in instead."
              )
            }

            // user exists but hasn't confirmed email yet (confirmation enabled)
            if (!authData.session && authData.user.identities?.length === 0) {
              throw new Error(
                "This email is already registered. Please sign in or check your inbox for a confirmation email."
              )
            }

            await ensureProfile(authData.user.id, supabase)

            return {
              id: authData.user.id,
              email: authData.user.email!,
              phone: "",
            }
          }

          // mode === "signin"
          const { data: authData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password,
            })

          if (signInError) throw signInError
          if (!authData.user) throw new Error("Invalid credentials")

          await ensureProfile(authData.user.id, supabase)

          return {
            id: authData.user.id,
            email: authData.user.email!,
            phone: authData.user.phone ?? "",
          }
        } catch (error: unknown) {
          console.error("Auth error:", error)
          if (error instanceof Error) throw new Error(error.message)
          throw new Error("Authentication failed")
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error:  "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: { id: string; email: string; phone?: string } }) {
      if (user) {
        token.id    = user.id
        token.phone = user.phone ?? ""
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id    = token.id    as string
        session.user.phone = token.phone as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
}
