import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ChangeEmailForm, ChangePasswordForm } from "@/components/settings/account-forms";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Account settings" };

export default function AccountSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-semibold sm:text-left">Settings</h1>
      <SettingsNav current="/settings/account" />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AccountForms />
      </Suspense>
    </main>
  );
}

async function AccountForms() {
  const user = await requireUser();
  const [row] = await getDb().select({ email: users.email }).from(users).where(eq(users.id, user.id));

  return (
    <div className="grid gap-12">
      <section aria-labelledby="email-heading">
        <h2 id="email-heading" className="mb-4 text-center text-xl font-semibold sm:text-left">
          Email
        </h2>
        <ChangeEmailForm currentEmail={row?.email ?? ""} />
      </section>
      <section aria-labelledby="password-heading" className="border-t pt-10">
        <h2 id="password-heading" className="mb-4 text-center text-xl font-semibold sm:text-left">
          Password
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
