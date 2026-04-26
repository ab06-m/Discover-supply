"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  ShoppingCart,
  FileText,
  Truck,
  Store,
  BarChart3,
  Settings,
  Upload,
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

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 items-center border-b px-4 font-bold tracking-tight">
        {orgName}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
