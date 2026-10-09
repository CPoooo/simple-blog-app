import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const A = { username: `dp_${stamp}`, email: `dp_${stamp}@example.com`, password: "correct-horse-1" };
const RENAMED = `dpr_${stamp}`.slice(0, 20);

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
async function submit(path, values, cookie = "", pick = (f) => f) {
  const page = await fetch(BASE + path, { headers: { cookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...pick(hiddenFields(await page.text())), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie") ?? "", html: (await res.text()).replaceAll("<!-- -->", "") };
}
const get = async (path, cookie = "") => {
  const r = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), html: (await r.text()).replaceAll("<!-- -->", "") };
};
let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };

const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Filler post for pagination." }] }] });
const slugsInHtml = (html) => [...html.matchAll(/<a [^>]*href="\/p\/([^"]+)"/g)].map((m) => m[1]);

/** Independent re-implementation of the ranking, straight from raw DB values. */
async function expectedOrder(asOfIso, tag = null) {
  const rows = await sql.query(
    `select p.id, p.slug, (extract(epoch from p.published_at) * 1000)::float8 as ms,
            (select count(*)::int from likes l where l.post_id = p.id) as likes
       from posts p
      where p.published_at is not null and p.published_at <= $1::timestamp
        ${tag ? "and exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id and t.name = $2)" : ""}`,
    tag ? [asOfIso, tag] : [asOfIso],
  );
  const asOf = Date.parse(asOfIso);
  return rows
    .map((r) => ({ ...r, score: r.likes / Math.pow(Math.max((asOf - r.ms) / 3_600_000, 0) + 2, 1.5) }))
    .sort((a, b) => b.score - a.score || b.ms - a.ms || b.id - a.id)
    .map((r) => r.slug);
}

