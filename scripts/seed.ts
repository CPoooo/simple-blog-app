/**
 * Dummy data for local testing: 5 users, a dozen posts, follows, likes, comments.
 *
 *   npm run db:seed          add the seed data (refuses if it's already there)
 *   npm run db:seed:reset    remove it, then add it fresh
 *   npm run db:unseed        remove it
 *   npm run db:seed:rotate   give every seed account a new password, changing nothing else
 *
 * Passwords are random per account and live in seed-credentials.local.json at the
 * repo root. That file is gitignored: read it to log in as anyone, but it never
 * gets committed. (An earlier version hard-coded one shared password; it's in git
 * history, which is exactly why rotation exists.)
 *
 * Every seed account uses an @seed.example.com email, which is how removal finds
 * them; deleting a user cascades to their posts, likes, comments, and follows.
 * Real accounts are never touched.
 *
 * Deliberately NOT a Drizzle migration: migrations run in every environment
 * forever, and fake users with a known password don't belong in production.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, like, sql } from "drizzle-orm";
import { comments, follows, likes, postTags, posts, tags, userInterests, users } from "../src/db/schema";
import { normalizeTag } from "../src/lib/tags";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (.env.local)");
const db = drizzle(neon(process.env.DATABASE_URL));

const SEED_DOMAIN = "seed.example.com";
const CREDENTIALS_FILE = join(process.cwd(), "seed-credentials.local.json");

type Handle = "rae" | "victor" | "ula" | "dan" | "mo";

const people: Record<Handle, { username: string; bio: string }> = {
  rae: { username: "rustacean_rae", bio: "Borrow checker apologist. Writes about Rust, OCaml, and type systems." },
  victor: { username: "vim_victor", bio: "hjkl or bust. Currently letting an AI agent drive and pretending I'm fine with it." },
  ula: { username: "ultra_ula", bio: "Runs 100 milers, lifts heavy, sits in ice water on purpose. Wim Hof breathing evangelist." },
  dan: { username: "dugout_dan", bio: "Baseball nerd. Will explain spin rate (or the odds of alien life) whether you asked or not." },
  mo: { username: "mindful_mo", bio: "Consciousness, metacognition, yoga nidra, and the occasional existential crisis." },
};

type SeedPost = {
  key: string;
  author: Handle;
  title: string;
  tags: string[];
  /** Days ago it was published; null = draft. Spread out so Discover's time decay has something to rank. */
  daysAgo: number | null;
  body: string[]; // "## " prefix = heading, otherwise a paragraph
  likedBy: Handle[];
  comments?: [Handle, string][];
};

