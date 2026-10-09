// No provider keys configured: buttons show disabled, errors render on both pages; mobile reading fixes are served.
const BASE = "http://localhost:3123";
let failed = 0;
const check = (l, ok, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? "  -> " + x : ""}`); };
const page = async (p) => (await (await fetch(BASE + p)).text()).replaceAll("<!-- -->", "");

try {
  const login = await page("/login");
  check("login: all three providers shown", ["Google", "GitHub", "Facebook"].every((p) => login.includes(`Continue with ${p}`)));
  check("login: disabled without keys (no live /auth links)", !/href="\/auth\/(google|github|facebook)"/.test(login) && (login.match(/aria-disabled="true"/g) ?? []).length >= 3);
  check("login: 'coming soon' note + email divider", login.includes("Social sign-in is coming soon") && login.includes("or with email"));
  const register = await page("/register");
  check("register: 'Sign up with' variant", ["Google", "GitHub", "Facebook"].every((p) => register.includes(`Sign up with ${p}`)));
  check("register: shows OAuth errors", (await page("/register?oauth_error=cancelled")).includes("Sign-in was cancelled"));
  check("login: unknown error code falls back to generic", (await page("/login?oauth_error=zzz")).includes("couldn't reach the provider"));
  check("disabled provider start route -> 404", (await fetch(BASE + "/auth/google", { redirect: "manual" })).status === 404);

  const cssLinks = [...login.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  const css = (await Promise.all(cssLinks.map(async (h) => (await fetch(BASE + h)).text()))).join("\n");
  check("mobile: per-width reading gutter in served CSS", css.includes("--read-gutter") && /max-width:\s*639px/.test(css), `${cssLinks.length} css files`);
  check("mobile: reading sheet styles present", css.includes("reading-sheet"));
} catch (err) {
  failed++;
  console.log(`FAIL  aborted: ${err.message}`);
}
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
