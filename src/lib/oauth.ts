import "server-only";
import { decodeIdToken, Facebook, GitHub, Google, type OAuth2Tokens } from "arctic";
import { site } from "@/lib/site";
import type { OAuthProfile, Provider } from "@/lib/oauth-accounts";

export const PROVIDERS = ["google", "github", "facebook"] as const;
export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", github: "GitHub", facebook: "Facebook" };

const env = (p: Provider) => {
  const prefix = p.toUpperCase();
  return { id: process.env[`${prefix}_CLIENT_ID`], secret: process.env[`${prefix}_CLIENT_SECRET`] };
};

/** A provider shows up (button + route) only once its keys are configured. */
export function enabledProviders(): Provider[] {
  return PROVIDERS.filter((p) => env(p).id && env(p).secret);
}

export const isProvider = (raw: string): raw is Provider => (PROVIDERS as readonly string[]).includes(raw);

/** Must match the callback URL registered with each provider exactly. */
export const callbackUrl = (p: Provider) => new URL(`/auth/${p}/callback`, site.url).toString();

export function client(p: Provider) {
  const { id, secret } = env(p);
  if (!id || !secret) throw new Error(`${p} sign-in is not configured`);
  if (p === "google") return new Google(id, secret, callbackUrl(p));
  if (p === "github") return new GitHub(id, secret, callbackUrl(p));
  return new Facebook(id, secret, callbackUrl(p));
}

export const SCOPES: Record<Provider, string[]> = {
  google: ["openid", "profile", "email"],
  github: ["read:user", "user:email"],
  facebook: ["email", "public_profile"],
};

/** Ask the provider who just signed in, normalised to one shape. */
export async function fetchProfile(p: Provider, tokens: OAuth2Tokens): Promise<OAuthProfile> {
  if (p === "google") {
    // The ID token came straight from Google's token endpoint over TLS, so OIDC lets us
    // read its claims without re-verifying the signature.
    const c = decodeIdToken(tokens.idToken()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
    return {
      provider: p,
      providerUserId: c.sub,
      email: c.email ?? null,
      emailVerified: c.email_verified === true,
      usernameHint: c.email?.split("@")[0] ?? c.name ?? "reader",
    };
  }

  if (p === "github") {
    const headers = { Authorization: `Bearer ${tokens.accessToken()}`, Accept: "application/vnd.github+json", "User-Agent": site.name };
    const user = (await (await fetch("https://api.github.com/user", { headers })).json()) as { id: number; login: string };
    // The profile email can be hidden; the emails endpoint says which one is primary + verified.
    const emails = (await (await fetch("https://api.github.com/user/emails", { headers })).json()) as
      | { email: string; primary: boolean; verified: boolean }[]
      | { message: string };
    const primary = Array.isArray(emails) ? emails.find((e) => e.primary) : undefined;
    if (!user?.id) throw new Error("GitHub profile request failed");
    return {
      provider: p,
      providerUserId: String(user.id),
      email: primary?.email ?? null,
      emailVerified: primary?.verified === true,
      usernameHint: user.login,
    };
  }

  const url = new URL("https://graph.facebook.com/me");
  url.searchParams.set("fields", "id,name,email");
  url.searchParams.set("access_token", tokens.accessToken());
  const me = (await (await fetch(url)).json()) as { id?: string; name?: string; email?: string };
  if (!me.id) throw new Error("Facebook profile request failed");
  return {
    provider: p,
    providerUserId: me.id,
    email: me.email ?? null,
    // Facebook doesn't tell us whether the address was verified, so never auto-link on it.
    emailVerified: false,
    usernameHint: me.name ?? "reader",
  };
}
