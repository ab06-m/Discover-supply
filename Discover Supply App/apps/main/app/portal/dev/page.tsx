import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { safeInternalPath } from "@/lib/redirects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PortalDevPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { next } = await searchParams;
  const nextPath = safeInternalPath(next, "/portal");

  const contacts = await db
    .select({
      contact: schema.customerContacts,
      customer: schema.customers,
      org: schema.organizations,
    })
    .from(schema.customerContacts)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.customerContacts.customerId))
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.customerContacts.orgId))
    .orderBy(desc(schema.customerContacts.createdAt))
    .limit(50);

  const customers = contacts.length
    ? []
    : await db
        .select({
          customer: schema.customers,
          org: schema.organizations,
        })
        .from(schema.customers)
        .innerJoin(schema.organizations, eq(schema.organizations.id, schema.customers.orgId))
        .where(eq(schema.customers.isActive, true))
        .orderBy(desc(schema.customers.createdAt))
        .limit(50);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portal dev preview</h1>
          <p className="text-sm text-muted-foreground">
            Pick a customer contact or customer to review the customer portal locally.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {contacts.length ? "Customer contacts" : "Customers"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 && customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No customers found yet.
              </p>
            ) : (
              <ul className="divide-y">
                {contacts.length
                  ? contacts.map(({ contact, customer, org }) => (
                  <li
                    key={contact.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="font-medium">
                        {contact.fullName ?? contact.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {customer.name} - {org.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{contact.email}</div>
                    </div>
                    <Button asChild size="sm">
                      <a
                        href={`/portal/dev/preview?contactId=${contact.id}&next=${encodeURIComponent(nextPath)}`}
                      >
                        Preview
                      </a>
                    </Button>
                  </li>
                    ))
                  : customers.map(({ customer, org }) => (
                      <li
                        key={customer.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">{org.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.email ?? "A dev review contact will be created."}
                          </div>
                        </div>
                        <Button asChild size="sm">
                          <a
                            href={`/portal/dev/preview?customerId=${customer.id}&next=${encodeURIComponent(nextPath)}`}
                          >
                            Create preview
                          </a>
                        </Button>
                      </li>
                    ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Button asChild variant="outline">
          <a href={`/portal/dev/preview?clear=1&next=${encodeURIComponent(nextPath)}`}>
            Clear preview session
          </a>
        </Button>
      </div>
    </main>
  );
}
