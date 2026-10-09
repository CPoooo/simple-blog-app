import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Optimistic redirects only: this checks the token signature, not the database.
// Real authorization lives in the DAL (requireUser) and in every Server Action.
const GUEST_ONLY = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  if (userId !== null) {
    // Signed-in people skip the landing page and the auth forms: home is their feed.
    if (pathname === "/" || GUEST_ONLY.includes(pathname)) {
      return NextResponse.redirect(new URL("/feed", request.nextUrl));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register"],
};
