// OAuth routes + social-only account lifecycle over HTTP (server running with FAKE provider keys).
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";
const req = createRequire(import.meta.url);
const { SignJWT } = req("jose");

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const flat = (h) => h.replaceAll("<!-- -->", "");

const get = (path, headers = {}) => fetch(BASE + path, { redirect: "manual", headers });
const setCookies = (res) => res.headers.getSetCookie?.() ?? [];
function formFields(html, marker) {
  const form = html.split("<form").slice(1).map((f) => f.split("</form>")[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`no form containing ${marker}`);
  const fields = {};
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name && (name.startsWith("$ACTION") || name === "provider")) fields[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return fields;
}
async function submit(path, marker, values, cookie) {
  const page = await (await fetch(BASE + path, { headers: { cookie } })).text();
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...formFields(page, marker), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { res, status: res.status, location: res.headers.get("location"), html: flat(await res.text()) };
}
const mint = async (userId, v = 0) =>
  `session=${await new SignJWT({ v }).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId)).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.JWT_SECRET))}`;

let uid;
try {
  // ---------- buttons + start routes ----------
  const login = flat(await (await fetch(BASE + "/login")).text());
  check("login page shows all three providers", ["google", "github", "facebook"].every((p) => login.includes(`href="/auth/${p}"`)) && login.includes("Continue with Google"));
  check("register page shows them too", flat(await (await fetch(BASE + "/register")).text()).includes('href="/auth/github"'));

  let res = await get("/auth/google?next=/discover");
  let loc = new URL(res.headers.get("location") ?? "http://x");
  const cookies = setCookies(res);
  check("google: redirects to Google's consent screen", res.status === 307 && loc.host === "accounts.google.com", loc.host);
  check("google: client id, PKCE challenge, state, scopes, account picker", loc.searchParams.get("client_id") === "test-google-id" && loc.searchParams.get("code_challenge_method") === "S256" && !!loc.searchParams.get("state") && (loc.searchParams.get("scope") ?? "").includes("email") && loc.searchParams.get("prompt") === "select_account");
  check("google: callback URL points at our callback route", (loc.searchParams.get("redirect_uri") ?? "").endsWith("/auth/google/callback"), loc.searchParams.get("redirect_uri"));
  check("state + verifier stored in httpOnly cookies scoped to /auth", ["rh_oauth_state", "rh_oauth_verifier", "rh_oauth_next"].every((n) => cookies.some((c) => c.startsWith(n + "=") && /HttpOnly/i.test(c) && /Path=\/auth/i.test(c))));
  res = await get("/auth/github"); loc = new URL(res.headers.get("location"));
  check("github: redirects to GitHub with user:email scope", loc.host === "github.com" && (loc.searchParams.get("scope") ?? "").includes("user:email"));
  res = await get("/auth/facebook"); loc = new URL(res.headers.get("location"));
  check("facebook: redirects to Facebook's dialog", loc.host.endsWith("facebook.com") && loc.pathname.includes("dialog/oauth"), loc.href.slice(0, 60));
  res = await get("/auth/twitter");
  check("unknown provider -> 404", res.status === 404);
  res = await get("/auth/google?next=//evil.example.com");
  check("off-site next is never stored (no open redirect)", !setCookies(res).some((c) => c.startsWith("rh_oauth_next=") && !c.startsWith("rh_oauth_next=;")));

  // ---------- callback failure paths ----------
  const stateCookie = cookies.find((c) => c.startsWith("rh_oauth_state=")).split(";")[0];
  const state = stateCookie.split("=")[1];
  res = await get(`/auth/google/callback?code=abc&state=${state}`);
  check("callback without the state cookie -> rejected", (res.headers.get("location") ?? "").includes("oauth_error=state"));
  res = await get(`/auth/google/callback?code=abc&state=forged`, { cookie: stateCookie });
  check("callback with a forged state -> rejected", (res.headers.get("location") ?? "").includes("oauth_error=state"));
  res = await get(`/auth/google/callback?error=access_denied&state=${state}`, { cookie: stateCookie });
  check("user cancels on the provider -> friendly 'cancelled'", (res.headers.get("location") ?? "").includes("oauth_error=cancelled"));
  res = await get(`/auth/github/callback?code=not-a-real-code&state=${state}`, { cookie: stateCookie });
  check("bad code (provider rejects the exchange) -> 'provider' error, no session", (res.headers.get("location") ?? "").includes("oauth_error=provider") && !setCookies(res).some((c) => c.startsWith("session=") && !c.startsWith("session=;")));
  const errPage = flat(await (await fetch(BASE + "/login?oauth_error=account_exists")).text());
  check("login page explains account_exists", errPage.includes("Sign in with your password, then connect"));

  // ---------- social-only account lifecycle ----------
  const email = `so_${stamp}@example.com`;
  [{ id: uid }] = await sql.query("insert into users (username, email, password_hash) values ($1, $2, null) returning id", [`soc_${stamp}`.slice(0, 20), email]);
  await sql.query("insert into oauth_accounts (provider, provider_user_id, user_id, email) values ('google', $1, $2, $3)", [`g-${stamp}`, uid, email]);
  let cookie = await mint(uid, 0);

  let page = flat(await (await fetch(BASE + "/settings/account", { headers: { cookie } })).text());
  check("settings: social-only user sees 'Set password', no current-password fields", page.includes(">Set password<") && !page.includes('name="currentPassword"'));
  check("settings: Google shown connected with Disconnect; GitHub/Facebook offer Connect", page.includes('aria-label="Disconnect Google"') && page.includes('href="/auth/github?link=1"') && page.includes('href="/auth/facebook?link=1"'));

  let r = await submit("/login", 'name="email"', { email, password: "anything-at-all" }, "");
  check("password login impossible while no password is set", r.html.includes("Invalid email or password"));

  r = await submit("/settings/account", 'value="google"', { provider: "google" }, cookie);
  const stillLinked = (await sql.query("select count(*)::int n from oauth_accounts where user_id = $1", [uid]))[0].n;
  check("can't disconnect your only way to sign in", r.html.includes("Set a password") && stillLinked === 1);

  r = await submit("/settings/account", 'name="newPassword"', { newPassword: "brand-new-pass-1", confirmPassword: "brand-new-pass-1" }, cookie);
  const [{ has }] = await sql.query("select password_hash is not null as has from users where id = $1", [uid]);
  const fresh = setCookies(r.res).find((c) => c.startsWith("session="));
  check("social-only user can set a password (no current password needed)", has && Boolean(fresh));
  cookie = fresh.split(";")[0];

  r = await submit("/settings/account", 'value="google"', { provider: "google" }, cookie);
  const after = (await sql.query("select count(*)::int n from oauth_accounts where user_id = $1", [uid]))[0].n;
  check("with a password set, Google can be disconnected", after === 0 && (r.location ?? "").includes("disconnected=google"), `${r.status} ${r.location}`);

  r = await submit("/login", 'name="email"', { email, password: "brand-new-pass-1" }, "");
  check("...and they sign in with email + password now", r.location === "/feed");

  r = await submit("/settings/account", 'name="confirm"', { confirm: "not-my-name", currentPassword: "brand-new-pass-1" }, cookie);
  check("delete: wrong username confirmation refused", r.html.includes("Type your username"));
  r = await submit("/settings/account", 'name="confirm"', { confirm: `soc_${stamp}`.slice(0, 20), currentPassword: "wrong" }, cookie);
  check("delete: wrong password refused", r.html.includes("not your current password"));
  r = await submit("/settings/account", 'name="confirm"', { confirm: `soc_${stamp}`.slice(0, 20), currentPassword: "brand-new-pass-1" }, cookie);
  const exists = (await sql.query("select count(*)::int n from users where id = $1", [uid]))[0].n;
  check("delete: account gone, session cleared, lands on /goodbye", exists === 0 && r.location === "/goodbye" && setCookies(r.res).some((c) => /^session=;|session=; |Max-Age=0/i.test(c)), `${r.status} ${r.location}`);
  if (exists === 0) uid = null;

  check("/privacy explains deletion; /goodbye renders", (await (await fetch(BASE + "/privacy")).text()).includes("delete-your-data") && (await fetch(BASE + "/goodbye")).status === 200);
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  if (uid) await sql.query("delete from users where id = $1", [uid]);
  await sql.query("delete from auth_attempts where key like $1", [`%so_${stamp}%`]);
  console.log("\ncleanup done");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
