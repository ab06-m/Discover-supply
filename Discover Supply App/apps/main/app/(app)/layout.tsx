import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth";
import { Sidebar } from "@/components/app/sidebar";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role, memberships } = await getActiveOrg();
  if (!org) redirect("/onboarding");

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar orgName={org.name} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-background px-4">
          <OrgSwitcher memberships={memberships} activeOrgId={org.id} />
          <div className="flex items-center gap-3">
            <Link href="/orders/new" className="hidden text-sm font-medium underline-offset-4 hover:underline sm:inline">
              + New order
            </Link>
            <UserMenu email={user.email ?? ""} role={role ?? "office"} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
