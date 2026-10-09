import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons, OAuthErrorFromParams } from "@/components/auth/oauth-buttons";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: Promise<{ oauth_error?: string | string[] }> }) {
  return (
    <Card>
      <CardHeader className="text-center sm:text-left">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to keep reading and writing.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Reads the URL, so it streams in; the rest of the page stays static. */}
        <Suspense fallback={null}>
          <OAuthErrorFromParams searchParams={searchParams} />
        </Suspense>
        <OAuthButtons />
        <LoginForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        New here?&nbsp;
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}
