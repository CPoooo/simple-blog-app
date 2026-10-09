// Drives the real forms like a no-JS browser against `next start` on :3123, plus
// direct DB reads (neon) to assert what actually got stored.
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `t${n}_${stamp}`, email: `t${n}_${stamp}@example.com`, password: "correct-horse-1" });
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
// fieldsCookie lets us copy the action fields from one user's page and send them as another user.
async function submit(pagePath, postPath, values, cookie = "", fieldsCookie = cookie) {
  const page = await fetch(BASE + pagePath, { headers: { cookie: fieldsCookie } });
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...hiddenFields(await page.text()), ...values })) body.append(k, v);
  const res = await fetch(BASE + postPath, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location"), setCookie: res.headers.get("set-cookie") ?? "", html: await res.text() };
}
const sessionOf = (sc) => sc.match(/session=([^;]*)/)?.[1] ?? "";
const get = async (path, cookie = "") => { const r = await fetch(BASE + path, { headers: { cookie } }); return { status: r.status, html: await r.text() }; };

let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };

const doc = (...content) => JSON.stringify({ type: "doc", content });
const p = (...c) => ({ type: "paragraph", content: c });
const t = (text, marks) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const GOOD = doc(
  { type: "heading", attrs: { level: 2 }, content: [t("Sub heading")] },
  p(t("Some "), t("bold", [{ type: "bold" }]), t(" and <script>alert(1)</script> text. "),
    t("evil link", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]), t(" "),
    t("good link", [{ type: "link", attrs: { href: "https://example.com" } }])),
);

async function register(u) {
  const r = await submit("/register", "/register", u);
  return `session=${sessionOf(r.setCookie)}`;
}

