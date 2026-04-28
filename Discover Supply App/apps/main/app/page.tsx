import Link from "next/link";
import { BarChart3, FileText, Package, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const metrics = [
  { label: "Open orders", value: "128", icon: ShoppingCart },
  { label: "Products tracked", value: "2,480", icon: Package },
  { label: "Invoices sent", value: "$42.8k", icon: FileText },
  { label: "Active deliveries", value: "18", icon: Truck },
];

const rows = [
  ["SO-1048", "Harbor Market", "Picking", "$842.00"],
  ["SO-1049", "Northline Foods", "Loaded", "$1,420.00"],
  ["SO-1050", "City Pantry", "In transit", "$316.50"],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b bg-card/80 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Discover Supply
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            Inventory, orders, invoices, and delivery
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Run your entire business from one app.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            A focused operations workspace for teams that sell, stock, invoice, and dispatch from
            the same inventory.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
            <div>
              <div className="text-sm font-semibold">Operations dashboard</div>
              <div className="text-xs text-muted-foreground">Today at a glance</div>
            </div>
            <div className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Live
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-muted-foreground">{metric.label}</div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">{metric.value}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr] bg-muted/60 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
              <span>Order</span>
              <span>Store</span>
              <span>Stage</span>
              <span className="text-right">Total</span>
            </div>
            {rows.map(([order, store, stage, total]) => (
              <div
                key={order}
                className="grid grid-cols-[1fr_1.4fr_1fr_1fr] border-t px-3 py-3 text-sm"
              >
                <span className="font-medium">{order}</span>
                <span className="text-muted-foreground">{store}</span>
                <span>{stage}</span>
                <span className="text-right font-medium">{total}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
