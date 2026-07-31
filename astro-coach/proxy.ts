import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
})

// Chart-only guest mode: /chart and /dasha must be reachable without a
// session (they show real, locally-stored data an anonymous visitor may
// have — the pages themselves only ever gate on chart presence, never
// auth). /coach, /foundation, /habits, /validate are also removed from
// this middleware-level hard-redirect so their own page-level session
// check can render a proper <SignInRequired> prompt instead of an abrupt
// redirect — the underlying API routes remain fully session-gated
// regardless. /transits and /muhurta are unchanged/out of scope here.
export const config = {
  matcher: [
    "/transits/:path*",
    "/muhurta/:path*",
  ],
}
