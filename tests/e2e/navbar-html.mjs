// What the server actually sends for the navbar, signed out and signed in.
import { readFileSync } from "node:fs";
const BASE = "http://localhost:3123";
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };

/** Labels in order inside the <nav aria-label="Main"> whose classes contain `marker`. */
function tabs(html, marker) {
  const navs = html.split('<nav aria-label="Main"').slice(1).map((n) => n.split("</nav>")[0]);
  const nav = navs.filter((n) => n.includes(marker)).at(-1); // last = streamed result, first = Suspense fallback
  if (!nav) return null;
  return [...nav.matchAll(/<a [^>]*href="(\/[a-z-]+)"/g)].map((m) => m[1]);
}

// signed out
let h = await (await fetch(BASE + "/discover")).text();
check("signed out, top tabs: Discover · For you · Surprise", JSON.stringify(tabs(h, "md:flex")) === JSON.stringify(["/discover", "/for-you", "/surprise"]), String(tabs(h, "md:flex")));
check("signed out, bottom bar: same 3", JSON.stringify(tabs(h, "md:hidden")) === JSON.stringify(["/discover", "/for-you", "/surprise"]), String(tabs(h, "md:hidden")));
const currentIn = (html, marker) => {
  const nav = html.split('<nav aria-label="Main"').slice(1).map((n) => n.split("</nav>")[0]).filter((n) => n.includes(marker)).at(-1) ?? "";
  return [...nav.matchAll(/<a [^>]*>/g)].filter((m) => m[0].includes('aria-current="page"')).map((m) => m[0].match(/href="([^"]+)"/)[1]);
};
check("on /discover exactly the Discover tab is current (top + bottom)", JSON.stringify(currentIn(h, "md:flex")) === '["/discover"]' && JSON.stringify(currentIn(h, "md:hidden")) === '["/discover"]', `${currentIn(h, "md:flex")} | ${currentIn(h, "md:hidden")}`);
const post = await (await fetch(BASE + "/tag/aliens")).text();
check("on a tag page no tab is current", currentIn(post, "md:flex").length === 0);

// signed in
const { accounts } = JSON.parse(readFileSync("./seed-credentials.local.json", "utf8"));
const page = await (await fetch(BASE + "/login")).text();
const body = new FormData();
for (const m of page.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) { const n = m[0].match(/name="([^"]*)"/)?.[1]; if (n?.startsWith("$ACTION")) body.append(decode(n), decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "")); }
body.append("email", "vim_victor@seed.example.com"); body.append("password", accounts["vim_victor@seed.example.com"]);
const res = await fetch(BASE + "/login", { method: "POST", body, redirect: "manual" });
const cookie = `session=${res.headers.get("set-cookie").match(/session=([^;]*)/)[1]}`;
h = await (await fetch(BASE + "/following", { headers: { cookie } })).text();
const want = ["/feed", "/following", "/for-you", "/discover", "/surprise"];
check("signed in, top tabs in order: Feed · Following · For you · Discover · Surprise", JSON.stringify(tabs(h, "md:flex")) === JSON.stringify(want), String(tabs(h, "md:flex")));
check("signed in, bottom bar: same 5", JSON.stringify(tabs(h, "md:hidden")) === JSON.stringify(want), String(tabs(h, "md:hidden")));
check("Surprise is a plain <a> (never prefetched)", !/<a [^>]*href="\/surprise"[^>]*data-prefetch/.test(h) && h.includes('href="/surprise"'));
check("bottom bar hides in focus mode (site-chrome) and on desktop (md:hidden)", /<nav aria-label="Main" class="site-chrome [^"]*md:hidden/.test(h));
check("on /following exactly the Following tab is current", JSON.stringify(currentIn(h, "md:flex")) === '["/following"]', String(currentIn(h, "md:flex")));
const header = h.split("<header")[1].split("</header>")[0];
const outsideTabs = header.replace(/<nav aria-label="Main"[\s\S]*?<\/nav>/, "");
check("header has no stray Discover/Following/For you links outside the tabs", !/href="\/(discover|following|for-you)"/.test(outsideTabs));
check("right side keeps Search, Write, bell", h.includes('aria-label="Search"') && h.includes('aria-label="Write a post"') && h.includes('aria-label="Notifications'));
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
