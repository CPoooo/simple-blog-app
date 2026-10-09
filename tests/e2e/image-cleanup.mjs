import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";

const req = createRequire(import.meta.url);
const { upload } = req("@vercel/blob/client");
const { head, list, del } = req("@vercel/blob");

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `ic${n}_${stamp}`, email: `ic${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");

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
  return { res, location: res.headers.get("location"), html: await res.text() };
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const send = (userId, cookie) =>
  upload(`posts/${userId}/image.png`, new Blob([PNG], { type: "image/png" }), {
    access: "public", handleUploadUrl: `${BASE}/api/post-image/upload`, headers: { cookie }, contentType: "image/png",
  }).then((b) => b.url);
const exists = async (url) => { try { await head(url); return true; } catch { return false; } };
// Cleanup runs in after(), i.e. just after the response: poll briefly instead of checking instantly.
async function eventually(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 750)); }
  return false;
}
const docWith = (...urls) => JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "pics:" }] }, ...urls.map((src) => ({ type: "image", attrs: { src, alt: "" } }))],
});

let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
let aId, bId;

try {
  const reg = async (u) => `session=${(await submit("/register", 'name="username"', u)).res.headers.get("set-cookie").match(/session=([^;]*)/)[1]}`;
  const ca = await reg(A), cb = await reg(B);
  [{ id: aId }] = await sql.query("select id from users where email = $1", [A.email]);
  [{ id: bId }] = await sql.query("select id from users where email = $1", [B.email]);

  const img1 = await send(aId, ca), img2 = await send(aId, ca), imgB = await send(bId, cb);

  // P1 with two images
  let r = await submit("/write", 'name="title"', { title: `Pics ${stamp}`, content: docWith(img1, img2), tags: "", intent: "publish" }, ca);
  const [{ id: p1 }] = await sql.query("select id from posts where title = $1", [`Pics ${stamp}`]);
  check("post with 2 images saved, both files exist", Boolean(r.location) && (await exists(img1)) && (await exists(img2)));

  // Remove img2 while editing
  await submit(`/write/${p1}`, 'name="title"', { id: p1, title: `Pics ${stamp}`, content: docWith(img1), tags: "", intent: "save" }, ca);
  check("image removed in an edit -> its file is deleted", await eventually(async () => !(await exists(img2))));
  check("the image still in the post is kept", await exists(img1));

  // img1 also used by a second post (copy-paste)
  await submit("/write", 'name="title"', { title: `Pics copy ${stamp}`, content: docWith(img1), tags: "", intent: "save" }, ca);
  const [{ id: p2 }] = await sql.query("select id from posts where title = $1", [`Pics copy ${stamp}`]);
  await submit("/me/posts", `value="${p1}"`, { id: p1 }, ca);
  await new Promise((res) => setTimeout(res, 4000)); // give after() time to (wrongly) delete it
  check("deleting a post keeps an image another post still uses", await exists(img1));
  await submit("/me/posts", `value="${p2}"`, { id: p2 }, ca);
  check("deleting the last post using it -> file deleted", await eventually(async () => !(await exists(img1))));

  // A fresh, never-saved upload is protected by the 24h grace period
  const fresh = await send(aId, ca);
  await submit("/write", 'name="title"', { title: `Plain ${stamp}`, content: docWith(), tags: "", intent: "save" }, ca);
  await new Promise((res) => setTimeout(res, 4000));
  check("fresh unsaved upload survives the orphan sweep (grace period)", await exists(fresh));

  // Other people's files are never touched by A's cleanup
  check("another user's image is untouched", await exists(imgB));
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  for (const id of [aId, bId].filter(Boolean)) {
    const { blobs } = await list({ prefix: `posts/${id}/` });
    if (blobs.length) await del(blobs.map((b) => b.url));
  }
  await sql.query("delete from users where id = any($1)", [[aId, bId].filter(Boolean)]);
  console.log("\ncleanup: test users + blobs removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
