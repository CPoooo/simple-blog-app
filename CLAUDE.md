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

## Machine Constraints (IT-Controlled)
- This machine is IT-controlled: **do not install or upgrade system software** (winget, MSI installers, Node upgrades, etc.). Do not attempt it or ask to; npm packages inside the project are fine.
- When something needs a system-level install, skip it, work around it if possible, and add it to the log below so it can be done later on an unrestricted machine.

### Pending Installs / Deferred Setup
- Node.js >= 22.20.0 (currently 22.19.0; `winget upgrade OpenJS.NodeJS.22`) — required by the Neon skills CLI: `npx neon@latest skills -s neon -s neon-postgres -y`
- Neon login (`neon login`, interactive browser sign-in) — needed before `neon mcp -y`, `neon link --project-id empty-math-70241978 --branch production -y`, `neon config init`, and `neon deploy`
- Add `C:\Users\cpool\AppData\Roaming\npm` to PATH so the globally installed `neon` CLI resolves in new terminals
- GitHub CLI (`winget install GitHub.cli`, then `gh auth login`) — for creating repos/PRs from the terminal; until then, create repos on github.com and push with plain `git`