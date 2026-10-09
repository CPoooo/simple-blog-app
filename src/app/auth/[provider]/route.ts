import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { client, enabledProviders, isProvider, SCOPES } from "@/lib/oauth";

const TEN_MINUTES = 60 * 10;

/** Same-site paths only (no open redirects). */
const safeNext = (raw: string | null) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") && raw.length <= 300 ? raw : null;

/**
 * Step 1 of "Continue with X": remember a random `state` (and Google's PKCE verifier)
 * in short-lived httpOnly cookies, then send the browser to the provider.
 * ?link=1 means "connect this provider to my account" (from Settings).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider) || !enabledProviders().includes(provider)) {
    return NextResponse.json({ error: "Unknown sign-in provider" }, { status: 404 });
  }

  const state = generateState();
  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/auth", maxAge: TEN_MINUTES };
  jar.set("rh_oauth_state", state, opts);

  let url: URL;
  if (provider === "google") {
    const verifier = generateCodeVerifier();
    jar.set("rh_oauth_verifier", verifier, opts);
    url = (client("google") as import("arctic").Google).createAuthorizationURL(state, verifier, SCOPES.google);
    url.searchParams.set("prompt", "select_account"); // let people pick which Google account
  } else {
    url = (client(provider) as import("arctic").GitHub | import("arctic").Facebook).createAuthorizationURL(state, SCOPES[provider]);
  }

  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (next) jar.set("rh_oauth_next", next, opts);
  else jar.delete({ name: "rh_oauth_next", path: "/auth" });
  if (request.nextUrl.searchParams.get("link") === "1") jar.set("rh_oauth_link", "1", opts);
  else jar.delete({ name: "rh_oauth_link", path: "/auth" });

  return NextResponse.redirect(url);
}
