"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  disconnectProvider,
  type AccountFormState,
} from "@/app/actions/account";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

function useSavedToast(state: AccountFormState) {
  useEffect(() => {
    if (state?.saved && state.message) toast.success(state.message);
  }, [state]);
}

/** Social-only accounts have no password, so there's no "current password" to ask for. */
export function ChangeEmailForm({ currentEmail, hasPassword }: { currentEmail: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changeEmail, undefined);
  useSavedToast(state);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email ?? currentEmail}
        placeholder="you@example.com"
        errors={state?.errors?.email}
      />
      {hasPassword && (
        <FormField name="currentPassword" label="Current password" type="password" autoComplete="current-password" errors={state?.errors?.currentPassword} />
      )}
      <div className="flex justify-center sm:justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update email"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  useSavedToast(state);
  return (
    // Remount after success so every password field clears.
    <form key={state?.saved ? "done" : "editing"} action={action} className="grid gap-4" noValidate>
      {hasPassword ? (
        <FormField name="currentPassword" label="Current password" type="password" autoComplete="current-password" errors={state?.errors?.currentPassword} />
      ) : (
        <p className="text-sm text-muted-foreground">
          You sign in with a connected account. Set a password too, so you can also sign in with your email.
        </p>
      )}
      <FormField name="newPassword" label="New password" type="password" autoComplete="new-password" errors={state?.errors?.newPassword} />
      <FormField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" errors={state?.errors?.confirmPassword} />
      <p className="text-sm text-muted-foreground">Saving it signs you out on every other device.</p>
      <div className="flex justify-center sm:justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}

export function DisconnectButton({ provider, label }: { provider: string; label: string }) {
  const [state, action, pending] = useActionState(disconnectProvider, undefined);
  return (
    <form action={action} className="grid justify-items-end gap-1">
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Disconnect ${label}`}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      {state?.error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function DeleteAccountForm({ username, hasPassword }: { username: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <form
      action={action}
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        if (!window.confirm("Delete your account and everything in it? This can't be undone.")) e.preventDefault();
      }}
    >
      <FormField name="confirm" label={`Type your username (${username}) to confirm`} autoComplete="off" errors={state?.errors?.confirm} />
      {hasPassword && (
        <FormField name="currentPassword" label="Current password" type="password" autoComplete="current-password" errors={state?.errors?.currentPassword} />
      )}
      <div className="flex justify-center sm:justify-start">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
