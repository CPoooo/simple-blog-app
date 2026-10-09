import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const A = { username: `so_${stamp}`, email: `so_${stamp}@example.com`, password: "correct-horse-1" };
const manifest = JSON.parse(readFileSync("./.next/server/server-reference-manifest.json", "utf8"));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => JSON.stringify(v).includes(`"exportedName":"${name}"`))?.[0];

const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
function hiddenFields(html) {
  const f = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) f[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return f;
}
async function submit(path, values, cookie = "", extraHeaders = {}) {
  const page = await fetch(BASE + path, { headers: { cookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...hiddenFields(await page.text()), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie, ...extraHeaders } });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie") ?? "", html: (await res.text()).replaceAll("<!-- -->", "") };
}
// Post to a page a signed-in user can actually be on: the proxy redirects "/" to "/feed".
async function action(name, args, cookie) {
  const res = await fetch(BASE + "/discover", {
    method: "POST", redirect: "manual",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie },
    body: JSON.stringify(args),
  });
  return { text: await res.text(), redirect: res.headers.get("x-action-redirect") };
}
const get = async (path, cookie = "") => {
  const r = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), type: r.headers.get("content-type"), html: (await r.text()).replaceAll("<!-- -->", "") };
};
let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };

const victor = (await sql.query("select id from users where username = 'vim_victor'"))[0];
const followersOf = async (id) => (await sql.query("select count(*)::int n from follows where following_id = $1", [id]))[0].n;

