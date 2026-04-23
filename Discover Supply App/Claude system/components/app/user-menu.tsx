"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function UserMenu({ email, role }: { email: string; role: string }) {
  const router = useRouter();
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-none">{email}</div>
        <div className="text-xs text-muted-foreground">{role}</div>
      </div>
      <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
    </div>
  );
}
