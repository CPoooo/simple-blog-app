// "Surprise me", "Show me something I'll like", navbar Following.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `dy${n}_${stamp}`, email: `dy${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");
const manifest = JSON.parse(readFileSync("./.next/server/server-reference-manifest.json", "utf8"));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => JSON.stringify(v).includes(`"exportedName":"${name}"`))?.[0];
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');

function formFields(html, marker) {
  const form = html.split("<form").slice(1).map((f) => f.split("</form>")[0]).find((f) => f.includes(marker));
  if (!form) throw new Error(`no form containing ${marker}`);
  const fields = {};
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) fields[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return fields;
}
async function submit(path, marker, values, cookie = "") {
  const page = await (await fetch(BASE + path, { headers: { cookie } })).text();
  const body = new FormData();
  for (const [k, v] of Object.entries(formFields(page, marker))) body.append(k, v);
  for (const [k, v] of values) body.append(k, v); // array of pairs: repeated "tag" fields
  return fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
}
const register = async (u) => {
  const res = await submit("/register", 'name="username"', Object.entries(u));
  return `session=${res.headers.get("set-cookie").match(/session=([^;]*)/)[1]}`;
};
const html = async (path, cookie = "") => (await (await fetch(BASE + path, { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
const pickOf = (h) => h.match(/text-3xl leading-tight font-semibold"><a [^>]*href="\/p\/([^"]+)"/)?.[1] ?? null;
const action = (name, args, cookie) =>
  fetch(BASE + "/discover", { method: "POST", headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie }, body: JSON.stringify(args) });
const tagsOfSlug = async (slug) => (await sql.query("select t.name from posts p join post_tags pt on pt.post_id = p.id join tags t on t.id = pt.tag_id where p.slug = $1", [slug])).map((r) => r.name);

let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
let aId, bId;

try {
  // ================= Surprise me =================
  const published = new Set((await sql.query("select slug from posts where published_at is not null")).map((r) => r.slug));
  const drafts = new Set((await sql.query("select slug from posts where published_at is null")).map((r) => r.slug));
  const seen = [];
  let headersOk = true;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(BASE + "/surprise", { redirect: "manual" });
    if (res.status !== 307 || !(res.headers.get("cache-control") ?? "").includes("no-store")) headersOk = false;
    seen.push(decodeURIComponent((res.headers.get("location") ?? "").replace(/^.*\/p\//, "")));
  }
  check("surprise: 307 redirect, never cached", headersOk);
  check("surprise: always a published post, never a draft", seen.every((s) => published.has(s) && !drafts.has(s)));
  check("surprise: actually random (variety over 30 rolls)", new Set(seen).size >= 5, `${new Set(seen).size} distinct`);
  const here = seen[0];
  let repeated = false;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(BASE + "/surprise", { redirect: "manual", headers: { referer: `${BASE}/p/${here}` } });
    if ((res.headers.get("location") ?? "").endsWith(`/p/${here}`)) repeated = true;
  }
  check("surprise: never sends you to the post you're already on", !repeated);
  check("surprise: dice in header + links on discover/landing/404", (await html("/discover")).includes('href="/surprise"') && (await html("/")).includes('href="/surprise"') && (await html("/nope-nope")).includes('href="/surprise"'));

  // ================= For you =================
  check("for-you (guest): sign-up pitch + surprise fallback", (await html("/for-you")).includes("Tell us what you") && (await html("/for-you")).includes('href="/surprise"'));

  const ca = await register(A), cb = await register(B);
  [{ id: aId }] = await sql.query("select id from users where email = $1", [A.email]);
  [{ id: bId }] = await sql.query("select id from users where email = $1", [B.email]);

  let page = await html("/for-you", ca);
  check("new user, no interests/likes: asks for topics, picker open", page.includes("Pick a few topics below") && /<details open=""/.test(page) && page.includes('name="tag"'));

  // save interests (plus junk that must be ignored)
  await submit("/for-you", 'name="tag"', [["tag", "programming-languages"], ["tag", "philosophy"], ["tag", "not-a-real-tag-zzz"], ["tag", "<script>"]], ca);
  const saved = (await sql.query("select t.name from user_interests ui join tags t on t.id = ui.tag_id where ui.user_id = $1 order by 1", [aId])).map((r) => r.name);
  check("interests saved; unknown/junk tags ignored", JSON.stringify(saved) === JSON.stringify(["philosophy", "programming-languages"]), saved.join(","));
  page = await html("/for-you", ca);
  check("saved interests show as checked chips", /value="philosophy" checked=""|checked="" value="philosophy"/.test(page) || /name="tag" value="philosophy"[^>]*checked/.test(page));

  const picks = [];
  for (let i = 0; i < 15; i++) picks.push(pickOf(await html("/for-you", ca)));
  const okTags = await Promise.all(picks.map(async (s) => (await tagsOfSlug(s)).some((t) => saved.includes(t))));
  check("every pick matches at least one interest", picks.every(Boolean) && okTags.every(Boolean), `${new Set(picks).size} distinct picks`);
  check("weighted random: variety across reloads", new Set(picks).size >= 2);
  page = await html("/for-you", ca);
  check("'why we picked this' names the matching interest", page.includes("Why we picked this") && /Matches your interests: #(philosophy|programming-languages)/.test(page));

  // liked posts and your own posts are never picked
  const [{ id: likedId, slug: likedSlug }] = await sql.query(
    "select p.id, p.slug from posts p join post_tags pt on pt.post_id = p.id join tags t on t.id = pt.tag_id where t.name = 'philosophy' and p.published_at is not null limit 1");
  await action("toggleLike", [likedId], ca);
  const afterLike = [];
  for (let i = 0; i < 12; i++) afterLike.push(pickOf(await html("/for-you", ca)));
  check("posts you've liked are never recommended", !afterLike.includes(likedSlug));

  // "show me another" walks without repeats until exhausted
  const matchingCount = (await sql.query(
    `select count(distinct p.id)::int n from posts p join post_tags pt on pt.post_id = p.id
      where p.published_at is not null and p.author_id <> $1 and pt.tag_id in (select tag_id from user_interests where user_id = $1)
        and not exists (select 1 from likes l where l.post_id = p.id and l.user_id = $1)`, [aId]))[0].n;
  const walked = [];
  let url = "/for-you";
  for (let i = 0; i < matchingCount + 2; i++) {
    page = await html(url, ca);
    const p = pickOf(page);
    if (!p) break;
    walked.push(p);
    url = page.match(/href="(\/for-you\?skip=[0-9,]+)"/)[1].replaceAll("&amp;", "&");
  }
  check("'show me another' never repeats", new Set(walked).size === walked.length, `${walked.length} picks`);
  check("...covers every match, then says you've seen it all", walked.length === matchingCount && page.includes("seen everything that matches"), `${walked.length}/${matchingCount}`);

  // no interests, but likes: learns from liked posts' tags
  await action("toggleLike", [likedId], cb); // B likes a philosophy post, picks no interests
  page = await html("/for-you", cb);
  const bPick = pickOf(page);
  const likedTags = (await sql.query("select t.name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = $1", [likedId])).map((r) => r.name);
  const bTags = bPick ? await tagsOfSlug(bPick) : [];
  const saysLikes = page.includes("Like posts you&#x27;ve liked") || page.includes("Like posts you've liked");
  check("no interests + likes -> picks from liked posts' tags", Boolean(bPick) && bTags.some((t) => likedTags.includes(t)) && saysLikes, `${bPick} [${bTags}] vs [${likedTags}]`);

  // clearing interests
  await submit("/for-you", 'name="tag"', [], ca);
  check("submitting none clears interests", (await sql.query("select count(*)::int n from user_interests where user_id = $1", [aId]))[0].n === 0);

  // ================= navbar / layout =================
  page = await html("/discover", ca);
  check("navbar: Following link for signed-in users", /<a class="[^"]*hidden sm:inline-flex[^"]*" href="\/following">Following<\/a>|href="\/following"[^>]*>Following</.test(page));
  check("account menu: For you entry wired", page.includes("/for-you") || (await html("/feed", ca)).includes("/for-you"));
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  await sql.query("delete from users where id = any($1)", [[aId, bId].filter(Boolean)]);
  console.log("\ncleanup: test users (+ interests/likes) removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
