import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// `v` is the user's token_version when the token was issued. Tokens minted before
// versioning existed have no `v`, which counts as 0 (the column's default), so
// shipping this didn't log anyone out.
const payloadSchema = z.object({ sub: z.string().regex(/^\d+$/), v: z.number().int().nonnegative().optional() });

export type Session = { userId: number; version: number };

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function decode(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const parsed = payloadSchema.safeParse(payload);
    return parsed.success ? { userId: Number(parsed.data.sub), version: parsed.data.v ?? 0 } : null;
  } catch {
    return null;
  }
}

/**
 * Signature + expiry only, no database. Cookie-free so the proxy can use it for
 * optimistic redirects; real authorization also checks the version (see dal.ts).
 */
export async function verifySessionToken(token: string): Promise<number | null> {
  return (await decode(token))?.userId ?? null;
}

export async function createSession(userId: number, version: number) {
  const token = await new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The decoded session cookie, or null if absent/invalid/expired. Not yet checked against the database. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decode(token) : null;
}
