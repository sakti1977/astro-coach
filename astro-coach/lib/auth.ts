import { NextAuthOptions, Session } from "next-auth"
import { JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabase } from "@/lib/supabase"

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
    includeReligiousSolutions: false,
  },
}

async function ensureProfile(userId: string) {
  if (!supabase) return
  const { error } = await supabase
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
        accessToken: { label: "Access Token", type: "text" },
        mode:        { label: "Mode",         type: "text" },
        // mode values:
        //   "signin"     — email + password sign-in
        //   "signup"     — email + password sign-up
        //   "phone-otp"  — phone OTP (Supabase access token passed after client-side OTP verify)
      },
      async authorize(credentials: Record<string, string> | undefined) {
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
          if (!credentials.accessToken) {
            throw new Error("Access token is required for phone authentication")
          }

          // Validate the Supabase access token server-side
          const { data: { user }, error } = await supabase.auth.getUser(
            credentials.accessToken
          )
          if (error || !user) {
            throw new Error("Invalid or expired OTP session. Please try again.")
          }

          await ensureProfile(user.id)

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
            if (!authData.user) throw new Error("Failed to create user")

            await ensureProfile(authData.user.id)

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
  secret: process.env.NEXTAUTH_SECRET,
}
