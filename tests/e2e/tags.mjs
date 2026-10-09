import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `g${n}_${stamp}`, email: `g${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");

const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
function hiddenFields(html) {
  const fields = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) fields[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return fields;
}
async function submit(pagePath, postPath, values, cookie = "", fieldsCookie = cookie) {
  const page = await fetch(BASE + pagePath, { headers: { cookie: fieldsCookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...hiddenFields(await page.text()), ...values })) body.append(k, v);
  const res = await fetch(BASE + postPath, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie") ?? "", html: await res.text() };
}
const sessionOf = (sc) => sc.match(/session=([^;]*)/)?.[1] ?? "";
const get = async (path, cookie = "") => { const r = await fetch(BASE + path, { headers: { cookie } }); return { status: r.status, html: (await r.text()).replaceAll("<!-- -->", "") }; };

let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };

const body = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Body text for the tag test." }] }] });
const tagsOf = async (postId) =>
  (await sql.query("select t.name from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = $1 order by 1", [postId])).map((r) => r.name);
const register = async (u) => `session=${sessionOf((await submit("/register", "/register", u)).setCookie)}`;
const T1 = `Tagged One ${stamp}`, T2 = `Tagged Draft ${stamp}`;

try {
  const ca = await register(A), cb = await register(B);

  // 1. normalisation + dedupe + publish
  let r = await submit("/write", "/write", { title: T1, content: body, tags: "Next JS, Rust, rust, ,lifting!!", intent: "publish" }, ca);
  const slug = r.location?.replace("/p/", "");
  check("publish with messy tags succeeds", r.status === 303 && r.location?.startsWith("/p/"), `${r.status} ${r.location}`);
  const [p1] = await sql.query("select id from posts where slug = $1", [slug]);
  check("tags normalised + deduped in DB", JSON.stringify(await tagsOf(p1.id)) === JSON.stringify(["lifting", "next-js", "rust"]), (await tagsOf(p1.id)).join(","));

  // 2. post page shows tag links
  r = await get(`/p/${slug}`);
  check("post page shows tag links", r.html.includes('href="/tag/next-js"') && r.html.includes("#next-js") && r.html.includes("#rust"));

  // 3. tag pages list it
  r = await get("/tag/rust");
  check("/tag/rust lists the post", r.html.includes(T1) && r.html.includes(`@${A.username}`));
  r = await get("/tag/lifting");
  check("/tag/lifting lists the post", r.html.includes(T1));

  // 4. drafts never appear on tag pages
  r = await submit("/write", "/write", { title: T2, content: body, tags: "rust", intent: "save" }, ca);
  const draftId = r.location?.match(/\/write\/(\d+)/)?.[1];
  check("draft with tag saved", Boolean(draftId), r.location);
  r = await get("/tag/rust");
  check("draft is NOT on /tag/rust", !r.html.includes(T2));

  // 5. editing tags updates links AND invalidates cached tag pages
  r = await submit(`/write/${p1.id}`, `/write/${p1.id}`, { id: p1.id, title: T1, content: body, tags: "rust, baseball", intent: "save" }, ca);
  check("edit tags saves", r.html.length > 0 && r.status !== 409, String(r.status));
  check("old tags removed, new added", JSON.stringify(await tagsOf(p1.id)) === JSON.stringify(["baseball", "rust"]), (await tagsOf(p1.id)).join(","));
  r = await get("/tag/lifting");
  check("/tag/lifting no longer lists it (cache invalidated)", !r.html.includes(T1));
  r = await get("/tag/baseball");
  check("/tag/baseball now lists it (cache invalidated)", r.html.includes(T1));
  r = await get(`/p/${slug}`);
  check("post page shows updated tags", r.html.includes("#baseball") && !r.html.includes("#lifting"));

  // 6. validation leaves existing tags alone
  r = await submit(`/write/${p1.id}`, `/write/${p1.id}`, { id: p1.id, title: T1, content: body, tags: "a,b,c,d,e,f", intent: "save" }, ca);
  check("more than 5 tags rejected", r.html.includes("Use at most 5 tags"));
  r = await submit(`/write/${p1.id}`, `/write/${p1.id}`, { id: p1.id, title: T1, content: body, tags: "x".repeat(31), intent: "save" }, ca);
  check("over-long tag rejected", r.html.includes("at most 30 characters"));
  check("rejected edits left tags unchanged", JSON.stringify(await tagsOf(p1.id)) === JSON.stringify(["baseball", "rust"]));

  // 7. another user can't change someone else's tags
  r = await submit("/write", "/write", { id: p1.id, title: "HACKED", content: body, tags: "hacked", intent: "save" }, cb);
  const [after] = await sql.query("select title from posts where id = $1", [p1.id]);
  check("non-author can't change title or tags", after.title === T1 && JSON.stringify(await tagsOf(p1.id)) === JSON.stringify(["baseball", "rust"]));
  const [hk] = await sql.query("select count(*)::int n from post_tags pt join tags t on t.id = pt.tag_id where t.name = 'hacked'");
  check("no link rows created for the rejected edit", hk.n === 0);

  // 8. url hygiene
  r = await get("/tag/Next%20JS");
  check("non-canonical /tag/Next%20JS -> not found", /<meta name="robots" content="noindex"/.test(r.html));
  r = await get("/tag/nothing-uses-this");
  check("empty tag page says so", r.html.includes("No published posts with this tag yet"));

  // 9. unpublish removes it from tag pages
  r = await submit(`/write/${p1.id}`, `/write/${p1.id}`, { id: p1.id, title: T1, content: body, tags: "rust, baseball", intent: "unpublish" }, ca);
  r = await get("/tag/rust");
  check("unpublished post leaves /tag/rust", !r.html.includes(T1));

  // 10. delete cascades links + clears cache
  await submit(`/write/${p1.id}`, `/write/${p1.id}`, { id: p1.id, title: T1, content: body, tags: "rust, baseball", intent: "publish" }, ca);
  r = await get("/tag/baseball");
  check("republished post is back on /tag/baseball", r.html.includes(T1));
  await submit("/me/posts", "/me/posts", { id: p1.id }, ca);
  check("delete removes link rows", (await tagsOf(p1.id)).length === 0);
  r = await get("/tag/baseball");
  check("deleted post leaves tag page (cache invalidated)", !r.html.includes(T1));
} catch (err) {
  failed++; // a crash means the remaining checks never ran
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  const d = await sql.query("delete from users where username in ($1, $2) returning username", [A.username, B.username]);
  const t = await sql.query("delete from tags where name = any($1) and id not in (select tag_id from post_tags) returning name", [["next-js", "rust", "lifting", "baseball", "hacked", "a", "b", "c", "d", "e", "f"]]);
  console.log(`\ncleanup: ${d.length} test users, ${t.length} orphan test tags removed`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
