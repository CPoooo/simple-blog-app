// Server half of the unsaved-changes flow + editor markup (Cancel, Write/Preview).
import { neon } from "@neondatabase/serverless";

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const U = { username: `ed_${stamp}`, email: `ed_${stamp}@example.com`, password: "correct-horse-1" };
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
  for (const [k, v] of Object.entries({ ...formFields(page, marker), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location"), res };
}
const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "draft body" }] }] });
let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
let uid;

try {
  const reg = await submit("/register", 'name="username"', U);
  const cookie = `session=${reg.res.headers.get("set-cookie").match(/session=([^;]*)/)[1]}`;
  [{ id: uid }] = await sql.query("select id from users where email = $1", [U.email]);

  const page = (await (await fetch(BASE + "/write", { headers: { cookie } })).text()).replaceAll("<!-- -->", "");
  check("editor has Write / Preview tabs", page.includes('aria-label="Editor mode"') && />write<\/button>/.test(page) && />preview<\/button>/.test(page));
  check("editor has a Cancel button", />Cancel<\/button>/.test(page));
  check("editor form carries the hidden 'next' field", page.includes('name="next"'));

  // toast "Save draft" on a NEW post: saves, then goes where you were heading
  let r = await submit("/write", 'name="title"', { title: `Toast save ${stamp}`, content: doc, tags: "", intent: "save", next: "/feed" }, cookie);
  const [made] = await sql.query("select id, published_at from posts where title = $1", [`Toast save ${stamp}`]);
  check("save-then-go (new post): draft saved + redirected to /feed", r.status === 303 && r.location === "/feed" && made && made.published_at === null, `${r.status} ${r.location}`);

  // ...and on an EXISTING post
  r = await submit(`/write/${made.id}`, 'name="title"', { id: made.id, title: `Toast save 2 ${stamp}`, content: doc, tags: "", intent: "save", next: "/discover?tag=rust" }, cookie);
  const [upd] = await sql.query("select title from posts where id = $1", [made.id]);
  check("save-then-go (existing post): saved + redirected", r.status === 303 && r.location === "/discover?tag=rust" && upd.title === `Toast save 2 ${stamp}`, `${r.status} ${r.location}`);

  // open-redirect attempts are ignored (falls back to the normal destination)
  for (const evil of ["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "javascript:alert(1)"]) {
    r = await submit("/write", 'name="title"', { title: `Evil ${stamp}`, content: doc, tags: "", intent: "save", next: evil }, cookie);
    check(`unsafe next ignored: ${evil}`, r.status === 303 && /^\/write\/\d+$/.test(r.location ?? ""), r.location);
  }

  // without next, a save behaves exactly as before (stays in the editor)
  r = await submit(`/write/${made.id}`, 'name="title"', { id: made.id, title: `Toast save 3 ${stamp}`, content: doc, tags: "", intent: "save" }, cookie);
  check("normal save (no next) stays on the page", r.status === 200, String(r.status));

  // publish ignores next: you land on your post
  r = await submit(`/write/${made.id}`, 'name="title"', { id: made.id, title: `Toast save 3 ${stamp}`, content: doc, tags: "", intent: "publish", next: "/feed" }, cookie);
  check("publish ignores next and opens the post", r.status === 303 && (r.location ?? "").startsWith("/p/"), r.location);
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  if (uid) await sql.query("delete from users where id = $1", [uid]);
  console.log("\ncleanup: test user + posts removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