const seedPosts: SeedPost[] = [
  {
    key: "agent",
    author: "victor",
    title: "Letting an agent drive: week one",
    tags: ["agentic-coding", "ai"],
    daysAgo: 5,
    body: [
      "I gave an AI agent the keyboard for a week. Not autocomplete, the actual keyboard. It planned, it wrote, it ran the tests, and I mostly reviewed and said no a lot.",
      "## What surprised me",
      "The code was fine. The hard part was me. Writing down what done looks like is way harder than writing the code yourself, and it turns out I had been skipping that step for years.",
      "Week two goal: stop reflexively rewriting everything it writes just to feel useful.",
    ],
    likedBy: ["rae", "ula", "dan", "mo"],
    comments: [
      ["rae", "Week two is when it starts arguing with you about your schema. Ask me how I know."],
      ["victor", "It was right about the schema though."],
      ["mo", "Does the agent know it's driving? Asking for a friend. The friend is consciousness."],
    ],
  },
  {
    key: "borrow",
    author: "rae",
    title: "The borrow checker is a love language",
    tags: ["rust", "programming-languages"],
    daysAgo: 1,
    body: [
      "Every Rust beginner has the same arc: rage, bargaining, and then a strange calm where the compiler feels less like a cop and more like a friend who cares about you a little too much.",
      "## Ownership is just honesty",
      "Who owns this data? Who can change it? For how long? Other languages let you not answer those questions. Rust makes you answer them up front, which is annoying right up until it saves you from a 3am bug.",
    ],
    likedBy: ["victor", "mo", "dan"],
    comments: [
      ["victor", "Love language or hostage situation, pick one."],
      ["rae", "Why not both"],
    ],
  },
  {
    key: "reader",
    author: "mo",
    title: "Who is reading this sentence?",
    tags: ["consciousness", "philosophy"],
    daysAgo: 4,
    body: [
      "Right now, something is reading these words. Not your eyes, they just catch light. Not your neurons exactly, they just fire. Something is having the experience of reading.",
      "That something is the strangest thing in the universe and we mostly ignore it to check our phones.",
      "## The hard problem, softly",
      "We can explain how the brain processes words. Nobody can explain why it feels like anything at all. I find that more exciting than unsettling. Mostly.",
    ],
    likedBy: ["rae", "victor", "ula"],
    comments: [
      ["ula", "Read this at mile 40 and had a moment."],
      ["rae", "Is the sentence reading me back?"],
    ],
  },
  {
    key: "mile62",
    author: "ula",
    title: "Mile 62 is where the philosophy starts",
    tags: ["ultramarathon", "running"],
    daysAgo: 3,
    body: [
      "The first 50K of a 100 miler is physical. After that it's a conversation with yourself that you can't leave.",
      "Somewhere around mile 62 the voice that says stop gets very persuasive and very reasonable. The trick isn't arguing with it. The trick is agreeing with it and taking one more step anyway.",
    ],
    likedBy: ["mo", "dan"],
    comments: [["dan", "I get winded walking to the dugout. Respect."]],
  },
  {
    key: "ocaml",
    author: "rae",
    title: "I spent two weeks learning OCaml and regret nothing",
    tags: ["ocaml", "programming-languages"],
    daysAgo: 9,
    body: [
      "Will I use OCaml at work? No. Did I spend two weeks on it anyway? Absolutely.",
      "Pattern matching that the compiler checks for you, types you almost never have to write, and an ecosystem that feels like a well kept secret. Every language I touch afterward feels a little louder.",
    ],
    likedBy: ["victor", "ula", "mo", "dan"],
    comments: [["dan", "What's an OCaml"]],
  },
  {
    key: "settings",
    author: "victor",
    title: "My settings.json is a cry for help",
    tags: ["vim", "vscode"],
    daysAgo: 0.2,
    body: [
      "Four hundred lines. Vim keybindings, custom whichkey menus, and a theme I tweaked so many times I no longer know what the original looked like.",
      "Is it productive? Debatable. Is it fun? Extremely. Will I add more tonight? You already know.",
    ],
    likedBy: ["rae"],
  },
  {
    key: "spin",
    author: "dan",
    title: "Why spin rate broke my brain",
    tags: ["baseball", "analytics"],
    daysAgo: 2,
    body: [
      "Two pitchers can throw the exact same speed and one of them is unhittable. The difference is spin, and once you see the data you can't unsee it.",
      "High spin fastballs seem to rise. They don't, physics still works, they just drop less than your brain expects. Baseball is an argument with your own expectations.",
    ],
    likedBy: ["ula"],
  },
  {
    key: "hybrid",
    author: "ula",
    title: "Hybrid training: lifting heavy and running far without falling apart",
    tags: ["hybrid-training", "lifting"],
    daysAgo: 13,
    body: [
      "Everyone says you can't build strength and endurance at the same time. Everyone is mostly wrong, as long as you respect recovery.",
      "## The boring secret",
      "Sleep, eat more than you think, and keep your easy runs actually easy. That's it. That's the whole program.",
    ],
    likedBy: ["dan", "rae"],
  },
  {
    key: "fastslow",
    author: "mo",
    title: "Thinking, fast and slow, and slower",
    tags: ["books", "philosophy"],
    daysAgo: 11,
    body: [
      "Kahneman split thinking into two systems: fast and intuitive, slow and deliberate. I would like to propose a third: the 2am system, which is slow, wrong, and very confident.",
    ],
    likedBy: ["victor"],
  },
  {
    key: "icebath",
    author: "ula",
    title: "I took an ice bath every morning for 30 days",
    tags: ["cold-exposure", "wim-hof"],
    daysAgo: 2.5,
    body: [
      "Day one I lasted 40 seconds and said words my mother would not approve of. Day thirty I sat for three minutes and mostly just felt bored, which is apparently the goal.",
      "## The breathing is the real trick",
      "Thirty rounds of Wim Hof breathing beforehand changes everything. The cold stops being an emergency and starts being a conversation. Same lesson as mile 62, honestly: the voice saying get out is loud, but it isn't the boss.",
      "Will it cure everything? No. Do I feel like a slightly more unhinged, slightly calmer person? Absolutely.",
    ],
    likedBy: ["dan", "mo", "victor"],
    comments: [
      ["victor", "I set my shower to cold for ten seconds once and had to lie down."],
      ["ula", "Ten seconds is ten more than most people. Day two tomorrow."],
    ],
  },
  {
    key: "nidra",
    author: "mo",
    title: "Yoga nidra: falling asleep on purpose without falling asleep",
    tags: ["meditation", "yoga-nidra"],
    daysAgo: 6,
    body: [
      "Yoga nidra is lying on the floor while a voice walks your attention around your body, and somewhere in the middle you end up in this strange place that isn't awake and isn't asleep.",
      "The first few times I just fell asleep, which the teachers say is fine. Then one day I didn't, and I was aware of being aware of nothing in particular. Hard to describe. Easy to want again.",
    ],
    likedBy: ["ula", "victor"],
  },
  {
    key: "meta",
    author: "mo",
    title: "Thinking about thinking about thinking",
    tags: ["metacognition", "philosophy"],
    daysAgo: 0.5,
    body: [
      "Metacognition is noticing your own thinking while it happens. Not the content, the process. Oh, I'm catastrophizing again. Oh, I'm rehearsing an argument with someone who isn't here.",
      "The weird part is that the noticing changes the thing being noticed. You can't watch your own mind without the watching becoming part of it. Which, if you think about it too hard, is how you end up writing posts like this one.",
    ],
    likedBy: ["rae"],
  },
  {
    key: "aliens",
    author: "dan",
    title: "I ran the Drake equation like a baseball stat line",
    tags: ["aliens", "analytics"],
    daysAgo: 8,
    body: [
      "The Drake equation estimates how many alien civilizations we could talk to. It's seven numbers multiplied together, and for about five of them our best guess is a shrug.",
      "So I did what any stats guy would: plugged in optimistic, median, and pessimistic projections like it's preseason. Optimistic says the galaxy is a crowded ballpark. Pessimistic says we're the only team that showed up.",
      "Either way the answer is wild, and I've been staring at the sky after night games ever since.",
    ],
    likedBy: ["rae", "mo"],
    comments: [["mo", "What if they're conscious in ways we wouldn't even recognize as conscious?"]],
  },
  {
    key: "bunt",
    author: "dan",
    title: "The case for the sacrifice bunt (there isn't one)",
    tags: ["baseball"],
    daysAgo: 7,
    body: ["I tried to write a defense of the sacrifice bunt. The numbers would not cooperate. This is that post."],
    likedBy: [],
  },
  {
    key: "draft",
    author: "victor",
    title: "Half-written thoughts on code review",
    tags: ["agentic-coding"],
    daysAgo: null,
    body: ["If agents write the code, review becomes the job. More on this once I figure out what I think."],
    likedBy: [],
  },
];

