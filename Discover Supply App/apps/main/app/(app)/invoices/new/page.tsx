import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listTemplates } from "@/modules/invoices/queries";
import { getOrder } from "@/modules/orders/queries";
import { createInvoiceFromOrder } from "@/modules/invoices/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { order: orderId } = await searchParams;
  if (!orderId) redirect("/orders");

  const [record, templates] = await Promise.all([
    getOrder(org.id, orderId),
    listTemplates(org.id),
  ]);
  if (!record) redirect("/orders");

  async function submit(formData: FormData) {
    "use server";
    const res = await createInvoiceFromOrder({
      orderId: orderId!,
      templateId: (formData.get("templateId") as string) || undefined,
      dueDate: (formData.get("dueDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      terms: (formData.get("terms") as string) || undefined,
    });
    redirect(`/invoices/${res.id}`);
  }

  const { order, customer, items } = record;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to order
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Create invoice</h1>

      <Card>
        <CardHeader>
          <CardTitle>From order {order.number}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Store:</span>{" "}
            {customer?.name ?? "Walk-in"}
          </div>
          <div>
            <span className="text-muted-foreground">Items:</span> {items.length}
          </div>
          <div>
            <span className="text-muted-foreground">Total:</span>{" "}
            <span className="font-semibold">{formatMoney(order.total, org.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <form action={submit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="templateId">Template</Label>
                <select
                  id="templateId"
                  name="templateId"
                  defaultValue={templates.find((t) => t.isDefault)?.id ?? ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (on invoice)</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={order.notes ?? ""}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Terms (optional, overrides template terms)</Label>
              <textarea
                id="terms"
                name="terms"
                rows={2}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit">Create invoice</Button>
          <Button asChild type="button" variant="outline">
            <Link href={`/orders/${order.id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
