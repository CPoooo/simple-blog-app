import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { eq } from "drizzle-orm";
import { AvatarUploader } from "@/components/settings/avatar-uploader";
import { ProfileForm } from "@/components/settings/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Profile settings" };

export default function ProfileSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-semibold sm:text-left">Settings</h1>
      <SettingsNav current="/settings/profile" />
      <p className="mb-8 text-center text-muted-foreground sm:text-left">How you show up next to your posts and comments.</p>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <EditProfile />
      </Suspense>
    </main>
  );
}

async function EditProfile() {
  const user = await requireUser();
  const profile = await getDb().query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, username: true, email: true, bio: true, avatarUrl: true },
  });
  if (!profile) return null;

  return (
    <>
      <div className="mb-8 border-b pb-8">
        <AvatarUploader userId={profile.id} username={profile.username} initialUrl={profile.avatarUrl} />
      </div>
      <ProfileForm initial={{ username: profile.username, bio: profile.bio ?? "" }} />
      <p className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground sm:text-left">
        Signed in as <span className="font-medium text-foreground">{profile.email}</span>. Change your email or password under{" "}
        <Link href="/settings/account" className="font-medium text-foreground underline underline-offset-4">
          Account
        </Link>
        .
      </p>
    </>
  );
}
