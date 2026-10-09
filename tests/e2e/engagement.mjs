import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `e${n}_${stamp}`, email: `e${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");

// toggleLike is called from JS (not a form), so call it the way the client does: by action id.
const manifest = JSON.parse(readFileSync("./.next/server/server-reference-manifest.json", "utf8"));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => JSON.stringify(v).includes(`"exportedName":"${name}"`))?.[0];
const TOGGLE = actionId("toggleLike");

const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
function hiddenFields(html) {
  const fields = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) fields[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return fields;
}
// Optional `only`: keep just the $ACTION fields for one form (pages can have several forms).
async function submit(pagePath, postPath, values, cookie = "", fieldsCookie = cookie, pick = (f) => f) {
  const page = await fetch(BASE + pagePath, { headers: { cookie: fieldsCookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...pick(hiddenFields(await page.text())), ...values })) body.append(k, v);
  const res = await fetch(BASE + postPath, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie") ?? "", html: await res.text() };
}
async function callToggle(path, arg, cookie = "") {
  const res = await fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: { "Next-Action": TOGGLE, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie },
    body: JSON.stringify([arg]),
  });
  const text = await res.text();
  const liked = text.match(/"liked":(true|false),"count":(\d+)/);
  return { status: res.status, liked: liked ? liked[1] === "true" : undefined, count: liked ? Number(liked[2]) : undefined, error: text.match(/"error":"([^"]+)"/)?.[1], redirect: res.headers.get("x-action-redirect") };
}
const sessionOf = (sc) => sc.match(/session=([^;]*)/)?.[1] ?? "";
const get = async (path, cookie = "") => (await (await fetch(BASE + path, { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
const likeCount = async (postId) => (await sql.query("select count(*)::int n from likes where post_id = $1", [postId]))[0].n;

let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };
const body = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Engagement test body." }] }] });

try {
  check("found toggleLike action id in build manifest", Boolean(TOGGLE));
  const ca = `session=${sessionOf((await submit("/register", "/register", A)).setCookie)}`;
  const cb = `session=${sessionOf((await submit("/register", "/register", B)).setCookie)}`;

  let r = await submit("/write", "/write", { title: `Engage ${stamp}`, content: body, tags: "", intent: "publish" }, ca);
  const path = r.location;
  const [post] = await sql.query("select id from posts where slug = $1", [path.replace("/p/", "")]);
  r = await submit("/write", "/write", { title: `Engage draft ${stamp}`, content: body, tags: "", intent: "save" }, ca);
  const draftId = Number(r.location.match(/\d+$/)[0]);

  // --- guest view ---
  let html = await get(path);
  check("guest: like links to /login, shows 0", /href="\/login"[^>]*aria-label="0 likes\. Sign in to like"/.test(html) || /aria-label="0 likes\. Sign in to like"[^>]*href="\/login"/.test(html));
  check("guest: comment prompt, empty thread", html.includes("to join the conversation") && html.includes("No comments yet"));

  // --- likes ---
  let t = await callToggle(path, post.id, cb);
  check("B likes -> liked=true count=1", t.liked === true && t.count === 1, JSON.stringify(t));
  check("DB has 1 like", (await likeCount(post.id)) === 1);
  html = await get(path, cb);
  check("B sees pressed heart with 1", html.includes('aria-pressed="true"') && html.includes("Unlike (1 like)"));
  html = await get(path);
  check("guest sees updated count (cache invalidated)", html.includes("1 like. Sign in to like"));

  t = await callToggle(path, post.id, cb);
  check("B toggles again -> unliked, count=0", t.liked === false && t.count === 0, JSON.stringify(t));
  t = await callToggle(path, post.id, ca);
  check("author can like own post", t.liked === true && t.count === 1);

  t = await callToggle(path, draftId, cb);
  check("liking a draft -> error, no row", t.error === "Post not found." && (await likeCount(draftId)) === 0, JSON.stringify(t));
  t = await callToggle(path, "1; drop table likes", cb);
  check("garbage post id -> error", t.error === "Post not found.", JSON.stringify(t));
  t = await callToggle(path, post.id, "");
  check("guest toggle -> redirect to /login, no row", (t.redirect ?? "").includes("/login") && (await likeCount(post.id)) === 1, JSON.stringify(t));

  // --- comments ---
  // Each form only gets its own action fields: the useActionState comment form uses
  // $ACTION_REF/$ACTION_KEY/$ACTION_1:*, the plain delete form uses $ACTION_ID_<id>.
  const commentForm = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith("$ACTION_ID_")));
  const deleteForm = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith("$ACTION_ID_")));
  const comment = (values, cookie) => submit(path, path, values, cookie, cookie, commentForm);
  r = await comment({ postId: post.id, body: "Hello <b>there</b>\nsecond line" }, cb);
  html = await get(path);
  check("comment posted, visible to guest (cache invalidated)", html.includes("Hello &lt;b&gt;there&lt;/b&gt;") && html.includes(`@${B.username}`) && html.includes("(1)"));
  check("comment HTML is escaped", !html.includes("<b>there</b>"));

  r = await comment({ postId: post.id, body: "    " }, cb);
  check("blank comment rejected", r.html.includes("Write a comment first"));
  r = await comment({ postId: post.id, body: "x".repeat(2001) }, cb);
  check("2001-char comment rejected", r.html.includes("under 2000 characters"));
  r = await comment({ postId: draftId, body: "sneaky" }, cb);
  check("comment on a draft rejected", r.html.includes("accepting comments"));
  const [cc] = await sql.query("select count(*)::int n from comments c join posts p on p.id = c.post_id where p.author_id = (select id from users where username = $1)", [A.username]);
  check("only the one valid comment stored", cc.n === 1, `rows=${cc.n}`);

  // --- delete ---
  const [cm] = await sql.query("select id from comments where post_id = $1", [post.id]);
  html = await get(path, ca);
  check("author of post doesn't get a delete button on others' comments", !html.includes("Delete your comment"));
  html = await get(path, cb);
  check("commenter sees their own delete button", html.includes("Delete your comment"));
  // A sends the delete form copied from B's page:
  r = await submit(path, path, { id: cm.id }, ca, cb, deleteForm);
  check("non-owner delete rejected", r.status === 200 && (await sql.query("select id from comments where id = $1", [cm.id])).length === 1, String(r.status));
  await submit(path, path, { id: cm.id }, cb, cb, deleteForm);
  check("owner delete works", (await sql.query("select id from comments where id = $1", [cm.id])).length === 0);
  html = await get(path);
  check("thread empty again for guests (cache invalidated)", html.includes("No comments yet"));
} catch (err) {
  failed++; // a crash means the remaining checks never ran
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  const d = await sql.query("delete from users where username in ($1, $2) returning username", [A.username, B.username]);
  console.log(`\ncleanup: deleted ${d.length} test users (posts, likes, comments cascade)`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
