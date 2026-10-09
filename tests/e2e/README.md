# End-to-end tests

Plain Node scripts that drive the real app over HTTP (like a browser with JavaScript off) against a production build and the real Neon database. Every suite creates its own throwaway users (`*_<timestamp>@example.com`) and deletes them when it's done.

```bash
npm run build
npm run start -- -p 3123     # leave running in another terminal
npm run test:e2e             # all suites
npm run test:e2e -- feed social   # just these
```

Needs `.env.local` (`DATABASE_URL`, `JWT_SECRET`, and `BLOB_READ_WRITE_TOKEN` for the avatar/image suites). `navbar-html` also reads the gitignored `seed-credentials.local.json`, so seed the database first (`npm run db:seed`).

## How they work
- Forms are submitted the progressive-enhancement way: read the hidden `$ACTION_*` fields out of the page HTML, then POST them with our values.
- Server actions that have no form are called by ID, looked up in `.next/server/server-reference-manifest.json` (so it has to be the same build that's running).
- Sessions are either taken from `Set-Cookie` or minted directly with `jose` and `JWT_SECRET` (the `v` claim must match `users.token_version`).
- "Not found" pages are detected by `<meta name="robots" content="noindex">`, not by text (the not-found text is in every RSC payload).
- With Suspense, the fallback is rendered before the streamed content, so checks use the *last* match in the HTML.
- Each suite prints `PASS`/`FAIL` lines and ends with `ALL CHECKS PASSED` or `N CHECK(S) FAILED`. The runner treats a crash or a missing summary as a failure.

## oauth-http (run by hand)
Exercises the real OAuth start/callback routes, so it needs a build with **fake** provider keys:

```powershell
$env:GOOGLE_CLIENT_ID="test-google-id"; $env:GOOGLE_CLIENT_SECRET="x"
$env:GITHUB_CLIENT_ID="test-github-id"; $env:GITHUB_CLIENT_SECRET="x"
$env:FACEBOOK_CLIENT_ID="test-facebook-id"; $env:FACEBOOK_CLIENT_SECRET="x"
npm run build; npm run start -- -p 3123
npm run test:e2e -- oauth-http
```

Rebuild without the fake keys afterwards (the provider buttons are baked in at build time). `oauth-ui-mobile` expects the no-keys build, so it fails on the fake-keys one, which is expected.
