import Link from "next/link";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { CartBadge } from "@/modules/storefront/components/cart-badge";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { active } = await requireCustomer("/shop");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <Link href="/shop" className="text-base font-semibold">
              {active.org.name} · Shop
            </Link>
            <div className="text-xs text-muted-foreground">
              Signed in as {active.customer.name}
            </div>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/shop"
              className="rounded-md px-3 py-1.5 hover:bg-secondary"
            >
              Catalog
            </Link>
            <Link
              href="/portal"
              className="rounded-md px-3 py-1.5 hover:bg-secondary"
            >
              Customer portal
            </Link>
            <CartBadge />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
