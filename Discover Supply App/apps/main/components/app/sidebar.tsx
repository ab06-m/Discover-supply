"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  PackagePlus,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Sun,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/app/theme-provider";

type NavItem = { href: string; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sell", label: "Sell", icon: ShoppingBasket },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/customers", label: "Customers", icon: Store },
  { href: "/products", label: "Inventory", icon: Package },
  { href: "/check-in", label: "Check in", icon: PackagePlus },
  { href: "/delivery", label: "Delivery", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function CompactNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1">
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
              "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] leading-tight transition-colors",
              active
                ? "bg-white font-semibold text-primary shadow-sm"
                : "font-medium text-white/80 hover:bg-white/10 hover:text-white",
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

function ExpandedNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
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

function OrgBadge({ orgName, compact = false }: { orgName: string; compact?: boolean }) {
  const initial = orgName.trim().charAt(0).toUpperCase() || "D";
  if (compact) {
    return (
      <div className="flex justify-center px-0 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-white text-base font-bold text-primary shadow-sm">
          {initial}
        </div>
      </div>
    );
  }
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

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[84px] shrink-0 flex-col items-center bg-sidebar md:flex">
      <OrgBadge orgName={orgName} compact />
      <CompactNavLinks pathname={pathname} />
      <div className="flex w-full flex-col items-center gap-2 border-t border-white/10 px-0 py-3">
        <ThemeToggle />
      </div>
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
              <OrgBadge orgName={orgName} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ExpandedNavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-3">
              <ThemeToggle />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
