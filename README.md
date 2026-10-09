# simple-blog-app

**Or: how I stopped paralysis by analysis and started letting the robot drive.**

This repository exists because I wanted to find out what "agentic coding" actually feels like, and I didn't want to find out by reading another nonsensical thread titled *"I replaced my entire engineering team with 7 AI agents (here's what happened 👇)"* or another biased piece of completely AI-generated "here's what to learn" insanity.

## The Big Bang

On **September 3rd**, a fresh batch of models dropped:

- **Claude Fable 5.1**
- **Claude Opus 5.5**
- **Claude Sonnet 5.5**
- **Claude Haiku 5.5**

I was checking [https://llm-stats.com/](https://llm-stats.com/) and noticed just how insanely high GPT-6 Astra ranked in the coding benchmarks (Opus 5.5 has overcome it, you dirty dog Opus). Just one issue: I'm Mr. Krabs. Yes, Claude Pro is "only $20." That is still $20 I could have and hold on to, thank you. So I started with [z.ai](https://z.ai) instead, since it was free (free as in free speech, not free beer... wait, that doesn't work, anyways free as in free beer. Shoutout Richard Stallman), and I built a Wii Play style tanks game that runs in the browser (I should link this) and by build I mean I gave z.ai literally one slightly half-ass written prompt something like "build wii play tanks in the browser and make it to where you can play locally against a friend on the same keyboard or against an ai" and it worked exponentially better than I could've imagined. So I did what everyone does next, and saw if it could build Terraria as well. This then led to somewhat of an existential crisis and an "oh no" as well as the same amount of "oh yes, finally I am a game dev." So weeks later, with a suggestion from my soon-to-be brother-in-law, I took the experiment into Claude Code in the terminal for REAL. I don't know why or how it took me so long to just drop the $20. I’ve tried agentic coding in the past via Google's Antigravity with some great results, but using the agent right inside the terminal with my 'SUPER COOL' VS Code setup, complete with Vim motions and a settings.json file bloated with way too many customizations, is just infinitely more fun and useful.

## What this Application is

A blog app. Users can register, log in, write posts, follow each other, comment, and scroll a discover page of top posts sorted by tag. Nothing here will revolutionize anything. A blog is the perfect guinea pig: it's boring enough that I can tell when the agent is wrong, and big enough (auth, database, UI, a rich text editor) that it can't fake its way through.

I also want to begin posting on here as somewhat of a brain dump. For example my thoughts on "my big TOE" or why Rust is fun to use. Or why I can't stop doing 2 week deep dives into random languages that i never will ever use at work. 

The real project is going to be **me getting good at working with an agent in the terminal.** The blog is just the first thing I could think of. I think this came to mind from the 

## What IS software engineering?
*(Imagine an office cutaway where I turn and stare directly into the camera)*

I love AI and agentic coding. However, I also keep fighting the urge to **do it the right way** (if this is even the right way anymore, I honestly can't tell): close the laptop, go learn the whole thing in depth, and write every line by hand. I still believe that for foundational concepts, you have to go learn and type things out yourself. But at the same time, it would be silly not to use AI to "explain it like I'm five, then in great technical depth," walk through worked examples like a math problem, or have it help me Feynman a concept. And the visuals are seriously such a game changer that it's not even funny.

Quick notes on things I intend to actually get good at:

* **Skills and memory.**
* **System design:** Since this is likely to be the only real separator between vibe coding and actual engineering in the near future. 
* **Efficient token usage.**
* **Choosing the correct model.**
* **Code and PR review:** I mean, for real, you can crank out so many PRs now.

This somewhat reminds me of the book *Thinking, Fast and Slow* by Daniel Kahneman. Fast thinking in coding is likely still going to come from traditional "code smell," but now it also requires a sense for "agent smell." Slow thinking, on the other hand, fits right into the process that happens during the planning phase or the "explore and plan" phase of the "explore -> plan -> code -> commit" loop that Anthropic talks about in their course. (Wait, isn't this just engineering though? Surely people have been exploring, planning, coding, and committing for all of eternity.) And then the review phase matters just as much, too.

## What's built so far

- [x] Register / login / logout (JWT in an httpOnly cookie, bcrypt, no Redis, no rotation, no drama)
- [x] Light and dark theme with a sun/moon toggle (paper-and-ink palette, terracotta accent, contrast checked)
- [x] Neon Postgres + Drizzle schema and migrations
- [ ] Write posts with a simple rich text editor
- [ ] Tags
- [ ] Comments
- [ ] Follow users
- [ ] Discover page (top posts, tag filtering)
- [] Cool landing page that explains the website 
- [] Creative name other than "Blog"
- [] add hover:cursor-pointer to the light/dark toggle

## Run it yourself

You'll need Node 22+ and a free [Neon](https://neon.com) database. 

```bash
git clone https://github.com/CPoooo/simple-blog-app.git
cd simple-blog-app
npm install
```

Create a `.env.local` in the project root:

```bash
# Your Neon connection string
DATABASE_URL=postgresql://...

# Any long random string. This one works:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=
```

Create the tables, then start it:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and register an account.

## Stack

Next.js (App Router, Server Actions) · TypeScript (strict) · Drizzle ORM · Neon Postgres · shadcn/ui · Tailwind CSS · Tiptap · Zod · deploys to Vercel.

## What I Want to Do with This Blog

Once it's done and deployed, this becomes the place I write about what I'm doing and learning: code, agents, mistakes, baseball, hybrid training, bodybuilding, ultramarathons, David Goggins (someones gotta carry the boats dangit), hopefully contributions from others (I would love programmers WAY SMARTER then me to debate/roast anything I have to say in this software space), what I am building, programming language theory (why Rust feels so nice, OCaml talks, etc.), and all the "out there" ideas, like whether the universe is an eternal consciousness or awareness that had only one question to answer (*why am I here?*) and so fragmented itself in a way that it forgot, plus the Weck Method, and everything in between.

---

*No agents were harmed in the making of this README. Several were politely corrected.*
