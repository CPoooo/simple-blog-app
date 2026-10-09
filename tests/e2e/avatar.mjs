import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";

// Load @vercel/blob from the project (not from this scratch folder).
const req = createRequire(import.meta.url);
const { upload } = req("@vercel/blob/client");
const { head, list, del } = req("@vercel/blob");

const BASE = "http://localhost:3123";
const sql = neon(process.env.DATABASE_URL);
const stamp = Date.now().toString(36);
const mk = (n) => ({ username: `av${n}_${stamp}`, email: `av${n}_${stamp}@example.com`, password: "correct-horse-1" });
const A = mk("a"), B = mk("b");
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
async function action(name, args, cookie) {
  const res = await fetch(BASE + "/discover", {
    method: "POST",
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", cookie },
    body: JSON.stringify(args),
  });
  return res.text();
}
// The browser path: ask our route for a token, then PUT straight to Blob.
const send = (pathname, bytes, type, cookie) =>
  upload(pathname, new Blob([bytes], { type }), { access: "public", handleUploadUrl: `${BASE}/api/avatar/upload`, headers: { cookie }, contentType: type });
const rejects = async (p) => { try { await p; return false; } catch { return true; } };
const exists = async (url) => { try { await head(url); return true; } catch { return false; } };

// A real 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let failed = 0;
const check = (label, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`); };
let aId, bId;

try {
  const ca = await register(A), cb = await register(B);
  [{ id: aId }] = await sql.query("select id from users where email = $1", [A.email]);
  [{ id: bId }] = await sql.query("select id from users where email = $1", [B.email]);

  // ---- happy path ----
  const first = await send(`avatars/${aId}/avatar.png`, PNG, "image/png", ca);
  check("upload goes straight to our Blob store", /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/avatars\//.test(first.url), first.url.replace(/\/avatars\/.*/, "/avatars/…"));
  let out = await action("setAvatar", [first.url], ca);
  const [row] = await sql.query("select avatar_url from users where id = $1", [aId]);
  check("setAvatar saves the URL", out.includes(`"avatarUrl":"${first.url}"`) && row.avatar_url === first.url);
  const img = await fetch(first.url);
  check("file is publicly served as an image", img.ok && (img.headers.get("content-type") ?? "").startsWith("image/png"));
  const profile = await (await fetch(`${BASE}/u/${A.username}`)).text();
  const optimized = profile.match(/src="(\/_next\/image\?url=[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  check("profile renders it via next/image", Boolean(optimized) && decodeURIComponent(optimized).includes(first.url));
  const viaNext = optimized ? await fetch(BASE + optimized) : null;
  check("next/image optimizer serves it (remotePatterns ok)", viaNext?.ok === true, String(viaNext?.status));

  // ---- who can upload what ----
  check("guest can't get an upload token", await rejects(send(`avatars/${aId}/x.png`, PNG, "image/png", "")));
  check("can't upload into someone else's folder", await rejects(send(`avatars/${bId}/x.png`, PNG, "image/png", ca)));
  check("non-image type refused", await rejects(send(`avatars/${aId}/x.txt`, Buffer.from("hello"), "text/plain", ca)));
  check("file over 2MB refused", await rejects(send(`avatars/${aId}/big.png`, Buffer.alloc(2 * 1024 * 1024 + 10, 1), "image/png", ca)));

  // ---- what URL can be saved ----
  out = await action("setAvatar", ["https://evil.example.com/me.png"], ca);
  check("foreign URL rejected", out.includes("didn't come from here") || out.includes("didn\\u0027t come from here"));
  const bUpload = await send(`avatars/${bId}/avatar.png`, PNG, "image/png", cb);
  out = await action("setAvatar", [bUpload.url], ca);
  check("can't claim another user's uploaded file", out.includes("come from here"));
  const [still] = await sql.query("select avatar_url from users where id = $1", [aId]);
  check("rejected saves left the avatar alone", still.avatar_url === first.url);

  // ---- replace + remove clean up old files ----
  const second = await send(`avatars/${aId}/avatar.png`, PNG, "image/png", ca);
  check("each upload gets a new URL (random suffix)", second.url !== first.url);
  await action("setAvatar", [second.url], ca);
  check("replacing deletes the old file", !(await exists(first.url)) && (await exists(second.url)));
  out = await action("removeAvatar", [], ca);
  const [gone] = await sql.query("select avatar_url from users where id = $1", [aId]);
  check("remove clears the URL and deletes the file", gone.avatar_url === null && !(await exists(second.url)));
} catch (err) {
  // A crash means the remaining checks never ran: that's a failure, not a pass.
  failed++;
  console.log(`FAIL  test aborted: ${err.message}`);
} finally {
  for (const id of [aId, bId].filter(Boolean)) {
    const { blobs } = await list({ prefix: `avatars/${id}/` });
    if (blobs.length) await del(blobs.map((b) => b.url));
  }
  await sql.query("delete from users where email = any($1)", [[A.email, B.email]]);
  console.log("\ncleanup: test users + their blobs removed");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
}
