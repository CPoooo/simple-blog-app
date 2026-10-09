import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { Google } from "arctic";
import { authenticate } from "@/lib/dal";
import { client, enabledProviders, fetchProfile, isProvider } from "@/lib/oauth";
import { resolveOAuthLogin } from "@/lib/oauth-accounts";
import { createSession } from "@/lib/session";

/**
 * Step 2: the provider sends the browser back here with ?code&state. We check the
 * state matches the cookie we set (CSRF protection), trade the code for tokens, ask
 * the provider who this is, then sign them in (or link the provider) with our own session.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const jar = await cookies();
  const linking = jar.get("rh_oauth_link")?.value === "1";
  const next = jar.get("rh_oauth_next")?.value ?? null;
  const fail = (error: string) =>
    NextResponse.redirect(new URL(linking ? `/settings/account?oauth_error=${error}` : `/login?oauth_error=${error}`, request.nextUrl));

  if (!isProvider(provider) || !enabledProviders().includes(provider)) return fail("unavailable");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = jar.get("rh_oauth_state")?.value;
  const verifier = jar.get("rh_oauth_verifier")?.value;
  for (const name of ["rh_oauth_state", "rh_oauth_verifier", "rh_oauth_next", "rh_oauth_link"]) jar.delete({ name, path: "/auth" });

  // Cancelled on the provider's screen, or a forged/expired callback.
  if (request.nextUrl.searchParams.get("error")) return fail("cancelled");
  if (!code || !state || !expected || state !== expected) return fail("state");

  let profile;
  try {
    const tokens =
      provider === "google"
        ? await (client("google") as Google).validateAuthorizationCode(code, verifier ?? "")
        : await (client(provider) as Exclude<ReturnType<typeof client>, Google>).validateAuthorizationCode(code);
    profile = await fetchProfile(provider, tokens);
  } catch (err) {
    console.error(`${provider} sign-in failed`, err);
    return fail("provider");
  }

  const current = linking ? await authenticate() : null;
  if (linking && !current) return fail("signin_required");

  const result = await resolveOAuthLogin(profile, current?.id ?? null);
  if (!result.ok) return fail(result.error);

  await createSession(result.userId, result.tokenVersion);
  // New people land on their profile settings to pick a username/bio; everyone else goes on.
  const destination = linking ? "/settings/account?connected=" + provider : result.created ? "/settings/profile?welcome=1" : (next ?? "/feed");
  return NextResponse.redirect(new URL(destination, request.nextUrl));
}
