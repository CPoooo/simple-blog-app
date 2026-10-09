"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BIO_MAX } from "@/lib/definitions";

export function ProfileForm({ initial }: { initial: { username: string; bio: string } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  // Controlled, so a rejected save keeps what was typed (React resets uncontrolled forms after an action).
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);

  useEffect(() => {
    if (state?.saved) toast.success("Profile saved.");
  }, [state]);

  const userError = state?.errors?.username?.[0];
  const bioError = state?.errors?.bio?.[0];

  return (
    <form action={action} className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground" aria-hidden>
            @
          </span>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={20}
            aria-invalid={userError ? true : undefined}
            aria-describedby="username-hint"
          />
        </div>
        <p id="username-hint" className={userError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {userError ?? "3 to 20 characters: letters, numbers, underscores. Your post links don't change."}
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="bio">Bio</Label>
          <span className={bio.length > BIO_MAX ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <Textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="What do you write about? Shows up under your posts."
          aria-invalid={bioError ? true : undefined}
          aria-describedby={bioError ? "bio-error" : undefined}
        />
        {bioError && (
          <p id="bio-error" className="text-sm text-destructive">
            {bioError}
          </p>
        )}
      </div>

      <div className="flex justify-center sm:justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
