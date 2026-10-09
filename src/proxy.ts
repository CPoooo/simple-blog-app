import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Optimistic redirects only: this checks the token signature, not the database.
// Real authorization lives in the DAL (requireUser) and in every Server Action.
const GUEST_ONLY = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (userId !== null && GUEST_ONLY.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register"],
};
