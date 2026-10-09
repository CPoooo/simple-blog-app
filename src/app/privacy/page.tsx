import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${site.name} stores about you, and how to delete it.`,
};

/**
 * Plain-English privacy policy. Also the "privacy policy" and "data deletion
 * instructions" URLs that Facebook (and Google) require for social sign-in.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-4xl font-semibold">Privacy</h1>
      <p className="mt-2 text-muted-foreground">The short, honest version. Last updated October 2026.</p>

      <div className="prose-post mt-10">
        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your account:</strong> username, email, an optional bio and profile photo, and a hashed password if you set one
            (we never see or store the password itself).
          </li>
          <li>
            <strong>What you make:</strong> posts, drafts, comments, likes, follows, bookmarks, and the interests you pick.
          </li>
          <li>
            <strong>Sign in with Google, GitHub, or Facebook:</strong> we receive your account id with that provider, your name or
            username, and your email address. Nothing else: no contacts, no posting on your behalf, no access to your other data.
          </li>
          <li>
            <strong>Cookies:</strong> one sign-in cookie to keep you logged in, and short-lived cookies during social sign-in. Your
            reading preferences (width, font, tint) stay in your browser and never reach us.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <p>No ads, no trackers, no selling or sharing your data with anyone. It&apos;s a small blog.</p>

        <h2>Where it lives</h2>
        <p>Data is stored with Neon (database) and Vercel (hosting and uploaded images).</p>

        <h2 id="delete-your-data">Deleting your data</h2>
        <p>You can delete your account and everything in it yourself, any time:</p>
        <ol>
          <li>Sign in and open <Link href="/settings/account">Settings → Account</Link>.</li>
          <li>
            At the bottom, under <strong>Delete account</strong>, type your username and confirm.
          </li>
        </ol>
        <p>
          That permanently removes your account, posts, comments, likes, follows, bookmarks, notifications, uploaded images, and any
          connected Google/GitHub/Facebook links. To only remove a social sign-in, use <strong>Disconnect</strong> in the same
          place, and remove the app from that provider&apos;s settings too if you like.
        </p>
        <p>
          Can&apos;t sign in anymore? Open an issue on{" "}
          <a href={site.repo} rel="noreferrer">
            the project&apos;s GitHub
          </a>{" "}
          and we&apos;ll delete it for you.
        </p>
      </div>
    </main>
  );
}
