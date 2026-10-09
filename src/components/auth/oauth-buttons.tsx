import { ProviderIcon } from "@/components/auth/provider-icons";
import { buttonVariants } from "@/components/ui/button";
import { enabledProviders, PROVIDER_LABEL, PROVIDERS } from "@/lib/oauth";
import { cn } from "@/lib/utils";

/**
 * "Continue with Google / GitHub / Facebook" for the login and sign-up pages.
 * All three always show; a provider whose keys aren't configured yet renders as a
 * disabled button, so the page layout doesn't change when keys are added.
 * Live ones are plain links (not <Link>): they leave the site for the provider's consent screen.
 */
export function OAuthButtons({ verb = "Continue" }: { verb?: string }) {
  const live = enabledProviders();

  return (
    <div className="grid gap-2">
      {PROVIDERS.map((p) => {
        const label = `${verb} with ${PROVIDER_LABEL[p]}`;
        const cls = buttonVariants({ variant: "outline", size: "lg", className: "h-10 w-full gap-2.5" });
        return live.includes(p) ? (
          <a key={p} href={`/auth/${p}`} className={cls}>
            <ProviderIcon provider={p} />
            {label}
          </a>
        ) : (
          <span
            key={p}
            aria-disabled="true"
            title={`${PROVIDER_LABEL[p]} sign-in isn't set up yet`}
            className={cn(cls, "cursor-not-allowed opacity-50")}
          >
            <ProviderIcon provider={p} />
            {label}
            <span className="sr-only"> (not available yet)</span>
          </span>
        );
      })}
      {live.length === 0 && <p className="text-center text-xs text-muted-foreground">Social sign-in is coming soon.</p>}
      <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

const MESSAGES: Record<string, string> = {
  cancelled: "Sign-in was cancelled. No worries, try again whenever.",
  state: "That sign-in link expired or was tampered with. Please try again.",
  provider: "We couldn't reach the provider just now. Please try again.",
  unavailable: "That sign-in option isn't available.",
  account_exists:
    "An account with that email already exists. Sign in with your password, then connect this account from Settings → Account.",
  already_linked: "That account is already connected to a different Rabbit Holes account.",
  signin_required: "Sign in first, then connect the account from Settings.",
};

/** Reads `?oauth_error=` from the page's searchParams. Render inside <Suspense> so the rest of the page stays static. */
export async function OAuthErrorFromParams({ searchParams }: { searchParams: Promise<{ oauth_error?: string | string[] }> }) {
  const code = (await searchParams).oauth_error;
  return <OAuthErrorMessage code={typeof code === "string" ? code : undefined} />;
}

export function OAuthErrorMessage({ code }: { code: string | undefined }) {
  const message = code ? (MESSAGES[code] ?? MESSAGES.provider) : null;
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
