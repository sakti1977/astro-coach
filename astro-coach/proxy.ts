import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
})

export const config = {
  matcher: [
    "/chart/:path*",
    "/coach/:path*",
    "/dasha/:path*",
    "/habits/:path*",
    "/transits/:path*",
    "/validate/:path*",
  ],
}
