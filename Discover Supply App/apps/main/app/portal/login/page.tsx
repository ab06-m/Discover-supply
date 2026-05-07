"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/redirects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<PortalLoginShell />}>
      <PortalLoginForm />
    </Suspense>
  );
}

function PortalLoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        {children ?? (
          <>
            <CardHeader>
              <CardTitle>Customer portal</CardTitle>
              <CardDescription>Loading sign in...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-10 rounded-md bg-muted" />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function PortalLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"), "/portal");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  async function onGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <PortalLoginShell>
      <CardHeader>
        <CardTitle>Customer portal</CardTitle>
        <CardDescription>
          Enter your email to get a magic link for your portal and catalog access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full" onClick={onGoogle}>
          Continue with Google
        </Button>
        {process.env.NODE_ENV === "development" && (
          <Button asChild variant="secondary" className="w-full">
            <a href={`/portal/dev?next=${encodeURIComponent(next)}`}>
              Development preview
            </a>
          </Button>
        )}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        {sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Check <strong>{email}</strong> for a sign-in link.
            <button
              type="button"
              className="mt-2 text-emerald-700 underline"
              onClick={() => {
                setSent(false);
                router.refresh();
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onMagicLink} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        )}
      </CardContent>
    </PortalLoginShell>
  );
}
