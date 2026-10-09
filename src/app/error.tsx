"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Catches unexpected errors below the root layout, so the header and footer stay put. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-hand text-2xl text-primary">that wasn&apos;t supposed to happen</p>
      <h1 className="mt-2 text-4xl font-semibold">Something broke.</h1>
      <p className="mt-3 text-muted-foreground">
        It&apos;s on us, not you. Try again, and if it keeps happening, the database is probably having a moment.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
