import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const V = { username: `fv_${stamp}`, email: `fv_${stamp}@example.com`, password: "correct-horse-1" };
const W = { username: `fw_${stamp}`, email: `fw_${stamp}@example.com`, password: "correct-horse-1" };
const manifest = JSON.parse(readFileSync("./.next/server/server-reference-manifest.json", "utf8"));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => JSON.stringify(v).includes(`"exportedName":"${name}"`))?.[0];
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');

async function register(u) {
  const page = await (await fetch(BASE + "/register")).text();
  const body = new FormData();
  for (const m of page.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const n = m[0].match(/name="([^"]*)"/)?.[1];
    if (n?.startsWith("$ACTION")) body.append(decode(n), decode(m[0].match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  for (const [k, v] of Object.entries(u)) body.append(k, v);
  const res = await fetch(BASE + "/register", { method: "POST", body, redirect: "manual" });
  return `session=${res.headers.get("set-cookie").match(/session=([^;]*)/)[1]}`;
}
const action = (name, args, cookie) =>
  fetch(BASE + "/discover", { method: "POST", headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie }, body: JSON.stringify(args) }).then((r) => r.text());
const html = async (path, cookie) => (await (await fetch(BASE + path, { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
// Card title links (not the "#comments-heading" ones), in page order.
const slugs = (h) => [...h.matchAll(/<h2[^>]*><a [^>]*href="\/p\/([^"#]+)"/g)].map((m) => m[1]);
const cursorOf = (h) => h.replaceAll('\\"', '"').match(/"nextCursor":"([A-Za-z0-9_-]+)"/)?.[1] ?? null;

async function walk(query, cookie) {
  const first = await html(`/feed${query ? "?" + query : ""}`, cookie);
  const all = slugs(first);
  let cursor = cursorOf(first), pages = 1;
  const sp = new URLSearchParams(query);
  while (cursor && pages < 20) {
    sp.set("cursor", cursor);
    const page = await (await fetch(`${BASE}/api/feed?${sp}`, { headers: { cookie } })).json();
    all.push(...page.posts.map((p) => p.slug));
    cursor = page.nextCursor;
    pages++;
  }
  return { all, pages, first };
}

let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
let vId, wId;

try {
  const cv = await register(V), cw = await register(W);
  [{ id: vId }] = await sql.query("select id from users where email = $1", [V.email]);
  [{ id: wId }] = await sql.query("select id from users where email = $1", [W.email]);

  // empty state before following anyone
  check("no follows -> friendly empty state", (await html("/feed", cw)).includes("quiet down here"));

  const seeds = await sql.query("select id, username from users where email like '%@seed.example.com' order by username");
  for (const s of seeds) await action("toggleFollow", [s.id], cv);
  const followed = seeds.map((s) => s.username);

  const expected = (order, extra = "", params = []) =>
    sql.query(
      `select p.slug from posts p join users u on u.id = p.author_id
        left join (select post_id, count(*) n from likes group by post_id) l on l.post_id = p.id
       where p.published_at is not null and p.author_id in (select following_id from follows where follower_id = $1) ${extra}
       order by ${order}`,
      [vId, ...params],
    ).then((r) => r.map((x) => x.slug));

  // ---- latest ----
  let r = await walk("", cv);
  let exp = await expected("p.published_at desc, p.id desc");
  check("latest: walked multiple pages", r.pages >= 2, `${r.pages} pages`);
  check("latest: every followed post exactly once", r.all.length === exp.length && new Set(r.all).size === r.all.length, `${r.all.length} vs ${exp.length}`);
  check("latest: order matches SQL (newest first)", JSON.stringify(r.all) === JSON.stringify(exp));
  check("people strip lists everyone followed + See all", followed.every((u) => r.first.includes(`aria-label="Only @${u}`)) && r.first.includes('href="/following"'));
  const recent = (await sql.query(`select u.username from users u join posts p on p.author_id = u.id and p.published_at is not null where u.id in (select following_id from follows where follower_id = $1) group by u.username having max(p.published_at) > now() - interval '3 days'`, [vId])).map((x) => x.username);
  check("recency ring on exactly the people who posted in 3 days", followed.every((u) => r.first.includes(`aria-label="Only @${u} (posted recently)"`) === recent.includes(u)), recent.join(","));

  // ---- most liked ----
  r = await walk("sort=top", cv);
  exp = await expected("coalesce(l.n,0) desc, p.published_at desc, p.id desc");
  check("most liked: order matches SQL (likes, then newest)", JSON.stringify(r.all) === JSON.stringify(exp), `${r.all.length} posts`);
  check("most liked tab marked selected", /aria-selected="true"[^>]*>Most liked|Most liked<\/a>/.test(r.first) && r.first.includes('href="/feed"'));

  // ---- filters ----
  r = await walk("tag=programming-languages", cv);
  exp = await expected("p.published_at desc, p.id desc", "and exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id and t.name = $2)", ["programming-languages"]);
  check("tag filter: exactly the tagged posts", JSON.stringify(r.all) === JSON.stringify(exp) && exp.length > 0, `${r.all.length}`);
  r = await walk("author=vim_victor", cv);
  exp = await expected("p.published_at desc, p.id desc", "and u.username = $2", ["vim_victor"]);
  check("person filter: only that person's posts", JSON.stringify(r.all) === JSON.stringify(exp) && exp.length > 0, `${r.all.length}`);
  check("person filter: their bubble is active", r.first.includes('aria-label="Show everyone'));
  r = await walk("author=mindful_mo&tag=philosophy&sort=top", cv);
  exp = await expected("coalesce(l.n,0) desc, p.published_at desc, p.id desc", "and u.username = $2 and exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id and t.name = $3)", ["mindful_mo", "philosophy"]);
  check("combined person + tag + sort", JSON.stringify(r.all) === JSON.stringify(exp) && exp.length > 0, `${r.all.length}`);
  check("clear-filters link shown when filtered", r.first.includes("Clear filters"));
  r = await walk("author=" + W.username, cv);
  check("someone you don't follow -> no posts leak", r.all.length === 0 && r.first.includes("Nothing matches those filters"));
  // The page cleans junk params; the client then pages with the cleaned filters (not the raw URL),
  // so compare the first page only. The API itself rejecting junk is covered under "API guards".
  const junk = await html("/feed?sort=bogus&tag=Not%20Canonical", cv);
  const full = await expected("p.published_at desc, p.id desc");
  check("junk filter values fall back to the full feed", JSON.stringify(slugs(junk)) === JSON.stringify(full.slice(0, 10)));
  check("...and the client is handed cleaned filters", junk.replaceAll('\\"', '"').includes('"filters":{"sort":"latest","tag":null,"author":null}'));

  // ---- inline like state ----
  const [target] = await expected("p.published_at desc, p.id desc");
  const [{ id: targetId }] = await sql.query("select id from posts where slug = $1", [target]);
  const before = (await sql.query("select count(*)::int n from likes where post_id = $1", [targetId]))[0].n;
  await action("toggleLike", [targetId], cv);
  r = await walk("", cv);
  check("liked post shows pressed heart with new count", r.first.includes(`Unlike (${before + 1} like`));
  await action("toggleLike", [targetId], cv);

  // ---- API guards ----
  const api = (qs, cookie = cv) => fetch(`${BASE}/api/feed?${qs}`, { headers: { cookie } }).then((x) => x.status);
  const someCursor = cursorOf(await html("/feed", cv));
  check("API: signed out -> 401", (await api(`cursor=${someCursor}`, "")) === 401);
  check("API: bad sort -> 400", (await api(`cursor=${someCursor}&sort=random`)) === 400);
  check("API: garbage cursor -> 400", (await api("cursor=bm9wZQ")) === 400);

  // ---- following page ----
  let page = await html("/following", cv);
  // React renders class before href; match the real markup (the avatar link has no class).
  const nameLinks = (h) => [...h.matchAll(/<a class="font-medium hover:underline" href="\/u\/([a-z0-9_]+)"/g)].map((m) => m[1]);
  const listed = nameLinks(page);
  const byActivity = (await sql.query(`select u.username from follows f join users u on u.id = f.following_id left join posts p on p.author_id = u.id and p.published_at is not null where f.follower_id = $1 group by u.username order by max(p.published_at) desc nulls last, u.username`, [vId])).map((x) => x.username);
  check("following page: everyone, most recently active first", JSON.stringify(listed) === JSON.stringify(byActivity), listed.join(","));
  check("following page: 'see their posts' links into the feed", page.includes(`href="/feed?author=${byActivity[0]}"`));
  await action("toggleFollow", [seeds[0].id], cv);
  page = await html("/following", cv);
  const after = nameLinks(page);
  check("unfollow removes them from the list", after.length === listed.length - 1 && !after.includes(seeds[0].username), after.join(","));
  r = await walk("", cv);
  check("...and their posts leave the feed", r.all.length === (await expected("p.published_at desc")).length);
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  await sql.query("delete from users where id = any($1)", [[vId, wId].filter(Boolean)]);
  console.log("\ncleanup: test users (+ their follows/likes) removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