try {
  const ca = await register(A), cb = await register(B);
  check("two users registered", ca.length > 10 && cb.length > 10);

  // --- create a draft ---
  const title = "Hello <Test> World & Friends";
  let r = await submit("/write", "/write", { title, content: GOOD, intent: "save" }, ca);
  const draftId = r.location?.match(/^\/write\/(\d+)$/)?.[1];
  check("save draft -> redirects to /write/[id]", r.status === 303 && Boolean(draftId), `${r.status} ${r.location}`);

  const [row] = await sql.query("select id, slug, excerpt, reading_minutes, published_at from posts where id = $1", [draftId]);
  check("draft stored unpublished with slug/excerpt", row && row.published_at === null && /^hello-test-world-friends-[0-9a-f]{6}$/.test(row.slug) && row.excerpt.startsWith("Sub heading Some bold"), `${row?.slug} | ${row?.excerpt?.slice(0, 40)}`);
  const slug = row.slug;

  // --- draft is private ---
  r = await get(`/p/${slug}`);
  check("draft shows not-found on public URL", /<meta name="robots" content="noindex"/.test(r.html) && !r.html.includes("Sub heading"), `status ${r.status}`);
  console.log(`INFO  not-found page has noindex: ${/name="robots"[^>]*noindex|noindex[^>]*name="robots"/.test(r.html)}`);
  r = await get(`/write/${draftId}`, ca);
  check("author can open editor for draft", r.status === 200 && r.html.includes("Edit draft"));
  r = await get(`/write/${draftId}`, cb);
  check("other user sees not-found on editor", /<meta name="robots" content="noindex"/.test(r.html) && !r.html.includes("Edit draft"), `status ${r.status}`);

  // --- other user cannot modify or delete ---
  r = await submit("/write", "/write", { id: draftId, title: "HACKED", content: GOOD, intent: "publish" }, cb);
  const [after] = await sql.query("select title, published_at from posts where id = $1", [draftId]);
  check("non-author update rejected, post untouched", after.title === title && after.published_at === null, after.title);
  // Copy the delete form's action fields from the AUTHOR's page, but send them as user B.
  r = await submit("/me/posts", "/me/posts", { id: draftId }, cb, ca);
  const [still] = await sql.query("select id from posts where id = $1", [draftId]);
  check("non-author delete rejected", Boolean(still));

  // --- validation ---
  r = await submit("/write", "/write", { title: "   ", content: GOOD, intent: "save" }, ca);
  check("blank title rejected", r.html.includes("Give your post a title"));
  r = await submit("/write", "/write", { title: "x", content: doc({ type: "evil", content: [] }), intent: "save" }, ca);
  check("unknown node type rejected", r.html.includes("Something is off with the post body"));
  r = await submit("/write", "/write", { title: "x", content: "not json", intent: "save" }, ca);
  check("garbage content rejected", r.html.includes("Something is off with the post body"));
  r = await submit("/write", "/write", { title: "x", content: doc(p()), intent: "publish" }, ca);
  check("publishing an empty body rejected", r.html.includes("Write something before publishing"));
  const [cnt] = await sql.query("select count(*)::int n from posts where author_id = (select id from users where username = $1)", [A.username]);
  check("rejected saves created no rows", cnt.n === 1, `rows=${cnt.n}`);

  // --- publish ---
  r = await submit(`/write/${draftId}`, `/write/${draftId}`, { id: draftId, title, content: GOOD, intent: "publish" }, ca);
  check("publish -> redirects to /p/slug", r.status === 303 && r.location === `/p/${slug}`, `${r.status} ${r.location}`);

  r = await get(`/p/${slug}`);
  check("published post is public (200)", r.status === 200);
  const flat = r.html.replaceAll("<!-- -->", ""); // React separates adjacent text nodes with comments
  check("title + byline rendered", flat.includes("Hello &lt;Test&gt; World &amp; Friends") && flat.includes(`@${A.username}`) && flat.includes("1 min read"));
  check("formatting rendered (h2, strong)", /<h2[^>]*>Sub heading<\/h2>/.test(r.html) && r.html.includes("<strong>bold</strong>"));
  check("script text is escaped, not executable", r.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && !r.html.includes("<script>alert(1)"));
  check("javascript: link neutralised", !/href="javascript:/i.test(r.html), (r.html.match(/<a [^>]*>evil link/) ?? ["(not rendered as link)"])[0]);
  check("https link kept with rel=noopener", /<a [^>]*href="https:\/\/example.com"[^>]*rel="noopener noreferrer nofollow"/.test(r.html) || /<a [^>]*rel="noopener noreferrer nofollow"[^>]*href="https:\/\/example.com"/.test(r.html));

  // --- republish keeps original date; edit while published is live immediately ---
  const [p1] = await sql.query("select published_at from posts where id = $1", [draftId]);
  await submit(`/write/${draftId}`, `/write/${draftId}`, { id: draftId, title: "Edited title", content: GOOD, intent: "save" }, ca);
  r = await get(`/p/${slug}`);
  check("edit while published shows up (cache invalidated)", r.html.includes("Edited title"));
  await submit(`/write/${draftId}`, `/write/${draftId}`, { id: draftId, title: "Edited title", content: GOOD, intent: "publish" }, ca);
  const [p2] = await sql.query("select published_at, slug from posts where id = $1", [draftId]);
  check("re-publish keeps original publish date + slug", String(p1.published_at) === String(p2.published_at) && p2.slug === slug);

  // --- listing ---
  r = await get("/me/posts", ca);
  check("my posts lists it as Published", r.html.includes("Edited title") && r.html.includes("Published"));

  // --- unpublish ---
  await submit(`/write/${draftId}`, `/write/${draftId}`, { id: draftId, title: "Edited title", content: GOOD, intent: "unpublish" }, ca);
  r = await get(`/p/${slug}`);
  check("unpublish -> public URL not-found again", /<meta name="robots" content="noindex"/.test(r.html) && !r.html.includes("Sub heading"), `status ${r.status}`);

  // --- delete (author) ---
  r = await submit("/me/posts", "/me/posts", { id: draftId }, ca);
  const [gone] = await sql.query("select id from posts where id = $1", [draftId]);
  check("author delete works", !gone && r.status === 303, `${r.status} ${r.location}`);
} catch (err) {
  failed++; // a crash means the remaining checks never ran
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  const d = await sql.query("delete from users where username in ($1, $2) returning username", [A.username, B.username]);
  console.log(`\ncleanup: deleted ${d.length} test users (posts cascade)`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