const seedFollows: [Handle, Handle][] = [
  ["rae", "victor"], ["rae", "mo"],
  ["victor", "rae"], ["victor", "ula"], ["victor", "mo"],
  ["ula", "dan"], ["ula", "mo"],
  ["dan", "ula"], ["dan", "victor"],
  ["mo", "rae"], ["mo", "ula"], ["mo", "victor"],
];

// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * 24 * HOUR);

function toDoc(body: string[]) {
  return {
    type: "doc",
    content: body.map((block) =>
      block.startsWith("## ")
        ? { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: block.slice(3) }] }
        : { type: "paragraph", content: [{ type: "text", text: block }] },
    ),
  };
}

function slugFor(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "post"}-${randomBytes(3).toString("hex")}`;
}

async function removeSeed() {
  const removed = await db.delete(users).where(like(users.email, `%@${SEED_DOMAIN}`)).returning({ username: users.username });
  // Tags no longer used by any post (the seed's own, now orphaned).
  const orphanTags = await db
    .delete(tags)
    // ...but keep any tag a real reader picked as an interest (deleting it would cascade their choice away).
    .where(sql`${tags.id} not in (select ${postTags.tagId} from ${postTags}) and ${tags.id} not in (select ${userInterests.tagId} from ${userInterests})`)
    .returning({ name: tags.name });
  console.log(`Removed ${removed.length} seed users (and everything they made), ${orphanTags.length} unused tags.`);
}

// ---------------------------------------------------------------------------
// Credentials: { email: password }, kept out of git.

type Credentials = Record<string, string>;

/** 16 chars of base64url = 96 bits of randomness. Unguessable, still copy-pasteable. */
const newPassword = () => randomBytes(12).toString("base64url");
const emailFor = (h: Handle) => `${people[h].username}@${SEED_DOMAIN}`;

function readCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_FILE)) return {};
  return (JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8")) as { accounts?: Credentials }).accounts ?? {};
}

function writeCredentials(accounts: Credentials) {
  const note = "Seed account logins. Gitignored on purpose: never commit this file. Rotate with npm run db:seed:rotate.";
  writeFileSync(CREDENTIALS_FILE, JSON.stringify({ _note: note, accounts }, null, 2) + "\n");
}

async function rotatePasswords() {
  const seeded = await db.select({ email: users.email }).from(users).where(like(users.email, `%@${SEED_DOMAIN}`));
  if (seeded.length === 0) {
    console.log("No seed accounts in the database. Run `npm run db:seed` first.");
    return;
  }
  const accounts = Object.fromEntries(seeded.map((u) => [u.email, newPassword()]));
  // File first: if the database step dies halfway, the new passwords aren't lost (just rotate again).
  writeCredentials(accounts);
  for (const [email, password] of Object.entries(accounts)) {
    // Bumping token_version also signs out any session opened with the old password.
    await db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(password, 12), tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.email, email));
  }
  console.log(`Rotated ${seeded.length} seed passwords and signed out their old sessions. Nothing else changed.`);
  console.log(`New logins are in ${CREDENTIALS_FILE} (gitignored).`);
}

async function seed() {
  const existing = await db.select({ id: users.id }).from(users).where(like(users.email, `%@${SEED_DOMAIN}`)).limit(1);
  if (existing.length > 0) {
    console.log("Seed data already exists. Use `npm run db:seed:reset` to recreate it.");
    return;
  }

  const handles = Object.keys(people) as Handle[];
  // Reuse saved passwords when the file exists (so a reset keeps your logins), fill any gaps.
  const accounts = readCredentials();
  for (const h of handles) accounts[emailFor(h)] ??= newPassword();
  writeCredentials(accounts);
  const hashes = await Promise.all(handles.map((h) => bcrypt.hash(accounts[emailFor(h)], 12)));
  const createdUsers = await db
    .insert(users)
    .values(handles.map((h, i) => ({ ...people[h], email: emailFor(h), passwordHash: hashes[i], createdAt: ago(30) })))
    .returning({ id: users.id, username: users.username });
  const userId = Object.fromEntries(handles.map((h) => [h, createdUsers.find((u) => u.username === people[h].username)!.id])) as Record<Handle, number>;

  const allTags = [...new Set(seedPosts.flatMap((p) => p.tags.map(normalizeTag)))];
  const tagRows = await db
    .insert(tags)
    .values(allTags.map((name) => ({ name })))
    .onConflictDoUpdate({ target: tags.name, set: { name: sql`excluded.name` } })
    .returning({ id: tags.id, name: tags.name });
  const tagId = Object.fromEntries(tagRows.map((t) => [t.name, t.id]));

  let likeCount = 0;
  let commentCount = 0;
  for (const p of seedPosts) {
    const text = p.body.map((b) => b.replace(/^## /, "")).join(" ");
    const publishedAt = p.daysAgo === null ? null : ago(p.daysAgo);
    const createdAt = ago((p.daysAgo ?? 0) + 0.5);

    const [post] = await db
      .insert(posts)
      .values({
        authorId: userId[p.author],
        slug: slugFor(p.title),
        title: p.title,
        content: toDoc(p.body),
        excerpt: text.length > 200 ? text.slice(0, 200).replace(/\s+\S*$/, "") + "…" : text,
        readingMinutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 220)),
        publishedAt,
        createdAt,
        updatedAt: publishedAt ?? createdAt,
      })
      .returning({ id: posts.id });

    await db.insert(postTags).values(p.tags.map((t) => ({ postId: post.id, tagId: tagId[normalizeTag(t)] })));

    if (publishedAt && p.likedBy.length > 0) {
      await db.insert(likes).values(
        p.likedBy.map((h, i) => ({ userId: userId[h], postId: post.id, createdAt: new Date(publishedAt.getTime() + (i + 1) * 2 * HOUR) })),
      );
      likeCount += p.likedBy.length;
    }

    if (publishedAt && p.comments?.length) {
      await db.insert(comments).values(
        p.comments.map(([h, body], i) => ({
          postId: post.id,
          authorId: userId[h],
          body,
          createdAt: new Date(publishedAt.getTime() + (i + 1) * 3 * HOUR),
        })),
      );
      commentCount += p.comments.length;
    }
  }

  await db.insert(follows).values(seedFollows.map(([a, b]) => ({ followerId: userId[a], followingId: userId[b], createdAt: ago(20) })));

  const published = seedPosts.filter((p) => p.daysAgo !== null).length;
  console.log(
    `Seeded ${handles.length} users, ${seedPosts.length} posts (${published} published, ${seedPosts.length - published} draft), ` +
      `${allTags.length} tags, ${seedFollows.length} follows, ${likeCount} likes, ${commentCount} comments.`,
  );
  console.log(`\nLogins (email + password) are in ${CREDENTIALS_FILE} (gitignored).`);
}

// No top-level await: the package isn't "type": "module", so tsx runs this as CommonJS.
async function main() {
  const arg = process.argv[2];
  if (arg === "--rotate-passwords") return rotatePasswords();
  if (arg === "--remove" || arg === "--reset") await removeSeed();
  if (arg !== "--remove") await seed();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
