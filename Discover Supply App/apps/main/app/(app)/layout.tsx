import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { getActiveOrg } from "@/lib/auth";
import { Sidebar, MobileSidebar } from "@/components/app/sidebar";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role, memberships } = await getActiveOrg();
  if (!org) redirect("/onboarding");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar orgName={org.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MobileSidebar orgName={org.name} />
            <OrgSwitcher memberships={memberships} activeOrgId={org.id} />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sell"
              className="hidden h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:inline-flex"
            >
              <ShoppingBasket className="h-4 w-4" />
              Sell
            </Link>
            <UserMenu email={user.email ?? ""} role={role ?? "office"} />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
