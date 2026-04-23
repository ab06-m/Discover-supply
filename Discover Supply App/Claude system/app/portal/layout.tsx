import Link from "next/link";
import { FileText, ShoppingBag, Home, LogOut } from "lucide-react";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { active } = await requireCustomer();

  async function signOut() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/portal" className="text-base font-semibold">
            {active.org.name}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/portal" icon={<Home className="h-4 w-4" />} label="Home" />
            <NavLink href="/portal/orders" icon={<ShoppingBag className="h-4 w-4" />} label="Orders" />
            <NavLink href="/portal/invoices" icon={<FileText className="h-4 w-4" />} label="Invoices" />
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-secondary"
    >
      {icon} {label}
    </Link>
  );
}
