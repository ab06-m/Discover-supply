import Link from "next/link";
import { Package, Store } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

const importOptions = [
  {
    href: "/import/products",
    title: "Products",
    description: "Import inventory from a KyteApp products CSV export.",
    icon: Package,
  },
  {
    href: "/import/customers",
    title: "Customers",
    description: "Import store contacts from a KyteApp customers CSV export.",
    icon: Store,
  },
];

export default async function ImportPage() {
  await requireActiveOrg();

  return (
    <div className="space-y-6">
      <PageHeader title="Import" subtitle="Bring KyteApp CSV exports into Discover Supply." />

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        {importOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.href} href={option.href} className="block">
              <Card className="flex h-full items-start gap-4 p-5 shadow-card transition hover:border-primary hover:shadow-card-hover">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">{option.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
