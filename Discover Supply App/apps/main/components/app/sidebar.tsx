"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Inventory", icon: Package },
  { href: "/check-in", label: "Check in", icon: PackagePlus },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/delivery", label: "Delivery", icon: Truck },
  { href: "/customers", label: "Stores", icon: Store },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();

  return (
    <nav className="flex-1 space-y-1 p-3">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onPointerEnter={() => router.prefetch(item.href)}
            onFocus={() => router.prefetch(item.href)}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-primary shadow-sm"
                : "text-white/85 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarHeader({ orgName }: { orgName: string }) {
  const initial = orgName.trim().charAt(0).toUpperCase() || "D";
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-base font-bold text-primary shadow-sm">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight text-white">{orgName}</div>
        <div className="text-xs text-white/70">Inventory</div>
      </div>
    </div>
  );
}

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col bg-sidebar md:flex">
      <SidebarHeader orgName={orgName} />
      <NavLinks pathname={pathname} />
    </aside>
  );
}

export function MobileSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card text-foreground hover:bg-accent md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between">
              <SidebarHeader orgName={orgName} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
