"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { changeEmail, changePassword, type AccountFormState } from "@/app/actions/account";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

function useSavedToast(state: AccountFormState) {
  useEffect(() => {
    if (state?.saved && state.message) toast.success(state.message);
  }, [state]);
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
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
        errors={state?.errors?.email}
      />
      <FormField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        errors={state?.errors?.currentPassword}
      />
      <div className="flex justify-center sm:justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update email"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  useSavedToast(state);
  return (
    // Remount after success so every password field clears.
    <form key={state?.saved ? "done" : "editing"} action={action} className="grid gap-4" noValidate>
      <FormField
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        errors={state?.errors?.currentPassword}
      />
      <FormField name="newPassword" label="New password" type="password" autoComplete="new-password" errors={state?.errors?.newPassword} />
      <FormField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.confirmPassword}
      />
      <p className="text-sm text-muted-foreground">Changing it signs you out on every other device.</p>
      <div className="flex justify-center sm:justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
