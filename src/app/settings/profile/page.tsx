import type { Metadata } from "next";
import { Suspense } from "react";
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
      <h1 className="text-center sm:text-left text-3xl font-semibold">Profile</h1>
      <p className="mt-2 mb-8 text-center sm:text-left text-muted-foreground">How you show up next to your posts and comments.</p>
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
      <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{profile.email}</span>. Email and password changes aren&apos;t
        available yet.
      </p>
    </>
  );
}
