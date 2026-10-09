"use client";

import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state?.message && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <FormField
        name="username"
        label="Username"
        autoComplete="username"
        defaultValue={state?.values?.username}
        errors={state?.errors?.username}
        required
      />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        errors={state?.errors?.email}
        required
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        errors={state?.errors?.password}
        required
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
