import Link from "next/link";
import { Package, Store } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireActiveOrg();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground">
          Import data from KyteApp CSV exports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Link href="/import/products">
          <Card className="p-6 hover:border-primary/60 transition-colors cursor-pointer flex gap-4 items-start">
            <Package className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold">Products</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Import inventory from a KyteApp products CSV export
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/import/customers">
          <Card className="p-6 hover:border-primary/60 transition-colors cursor-pointer flex gap-4 items-start">
            <Store className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold">Customers</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Import store contacts from a KyteApp customers CSV export
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
