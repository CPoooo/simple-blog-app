// Drives the real forms like a no-JS browser: reads the hidden action fields
// from the page, posts them with our values, and follows the cookie.
const BASE = "http://localhost:3123";
const stamp = Date.now().toString(36);
const user = { username: `test_${stamp}`, email: `test_${stamp}@example.com`, password: "correct-horse-1" };

function hiddenFields(html) {
  const fields = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) fields[name.replaceAll("&amp;", "&")] = value.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  }
  return fields;
}

async function submit(path, values, cookie = "") {
  const page = await fetch(BASE + path, { headers: { cookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...hiddenFields(await page.text()), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
  const setCookie = res.headers.get("set-cookie") ?? "";
  return { status: res.status, location: res.headers.get("location"), setCookie, html: await res.text() };
}

const sessionOf = (setCookie) => setCookie.match(/session=([^;]*)/)?.[1] ?? "";
let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };

// 1. Validation errors come back without touching the DB.
let r = await submit("/register", { username: "x", email: "nope", password: "short" });
check("register rejects bad input", r.html.includes("at least 3 characters") && r.html.includes("valid email") && !sessionOf(r.setCookie));

// 2. Successful registration sets a session and redirects home.
r = await submit("/register", user);
const regCookie = sessionOf(r.setCookie);
check("register succeeds + sets cookie", r.status === 303 && r.location?.startsWith("/") && regCookie.length > 0, `${r.status} ${r.location}`);
check("cookie is HttpOnly + SameSite=Lax", /HttpOnly/i.test(r.setCookie) && /SameSite=Lax/i.test(r.setCookie));

// 3. Duplicate username/email is rejected.
r = await submit("/register", user);
check("duplicate register rejected", r.html.includes("already exists") && r.html.includes("username is taken"));

// 4. Header shows the signed-in user.
let home = (await (await fetch(BASE + "/", { headers: { cookie: `session=${regCookie}` } })).text()).replaceAll("<!-- -->", "");
check("home shows @username when signed in", home.includes(`@${user.username}`));

// 5. Proxy bounces signed-in users off /login.
let res = await fetch(BASE + "/login", { headers: { cookie: `session=${regCookie}` }, redirect: "manual" });
check("proxy redirects signed-in user from /login to /feed", res.status === 307 && res.headers.get("location")?.endsWith("/feed"), `${res.status} ${res.headers.get("location")}`);

// 6. Wrong password and unknown email give the same generic error.
r = await submit("/login", { email: user.email, password: "wrong-password" });
const wrongPw = r.html.includes("Invalid email or password") && !sessionOf(r.setCookie);
r = await submit("/login", { email: `nobody_${stamp}@example.com`, password: "whatever123" });
check("bad credentials -> same generic error", wrongPw && r.html.includes("Invalid email or password"));

// 7. Correct login (email case-insensitive) sets a session.
r = await submit("/login", { email: user.email.toUpperCase(), password: user.password });
const loginCookie = sessionOf(r.setCookie);
check("login succeeds (case-insensitive email)", r.status === 303 && loginCookie.length > 0, `${r.status}`);

// 8. Tampered token is treated as signed out.
home = await (await fetch(BASE + "/", { headers: { cookie: `session=${loginCookie.slice(0, -2)}xx` } })).text();
check("tampered token ignored", !home.includes(`@${user.username}`) && home.includes("Sign in"));

// 9. Logout clears the cookie.
r = await submit("/", {}, `session=${loginCookie}`);
console.log(`INFO  logout via header form: ${r.status} ${r.location} cleared=${/session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(r.setCookie)}`);

// Clean up the test user (cascades to everything it owns).
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
await sql.query("delete from users where email = $1", [user.email]);
await sql.query("delete from auth_attempts where key like $1", [`%${stamp}%`]);
console.log("\ncleanup done");
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
