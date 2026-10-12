import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast gate for signed-in areas: no session cookie, no entry. The layouts
 * then verify the session and the user's role properly on the server.
 */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL("/sign-in", req.url);
    if (req.nextUrl.pathname.startsWith("/portal")) url.searchParams.set("as", "family");
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/practice/:path*", "/portal/:path*", "/account"] };
