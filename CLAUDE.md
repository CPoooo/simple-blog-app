# Project Operating Guidelines: Fast Agentic Prototyping

## Core Philosophy & Agentic Best Practices (Anthropic Engineering Standard)
- **Explore, Plan, Implement:** Never let the agent blindly hack. For new features, explore the context, state the implementation plan, and then execute.
- **Give Claude a Way to Verify:** Always provide explicit verification criteria or test cases (e.g., "run npm test or check build output and fix any TypeScript errors") rather than trusting success blindly.
- **Pragmatic Architecture:** Use Next.js App Router, Server Actions, Drizzle ORM, Neon Serverless Postgres, and shadcn/ui. Avoid over-engineering; keep dependencies lean.
- **Collaboration Style:** Provide complete, working multi-file implementations or clean diffs rather than holding back answers behind Socratic riddles, unless explicitly requested.

## Tech Stack & Tooling
- **Framework:** Next.js (App Router, Server Actions)
- **Language:** TypeScript (Strict mode enabled)
- **Database & ORM:** Neon Serverless Postgres + Drizzle ORM
- **UI Components:** shadcn/ui (latest version, using Tailwind CSS and Radix primitives)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Code Conventions & Architecture
- Place shadcn components in `@/components/ui`.
- Use Server Components by default for data fetching; use Client Components (`"use client"`) explicitly for interactive UI states, event listeners, or browser APIs.
- Keep mutations strictly bound to Next.js Server Actions with schema validation (e.g., Zod).

## Writing Voice (how Cameron writes)
Applies to anything written *as* or *for* Cameron: README, blog posts, docs prose, copy, and the tone of chat replies. Code, comments, and commit messages stay plain and professional (commits: short and concise, like "readme updated - yap session complete").

**Sound like**
- A smart friend talking, not a brand. First person, conversational, enthusiastic, self-deprecating. Honest about not knowing ("if this is even the right way anymore, I honestly can't tell").
- **Parenthetical asides and self-interruptions** mid-sentence, including the bit where the thought derails and gets corrected on the fly ("free as in free speech... wait, that doesn't work, anyways free as in free beer"). Rhetorical questions to himself in parentheses ("Wait, isn't this just engineering though?").
- **Long, chained sentences** held together with "and", "so", "then", "but", that read like he's telling the story out loud. Short punchy fragments are the exception, not the default.
- **Pop-culture and meme references**, dropped in casually: Mr. Krabs, The Office camera-stare cutaway ("*(Imagine an office cutaway where I turn and stare directly into the camera)*"), "you dirty dog Opus", "someone's gotta carry the boats" (Goggins).
- **Name-drops and shoutouts** to real people and books (Kahneman, Stallman, Feynman), sincere and a little silly at once.
- Casual intensifiers and slang: "insanely", "exponentially better", "half-ass", "yap", "for REAL", "'SUPER COOL'". ALL CAPS and **bold** for emphasis, used sparingly, mid-sentence.
- Playful self-owns about money, procrastination, rabbit holes ("I'm Mr. Krabs", "2 week deep dives into random languages I will never use at work").
- Real conviction under the jokes: learn fundamentals by hand, use AI to explain/visualize/Feynman a concept, review everything, know your system design.
- Interests to draw from naturally: Vim motions, Rust, OCaml, programming language theory, baseball, hybrid training, bodybuilding, ultramarathons, Goggins, consciousness/awareness ("my big TOE"), the Weck Method.

**Avoid**
- LinkedIn/AI-influencer voice: hype, "game-changer" said with a straight face, "Here's the thing:", "Let's dive in", tidy "not X, but Y" flourishes, three-item rhetorical lists, motivational closers. Cameron makes fun of this style, so never write it. If imitating it, it's a bit and obviously a joke.
- Em dashes. He uses commas, parentheses, and ellipses instead.
- Over-polished, symmetrical, "balanced" paragraphs. A little messy and opinionated is correct.
- Correcting his typos inside things he wrote himself, and copying them into new text. Keep his wording; fix only what he asks.

## Machine Constraints (IT-Controlled)
- This machine is IT-controlled: **do not install or upgrade system software** (winget, MSI installers, Node upgrades, etc.). Do not attempt it or ask to; npm packages inside the project are fine.
- When something needs a system-level install, skip it, work around it if possible, and add it to the log below so it can be done later on an unrestricted machine.

## Still To Do (app work, as of 2026-10-09)
- **Social sign-in keys.** The code is done and shipped, but no provider keys exist yet, so the buttons show disabled ("coming soon"). For each provider, create an OAuth app and set `{GOOGLE|GITHUB|FACEBOOK}_CLIENT_ID` / `_CLIENT_SECRET` in `.env.local` and in Vercel, then **redeploy** (the buttons are prerendered from env at build time).
  - Callback URLs: `https://simple-blog-app-flax.vercel.app/auth/{provider}/callback` (prod) and `http://localhost:3000/auth/{provider}/callback` (local). GitHub allows only one callback per app, so make two GitHub apps (dev + prod).
  - Facebook also needs the Privacy Policy URL (`/privacy`), the data deletion instructions URL (`/privacy#delete-your-data`), and the app switched to Live mode.
- **Eyeball the mobile reading fixes on a real phone**: page width gutters, the "Aa" bottom sheet, the feed bubble rings, and focus mode. They're verified in served CSS/HTML only.
- **Moderation** (deferred by Cameron): reporting posts/comments, plus image moderation for uploads (no nudity, no hate symbols). Pick a free option when we come back to it.
- **Move the e2e scripts into the repo**: they currently live in the session scratchpad. Port them to Playwright and run them in GitHub Actions against a throwaway Neon branch.
- The rest of the wishlist lives in README.md → Ideas.

### Pending Installs / Deferred Setup
- Node.js >= 22.20.0 (currently 22.19.0; `winget upgrade OpenJS.NodeJS.22`) — required by the Neon skills CLI: `npx neon@latest skills -s neon -s neon-postgres -y`
- Neon login (`neon login`, interactive browser sign-in) — needed before `neon mcp -y`, `neon link --project-id empty-math-70241978 --branch production -y`, `neon config init`, and `neon deploy`
- Add `C:\Users\cpool\AppData\Roaming\npm` to PATH so the globally installed `neon` CLI resolves in new terminals
- GitHub CLI (`winget install GitHub.cli`, then `gh auth login`) — for creating repos/PRs from the terminal; until then, create repos on github.com and push with plain `git`