try {
  const reg = await submit("/register", A);
  const ca = `session=${reg.setCookie.match(/session=([^;]*)/)?.[1]}`;

  // Warm Discover's cached first page BEFORE publishing, so the next check proves invalidation.
  await get("/discover");
  // 12 zero-like posts so there are at least 3 pages of 10.
  for (let i = 0; i < 12; i++) await submit("/write", { title: `Filler ${i} ${stamp}`, content: doc, tags: "filler-test", intent: "publish" }, ca);

  // ---------- Discover: walk every page ----------
  let r = await get("/discover");
  check("discover renders for guests", r.status === 200 && r.html.includes("Discover") && r.html.includes("#programming-languages"));
  const flight = r.html.replaceAll('\\"', '"');
  const asOf = flight.match(/"asOf":"([^"]+)"/)?.[1];
  let cursor = flight.match(/"nextCursor":"([A-Za-z0-9_-]+)"/)?.[1];
  const seen = slugsInHtml(r.html);
  check("first page has 10 posts + a cursor", seen.length === 10 && Boolean(cursor) && Boolean(asOf), `${seen.length} posts`);

  let pages = 1;
  while (cursor && pages < 20) {
    const res = await fetch(`${BASE}/api/discover?${new URLSearchParams({ cursor, asOf })}`);
    const page = await res.json();
    seen.push(...page.posts.map((p) => p.slug));
    cursor = page.nextCursor;
    pages++;
  }
  const expected = await expectedOrder(asOf);
  check("walked every page to the end", !cursor && pages >= 3, `${pages} pages`);
  check("no duplicates across pages", new Set(seen).size === seen.length);
  check("every published post appears exactly once", seen.length === expected.length, `${seen.length} vs ${expected.length}`);
  check("order matches independent ranking", JSON.stringify(seen) === JSON.stringify(expected),
    seen.findIndex((s, i) => s !== expected[i]) + "");
  const [settings] = await sql.query("select slug from posts where title = 'My settings.json is a cry for help'");
  const [bunt] = await sql.query("select slug from posts where title like 'The case for the sacrifice bunt%'");
  check("fresh liked post beats week-old unliked post", seen.indexOf(settings.slug) < seen.indexOf(bunt.slug));
  const likeRows = await sql.query("select p.slug, count(l.post_id)::int n from posts p left join likes l on l.post_id = p.id group by p.slug");
  const likesOf = Object.fromEntries(likeRows.map((x) => [x.slug, x.n]));
  const firstUnliked = seen.findIndex((s) => likesOf[s] === 0);
  check("every liked post ranks above every unliked post", firstUnliked > 0 && seen.slice(firstUnliked).every((s) => likesOf[s] === 0), `first unliked at #${firstUnliked + 1}`);
  const newestFiller = (await sql.query("select slug from posts where title = $1", [`Filler 11 ${stamp}`]))[0].slug;
  check("cached first page refreshed after publishing (newest post visible)", seen.slice(0, 10).includes(newestFiller) || firstUnliked > 10);

  // ---------- Discover: tag filter ----------
  r = await get("/discover?tag=baseball");
  const tagSlugs = slugsInHtml(r.html);
  const expBaseball = await expectedOrder(new Date().toISOString(), "baseball");
  check("?tag=baseball shows exactly the baseball posts", tagSlugs.length === expBaseball.length && tagSlugs.every((s) => expBaseball.includes(s)), tagSlugs.length + "");
  check("active chip marked", /aria-current="page"[^>]*>#baseball|#baseball[^<]*<\/a>/.test(r.html) && r.html.includes('aria-current="page"'));
  r = await get("/discover?tag=Base%20Ball");
  check("non-canonical ?tag redirects to canonical", r.html.includes("/discover?tag=base-ball") || (r.location ?? "").includes("tag=base-ball"));

  // ---------- Discover: API input validation ----------
  const api = async (qs) => (await fetch(`${BASE}/api/discover?${qs}`)).status;
  check("API: missing cursor -> 400", (await api(`asOf=${encodeURIComponent(asOf)}`)) === 400);
  check("API: garbage cursor -> 400", (await api(`cursor=bm9wZQ&asOf=${encodeURIComponent(asOf)}`)) === 400);
  const goodCursor = flight.match(/"nextCursor":"([A-Za-z0-9_-]+)"/)[1];
  check("API: asOf in the future -> 400", (await api(`cursor=${goodCursor}&asOf=2099-01-01T00:00:00Z`)) === 400);
  check("API: non-canonical tag -> 400", (await api(`cursor=${goodCursor}&asOf=${encodeURIComponent(asOf)}&tag=Base%20Ball`)) === 400);

  // ---------- Profile ----------
  r = await get("/settings/profile");
  check("guest can't see settings form", !r.html.includes("Save profile"));
  r = await get("/settings/profile", ca);
  check("settings shows current username + email", r.html.includes(`value="${A.username}"`) && r.html.includes(A.email));

  // comment on a seeded post so we can check the rename propagates into a cached thread
  const [agent] = await sql.query("select slug, id from posts where title = 'Letting an agent drive: week one'");
  await submit(`/p/${agent.slug}`, { postId: agent.id, body: "rename propagation check" }, ca, (f) => Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith("$ACTION_ID_"))));
  const mySlug = (await sql.query("select slug from posts where title = $1", [`Filler 0 ${stamp}`]))[0].slug;
  // Warm the caches that show the old name.
  await get(`/p/${mySlug}`); await get("/tag/filler-test"); await get(`/p/${agent.slug}`);

  r = await submit("/settings/profile", { username: "vim_victor", bio: "" }, ca);
  check("taken username rejected", r.html.includes("That username is taken"));
  r = await submit("/settings/profile", { username: "no spaces!", bio: "" }, ca);
  check("invalid username rejected", r.html.includes("letters, numbers, and underscores"));
  r = await submit("/settings/profile", { username: A.username, bio: "x".repeat(281) }, ca);
  check("281-char bio rejected", r.html.includes("under 280 characters"));
  const [still] = await sql.query("select username, bio from users where email = $1", [A.email]);
  check("rejected saves changed nothing", still.username === A.username && still.bio === null);

  const BIO = `Writes filler posts <b>professionally</b> ${stamp}`;
  r = await submit("/settings/profile", { username: RENAMED.toUpperCase(), bio: `  ${BIO}  ` }, ca);
  const [saved] = await sql.query("select username, bio from users where email = $1", [A.email]);
  check("save: username lowercased, bio trimmed", saved.username === RENAMED && saved.bio === BIO, `${saved.username} | ${saved.bio}`);

  r = await get("/feed", ca); // "/" now redirects signed-in users to /feed
  check("header shows new username", r.html.includes(`@${RENAMED}`));
  r = await get(`/p/${mySlug}`);
  check("post byline + author box updated (cache invalidated)", r.html.includes(`@${RENAMED}`) && !r.html.includes(`@${A.username}`) && r.html.includes("Writes filler posts &lt;b&gt;professionally&lt;/b&gt;"));
  r = await get("/tag/filler-test");
  check("tag page shows new name (cache invalidated)", r.html.includes(`@${RENAMED}`) && !r.html.includes(`@${A.username}`));
  r = await get(`/p/${agent.slug}`);
  check("comment thread shows new name (cache invalidated)", r.html.includes(`@${RENAMED}`) && !r.html.includes(`@${A.username}`));
  r = await submit("/settings/profile", { username: RENAMED, bio: "" }, ca);
  const [cleared] = await sql.query("select bio from users where email = $1", [A.email]);
  check("empty bio stored as null", cleared.bio === null);

  // ---------- Logout from the account menu (action called directly, like the client does) ----------
  const res = await fetch(BASE + "/discover", { method: "POST", redirect: "manual", headers: { "Next-Action": actionId("logout"), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie: ca }, body: "[]" });
  check("logout via menu: redirects to /login + clears cookie", (res.headers.get("x-action-redirect") ?? "").startsWith("/login") && /session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(res.headers.get("set-cookie") ?? ""));
} catch (err) {
  failed++; // a crash means the remaining checks never ran
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  const d = await sql.query("delete from users where email = $1 returning id", [A.email]);
  const t = await sql.query("delete from tags where name = 'filler-test' and id not in (select tag_id from post_tags) returning name");
  console.log(`\ncleanup: ${d.length} test user (+ posts, comment), ${t.length} test tag`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