try {
  // ---------- landing + brand ----------
  let r = await get("/");
  check("landing renders for guests", r.status === 200 && r.html.includes("Go deep on things") && r.html.includes("a note from the person who dug this"));
  check("landing: brand in <title>", /<title>[^<]*Rabbit Holes/.test(r.html));
  check("landing: cross-section drawing with accessible title", r.html.includes("A cross-section of a rabbit hole"));
  check("landing: Contents lists real latest posts", r.html.includes("Contents") && r.html.includes("My settings.json is a cry for help"));
  check("landing: Index links tags", r.html.includes('href="/tag/programming-languages"'));
  check("landing: RSS advertised in <head>", r.html.includes('type="application/rss+xml"'));
  r = await get("/definitely-not-a-page");
  check("custom 404 page", r.html.includes("This hole goes nowhere") && /<meta name="robots" content="noindex"/.test(r.html));

  // ---------- register -> feed ----------
  let s = await submit("/register", A);
  const ca = `session=${s.setCookie.match(/session=([^;]*)/)?.[1]}`;
  check("register redirects to /feed", s.location === "/feed", s.location);
  r = await get("/", ca);
  check("signed-in visit to / redirects to /feed", r.status === 307 && r.location?.endsWith("/feed"), `${r.status} ${r.location}`);
  r = await get("/feed", ca);
  check("empty feed state + suggestions", r.html.includes("It&#x27;s quiet down here") || r.html.includes("It's quiet down here"));
  check("suggestions list seed writers", r.html.includes("worth following") && r.html.includes("@vim_victor"));

  // ---------- profile ----------
  r = await get("/u/vim_victor");
  check("profile: bio, counts, posts", r.html.includes("hjkl or bust") && r.html.includes("Letting an agent drive") && !r.html.includes("Half-written thoughts"), "");
  const before = await followersOf(victor.id);
  check("profile shows follower count", new RegExp(`>${before}<\\/span> <span[^>]*>followers`).test(r.html), `${before}`);

  // ---------- follow ----------
  let t = await action("toggleFollow", [victor.id], ca);
  check("follow -> following:true, followers+1", t.text.includes(`"following":true,"followers":${before + 1}`), t.text.match(/"following".{0,40}/)?.[0]);
  r = await get("/u/vim_victor");
  check("profile follower count updated (cache invalidated)", new RegExp(`>${before + 1}<\\/span> <span[^>]*>followers`).test(r.html));
  r = await get("/feed", ca);
  check("feed now shows followed author's posts", r.html.includes("Letting an agent drive") && r.html.includes("My settings.json"));
  // Post cards in the feed also say @vim_victor; only a suggestion has a Follow button.
  check("feed suggestions no longer include followed user", !r.html.includes('aria-label="Follow @vim_victor"'));
  t = await action("toggleFollow", [victor.id], ca);
  check("unfollow -> following:false", t.text.includes(`"following":false,"followers":${before}`));
  const me = (await sql.query("select id from users where email = $1", [A.email]))[0];
  t = await action("toggleFollow", [me.id], ca);
  check("can't follow yourself (app)", t.text.includes("can't follow yourself") || t.text.includes("can\\u0027t follow yourself"));
  let dbRefused = false;
  try { await sql.query("insert into follows (follower_id, following_id) values ($1, $1)", [me.id]); } catch { dbRefused = true; }
  check("can't follow yourself (database CHECK)", dbRefused);
  t = await action("toggleFollow", [999999999], ca);
  check("unknown user -> error", t.text.includes("User not found"));
  t = await action("toggleFollow", [victor.id], "");
  check("guest follow -> redirect to /login", (t.redirect ?? "").startsWith("/login"));

  // ---------- author links ----------
  const agentSlug = (await sql.query("select slug from posts where title = 'Letting an agent drive: week one'"))[0].slug;
  r = await get(`/p/${agentSlug}`, ca);
  check("post: byline + author box link to profile, follow button", (r.html.match(/href="\/u\/vim_victor"/g) ?? []).length >= 2 && r.html.includes("Follow @vim_victor"));
  check("post: commenters link to profiles", r.html.includes('href="/u/rustacean_rae"'));
  check("post: OG tags present", r.html.includes('property="og:title"') && r.html.includes("og:image"));
  r = await get("/discover");
  check("discover cards link authors", r.html.includes('href="/u/'));

  // ---------- search ----------
  r = await get("/search?q=borrow");
  check("search finds post by title", r.html.includes("The borrow checker is a love language"));
  r = await get("/search?q=analytics");
  check("search finds post by tag", r.html.includes("Why spin rate broke my brain"));
  r = await get("/search?q=victor");
  check("search finds people", r.html.includes('href="/u/vim_victor"'));
  r = await get("/search?q=%25%25");
  check("% is literal, not a wildcard", r.html.includes("Nothing for"));
  r = await get("/search?q=x");
  check("1-char query asks for more", r.html.includes("type something"));

  // ---------- RSS / sitemap / robots / OG ----------
  r = await get("/rss.xml");
  check("RSS: content type + items", (r.type ?? "").includes("application/rss+xml") && (r.html.match(/<item>/g) ?? []).length >= 10);
  check("RSS: links absolute, text escaped", /<link>https?:\/\/[^<]+\/p\//.test(r.html) && !/<title>[^<]*<[^/]/.test(r.html));
  r = await get("/sitemap.xml");
  check("sitemap lists posts, profiles, tags", r.html.includes("/p/") && r.html.includes("/u/vim_victor") && r.html.includes("/tag/"));
  r = await get("/robots.txt");
  check("robots disallows private pages", r.html.includes("Disallow: /write") && r.html.includes("Sitemap:"));
  r = await get(`/p/${agentSlug}/opengraph-image`);
  check("per-post OG image renders", r.status === 200 && (r.type ?? "").startsWith("image/png"), `${r.status} ${r.type}`);
  r = await get("/opengraph-image");
  check("site OG image renders", r.status === 200 && (r.type ?? "").startsWith("image/png"));

  // ---------- rate limiting ----------
  for (let i = 0; i < 5; i++) await submit("/login", { email: A.email, password: "wrong-password-x" });
  s = await submit("/login", { email: A.email, password: A.password });
  check("6th login after 5 failures is blocked, even with the right password", s.html.includes("Too many attempts") && !s.setCookie.includes("session="));
  await sql.query("delete from auth_attempts where key = $1", [`login:email:${A.email}`]);
  s = await submit("/login", { email: A.email, password: A.password });
  check("after the window clears, login works again", s.location === "/feed");
  const fakeIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const ipUsers = [];
  let blocked = false;
  for (let i = 0; i < 6; i++) {
    const u = { username: `rl${i}_${stamp}`, email: `rl${i}_${stamp}@example.com`, password: "correct-horse-1" };
    const res = await submit("/register", u, "", { "x-forwarded-for": fakeIp });
    if (res.html.includes("Too many attempts")) blocked = true; else ipUsers.push(u.email);
  }
  check("6th sign-up from one IP in an hour is blocked", blocked && ipUsers.length === 5, `created ${ipUsers.length}`);
  for (const e of ipUsers) await sql.query("delete from users where email = $1", [e]);
  await sql.query("delete from auth_attempts where key like $1", [`%${fakeIp}%`]);

  // ---------- rename routing ----------
  const NEW = `sx_${stamp}`.slice(0, 20);
  await get(`/u/${A.username}`); await get(`/u/${NEW}`); // warm both cached lookups
  const renamed = await submit("/settings/profile", { username: NEW, bio: "" }, ca);
  const [dbName] = await sql.query("select username from users where email = $1", [A.email]);
  console.log(`DEBUG rename: status=${renamed.status} db=${dbName?.username} expected=${NEW} err=${renamed.html.match(/username-hint[^>]*>([^<]*)/)?.[1]}`);
  r = await get(`/u/${A.username}`);
  check("old profile URL 404s after rename", /<meta name="robots" content="noindex"/.test(r.html));
  r = await get(`/u/${NEW}`);
  check("new profile URL resolves after rename", r.html.includes(`@${NEW}`) && !/<meta name="robots" content="noindex"/.test(r.html));
} catch (err) {
  failed++; // a crash means the remaining checks never ran
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  const d = await sql.query("delete from users where email = $1 returning id", [A.email]);
  await sql.query("delete from auth_attempts where key like $1", [`%${A.email}%`]);
  console.log(`\ncleanup: ${d.length} test user`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
