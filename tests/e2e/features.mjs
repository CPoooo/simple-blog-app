// Bookmarks, notifications, account settings (+ session revocation), images in posts.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";

const req = createRequire(import.meta.url);
const { upload } = req("@vercel/blob/client");
const { list, del } = req("@vercel/blob");

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `ft${n}_${stamp}`, email: `ft${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");
const manifest = JSON.parse(readFileSync("./.next/server/server-reference-manifest.json", "utf8"));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => JSON.stringify(v).includes(`"exportedName":"${name}"`))?.[0];

const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");
const flat = (html) => html.replaceAll("<!-- -->", "");
const sessionOf = (res) => res.headers.get("set-cookie")?.match(/session=([^;]*)/)?.[1];

/** Hidden $ACTION fields of the one <form> whose markup contains `marker`. */
function formFields(html, marker) {
  const forms = html.split("<form").slice(1).map((f) => f.split("</form>")[0]);
  const form = forms.find((f) => f.includes(marker));
  if (!form) throw new Error(`no form containing ${marker}`);
  const fields = {};
  for (const m of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION")) fields[decode(name)] = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
  }
  return fields;
}
async function submit(path, marker, values, cookie = "", fieldsCookie = cookie) {
  const page = await (await fetch(BASE + path, { headers: { cookie: fieldsCookie } })).text();
  const body = new FormData();
  for (const [k, v] of Object.entries({ ...formFields(page, marker), ...values })) body.append(k, v);
  const res = await fetch(BASE + path, { method: "POST", body, redirect: "manual", headers: { cookie } });
  return { res, status: res.status, location: res.headers.get("location"), html: flat(await res.text()) };
}
async function action(name, args, cookie) {
  const res = await fetch(BASE + "/discover", {
    method: "POST", redirect: "manual",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie },
    body: JSON.stringify(args),
  });
  return { text: await res.text(), redirect: res.headers.get("x-action-redirect") };
}
const get = async (path, cookie = "") => flat(await (await fetch(BASE + path, { headers: { cookie } })).text());
const unread = async (userId) => (await sql.query("select count(*)::int n from notifications where user_id = $1 and read_at is null", [userId]))[0].n;
const notes = async (userId, type) => (await sql.query("select count(*)::int n from notifications where user_id = $1 and type = $2", [userId, type]))[0].n;

let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };
const doc = (...content) => JSON.stringify({ type: "doc", content });
const para = (t) => ({ type: "paragraph", content: [{ type: "text", text: t }] });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let aId, bId;

try {
  const reg = async (u) => `session=${sessionOf((await submit("/register", 'name="username"', u)).res)}`;
  let ca = await reg(A);
  const cb = await reg(B);
  [{ id: aId }] = await sql.query("select id from users where email = $1", [A.email]);
  [{ id: bId }] = await sql.query("select id from users where email = $1", [B.email]);

  // A publishes a post, saves a draft
  let r = await submit("/write", 'name="title"', { title: `Feature post ${stamp}`, content: doc(para("hello")), tags: "", intent: "publish" }, ca);
  const slug = r.location.replace("/p/", "");
  const [{ id: postId }] = await sql.query("select id from posts where slug = $1", [slug]);
  r = await submit("/write", 'name="title"', { title: `Feature draft ${stamp}`, content: doc(para("draft")), tags: "", intent: "save" }, ca);
  const draftId = Number(r.location.match(/\d+$/)[0]);

  // ======== bookmarks ========
  let t = await action("toggleBookmark", [postId], cb);
  check("bookmark -> saved", t.text.includes('"bookmarked":true'));
  check("post page shows it saved for B", (await get(`/p/${slug}`, cb)).includes('aria-label="Remove from reading list"'));
  check("reading list shows the post", (await get("/me/bookmarks", cb)).includes(`Feature post ${stamp}`));
  check("A's reading list doesn't (private)", !(await get("/me/bookmarks", ca)).includes(`Feature post ${stamp}`));
  t = await action("toggleBookmark", [draftId], cb);
  check("can't bookmark a draft", t.text.includes("Post not found"));
  t = await action("toggleBookmark", [postId], "");
  check("guest bookmark -> /login", (t.redirect ?? "").startsWith("/login"));
  t = await action("toggleBookmark", [postId], cb);
  check("toggle again -> removed", t.text.includes('"bookmarked":false') && !(await get("/me/bookmarks", cb)).includes(`Feature post ${stamp}`));

  // ======== notifications ========
  await action("toggleLike", [postId], cb);
  check("like -> A gets a like notification", (await notes(aId, "like")) === 1);
  check("header bell shows unread count", (await get("/feed", ca)).includes('aria-label="Notifications, 1 unread"'));
  await action("toggleLike", [postId], cb);
  check("unlike -> notification taken back", (await notes(aId, "like")) === 0);
  await action("toggleLike", [postId], ca);
  check("liking your own post -> no notification", (await notes(aId, "like")) === 0);
  await action("toggleLike", [postId], ca);

  await submit(`/p/${slug}`, 'name="body"', { postId, body: "Nice post!" }, cb);
  check("comment -> A gets a comment notification", (await notes(aId, "comment")) === 1);
  let page = await get("/notifications", ca);
  check("notifications page lists it with the comment text", page.includes(`@${B.username}`) && page.includes("commented on") && page.includes("Nice post!"));
  const [{ id: commentId }] = await sql.query("select id from comments where post_id = $1", [postId]);
  await submit(`/p/${slug}`, "Delete your comment", { id: commentId }, cb);
  check("deleting the comment removes its notification (cascade)", (await notes(aId, "comment")) === 0);

  await action("toggleFollow", [aId], cb);
  check("follow -> A gets a follow notification", (await notes(aId, "follow")) === 1);
  check("unread count before marking", (await unread(aId)) === 1);
  await action("markAllRead", [], cb);
  check("B marking 'all read' doesn't touch A's", (await unread(aId)) === 1);
  await action("markAllRead", [], ca);
  check("A marks all read -> 0 unread, badge gone", (await unread(aId)) === 0 && (await get("/feed", ca)).includes('aria-label="Notifications"'));
  await action("toggleFollow", [aId], cb);
  check("unfollow -> notification removed", (await notes(aId, "follow")) === 0);

  // ======== images in posts ========
  const img = await upload(`posts/${aId}/image.png`, new Blob([PNG], { type: "image/png" }), {
    access: "public", handleUploadUrl: `${BASE}/api/post-image/upload`, headers: { cookie: ca }, contentType: "image/png",
  });
  check("post image uploads to posts/<me>/", img.url.includes(`/posts/${aId}/`));
  const withImage = doc(para("look:"), { type: "image", attrs: { src: img.url, alt: "a tiny pixel" } });
  r = await submit("/write", 'name="title"', { title: `Image post ${stamp}`, content: withImage, tags: "", intent: "publish" }, ca);
  const imgSlug = r.location?.replace("/p/", "");
  page = imgSlug ? await get(`/p/${imgSlug}`) : "";
  check("post with own image publishes + renders <img> with alt", page.includes(`src="${img.url}"`) && page.includes('alt="a tiny pixel"') && page.includes('loading="lazy"'));
  r = await submit("/write", 'name="title"', { title: "hotlink", content: doc({ type: "image", attrs: { src: "https://evil.example.com/pixel.gif" } }), tags: "", intent: "save" }, ca);
  check("foreign image src rejected", r.html.includes("Images have to be uploaded"));
  r = await submit("/write", 'name="title"', { title: "borrowed", content: withImage, tags: "", intent: "save" }, cb);
  check("can't publish someone else's uploaded image", r.html.includes("Images have to be uploaded"));
  let refused = false;
  try { await upload(`posts/${aId}/x.png`, new Blob([PNG], { type: "image/png" }), { access: "public", handleUploadUrl: `${BASE}/api/post-image/upload`, headers: { cookie: cb }, contentType: "image/png" }); } catch { refused = true; }
  check("can't upload into another user's posts folder", refused);

  // ======== account: email ========
  const NEWMAIL = `ftz_${stamp}@example.com`;
  r = await submit("/settings/account", 'name="email"', { email: NEWMAIL, currentPassword: "wrong-password" }, ca);
  check("email change needs the right current password", r.html.includes("not your current password"));
  r = await submit("/settings/account", 'name="email"', { email: B.email, currentPassword: A.password }, ca);
  check("can't take another account's email", r.html.includes("already exists"));
  r = await submit("/settings/account", 'name="email"', { email: NEWMAIL.toUpperCase(), currentPassword: A.password }, ca);
  const [{ email: savedMail }] = await sql.query("select email from users where id = $1", [aId]);
  check("email updated (lowercased)", savedMail === NEWMAIL, savedMail);
  A.email = NEWMAIL;

  // ======== account: password + session revocation ========
  const otherDevice = `session=${sessionOf((await submit("/login", 'name="email"', { email: A.email, password: A.password })).res)}`;
  check("second session (other device) works", (await get("/settings/account", otherDevice)).includes("Change password"));
  r = await submit("/settings/account", 'name="newPassword"', { currentPassword: A.password, newPassword: "brand-new-pass-1", confirmPassword: "nope" }, ca);
  check("password confirmation must match", r.html.includes("don&#x27;t match") || r.html.includes("don't match"));
  r = await submit("/settings/account", 'name="newPassword"', { currentPassword: A.password, newPassword: "brand-new-pass-1", confirmPassword: "brand-new-pass-1" }, ca);
  const fresh = sessionOf(r.res);
  check("password change re-issues this device's session", Boolean(fresh));
  ca = `session=${fresh}`;
  check("this device stays signed in", (await get("/settings/account", ca)).includes("Change password"));
  check("OTHER device is signed out (token_version bumped)", !(await get("/settings/account", otherDevice)).includes("Change password"));
  t = await action("toggleBookmark", [postId], otherDevice);
  check("revoked session can't use actions either", (t.redirect ?? "").startsWith("/login"));
  r = await submit("/login", 'name="email"', { email: A.email, password: A.password });
  check("old password no longer logs in", r.html.includes("Invalid email or password"));
  r = await submit("/login", 'name="email"', { email: A.email, password: "brand-new-pass-1" });
  check("new password logs in", r.location === "/feed");

  for (let i = 0; i < 5; i++) await submit("/settings/account", 'name="email"', { email: "x@example.com", currentPassword: "bad" }, ca);
  r = await submit("/settings/account", 'name="email"', { email: "x@example.com", currentPassword: "brand-new-pass-1" }, ca);
  check("6th try after 5 wrong current passwords is blocked", r.html.includes("Too many wrong passwords"));
} catch (err) {
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  for (const id of [aId, bId].filter(Boolean)) {
    for (const prefix of [`posts/${id}/`, `avatars/${id}/`]) {
      const { blobs } = await list({ prefix });
      if (blobs.length) await del(blobs.map((b) => b.url));
    }
    await sql.query("delete from auth_attempts where key like $1", [`%:${id}`]);
  }
  await sql.query("delete from users where id = any($1)", [[aId, bId].filter(Boolean)]);
  console.log("\ncleanup: test users, their posts/notifications/bookmarks (cascade) and blobs removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
