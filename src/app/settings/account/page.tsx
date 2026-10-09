import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ProviderIcon } from "@/components/auth/provider-icons";
import { OAuthErrorMessage } from "@/components/auth/oauth-buttons";
import {
  ChangeEmailForm,
  ChangePasswordForm,
  DeleteAccountForm,
  DisconnectButton,
} from "@/components/settings/account-forms";
import { SettingsNav } from "@/components/settings/settings-nav";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";
import { enabledProviders, PROVIDER_LABEL } from "@/lib/oauth";
import { isPlaceholderEmail, loginMethods } from "@/lib/oauth-accounts";

export const metadata: Metadata = { title: "Account settings" };

type SearchParams = Promise<{ oauth_error?: string | string[]; connected?: string | string[]; disconnected?: string | string[] }>;

export default function AccountSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-center text-3xl font-semibold sm:text-left">Settings</h1>
      <SettingsNav current="/settings/account" />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AccountForms searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const heading = "mb-4 text-center text-xl font-semibold sm:text-left";

async function AccountForms({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [[row], methods] = await Promise.all([
    getDb().select({ email: users.email }).from(users).where(eq(users.id, user.id)),
    loginMethods(user.id),
  ]);
  const email = row?.email ?? "";
  const providers = enabledProviders();
  const flash =
    typeof sp.connected === "string" && sp.connected in PROVIDER_LABEL
      ? `${PROVIDER_LABEL[sp.connected as keyof typeof PROVIDER_LABEL]} connected.`
      : typeof sp.disconnected === "string" && sp.disconnected in PROVIDER_LABEL
        ? `${PROVIDER_LABEL[sp.disconnected as keyof typeof PROVIDER_LABEL]} disconnected.`
        : null;

  return (
    <div className="grid gap-12">
      {flash && (
        <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {flash}
        </p>
      )}
      <OAuthErrorMessage code={typeof sp.oauth_error === "string" ? sp.oauth_error : undefined} />

      <section aria-labelledby="email-heading">
        <h2 id="email-heading" className={heading}>
          Email
        </h2>
        {isPlaceholderEmail(email) && (
          <p className="mb-3 text-sm text-muted-foreground">Your sign-in provider didn&apos;t share an email. Add one if you like.</p>
        )}
        <ChangeEmailForm currentEmail={isPlaceholderEmail(email) ? "" : email} hasPassword={methods.hasPassword} />
      </section>

      <section aria-labelledby="password-heading" className="border-t pt-10">
        <h2 id="password-heading" className={heading}>
          Password
        </h2>
        <ChangePasswordForm hasPassword={methods.hasPassword} />
      </section>

      {providers.length > 0 && (
        <section aria-labelledby="connected-heading" className="border-t pt-10">
          <h2 id="connected-heading" className={heading}>
            Connected accounts
          </h2>
          <p className="mb-4 text-center text-sm text-muted-foreground sm:text-left">Sign in with any of these instead of a password.</p>
          <ul className="divide-y rounded-lg border">
            {providers.map((p) => {
              const connected = methods.providers.includes(p);
              return (
                <li key={p} className="flex items-center justify-between gap-3 p-3">
                  <span className="flex items-center gap-2.5 font-medium">
                    <ProviderIcon provider={p} className="size-5" />
                    {PROVIDER_LABEL[p]}
                    {connected && <span className="text-xs font-normal text-muted-foreground">Connected</span>}
                  </span>
                  {connected ? (
                    <DisconnectButton provider={p} label={PROVIDER_LABEL[p]} />
                  ) : (
                    <a href={`/auth/${p}?link=1`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Connect
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="delete-heading" className="rounded-xl border border-destructive/30 p-5">
        <h2 id="delete-heading" className={`${heading} text-destructive`}>
          Delete account
        </h2>
        <p className="mb-4 text-center text-sm text-muted-foreground sm:text-left">
          Permanently deletes your account, posts, comments, likes, follows, bookmarks, and uploaded images. There&apos;s no undo.
        </p>
        <DeleteAccountForm username={user.username} hasPassword={methods.hasPassword} />
      </section>
    </div>
  );
}
