import Link from "next/link";
import { Plus, Search, Store } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listCustomers } from "@/modules/customers/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { CustomersList } from "@/modules/customers/components/customers-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q } = await searchParams;
  const rows = await listCustomers(org.id, { search: q });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} customer${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" /> Customer
            </Link>
          </Button>
        }
      />

      <Card className="p-4 shadow-card">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Input
              name="q"
              placeholder="Search by name"
              defaultValue={q ?? ""}
              className="h-12 pr-11"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Search customers"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
          <Button asChild className="h-12 sm:px-6">
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" /> Customer
            </Link>
          </Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title={q ? "No customers match your search" : "No customers yet"}
          description={
            q
              ? "Try a different name, store code, email, or phone number."
              : "Add customer records so orders, invoices, and deliveries have a destination."
          }
          action={
            !q ? (
              <Button asChild>
                <Link href="/customers/new">Add your first customer</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <CustomersList rows={rows} currency={org.currency} />
      )}
    </div>
  );
}
