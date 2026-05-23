import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { supabase } from "@/lib/supabase"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        mode: { label: "Mode", type: "text" }, // 'signin' or 'signup'
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        try {
          if (credentials.mode === "signup") {
            // Sign up new user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
              email: credentials.email,
              password: credentials.password,
            })

            if (signUpError) throw signUpError
            if (!authData.user) throw new Error("Failed to create user")

            // Create user profile
            const { error: profileError } = await supabase
              .from("user_profiles")
              .insert({
                user_id: authData.user.id,
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
              })

            if (profileError) throw profileError

            return {
              id: authData.user.id,
              email: authData.user.email!,
            }
          } else {
            // Sign in existing user
            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password,
            })

            if (signInError) throw signInError
            if (!authData.user) throw new Error("Invalid credentials")

            return {
              id: authData.user.id,
              email: authData.user.email!,
            }
          }
        } catch (error: unknown) {
          console.error("Auth error:", error)
          if (error instanceof Error) {
            throw new Error(error.message)
          }
          throw new Error("Authentication failed")
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
