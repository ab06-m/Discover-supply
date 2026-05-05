"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomer, updateCustomer } from "../actions";
import type { Customer } from "../schema";

type Props = {
  mode: "create" | "edit";
  initial?: Customer;
};

const TERMS = [
  { value: "cod", label: "Cash on delivery" },
  { value: "net7", label: "Net 7" },
  { value: "net15", label: "Net 15" },
  { value: "net30", label: "Net 30" },
  { value: "net60", label: "Net 60" },
];

export function CustomerForm({ mode, initial }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(
    // default to same if shipping matches billing or is empty on create
    mode === "create" ? true : false,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "edit" && initial?.id) {
        fd.set("id", initial.id);
        await updateCustomer(fd);
        router.push(`/customers/${initial.id}`);
      } else {
        const res = await createCustomer(fd);
        router.push(`/customers/${res.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Customer name *</Label>
              <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeCode">Store code</Label>
              <Input
                id="storeCode"
                name="storeCode"
                defaultValue={initial?.storeCode ?? ""}
                placeholder="Your internal code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment terms</Label>
              <select
                id="paymentTerms"
                name="paymentTerms"
                defaultValue={initial?.paymentTerms ?? "net30"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Cellphone / WhatsApp</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initial?.phone ?? ""}
                placeholder="+1 555 123 4567"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="taxId">Tax ID / VAT</Label>
              <Input id="taxId" name="taxId" defaultValue={initial?.taxId ?? ""} />
            </div>
          </div>
        </CardContent>
      </Card>

      <AddressCard
        title="Billing address"
        prefix="bill"
        initial={initial?.billingAddress ?? undefined}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Shipping address</CardTitle>
          <label className="flex items-center gap-2 text-sm font-normal">
            <input
              type="checkbox"
              name="sameAsBilling"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              className="h-4 w-4"
            />
            Same as billing
          </label>
        </CardHeader>
        {!sameAsBilling && (
          <CardContent>
            <AddressFields prefix="ship" initial={initial?.shippingAddress ?? undefined} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <textarea
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ""}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
            placeholder="Delivery instructions, preferences, etc."
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Add customer" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}

type Addr = { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null | undefined;

function AddressCard({ title, prefix, initial }: { title: string; prefix: "bill" | "ship"; initial: Addr }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <AddressFields prefix={prefix} initial={initial} />
      </CardContent>
    </Card>
  );
}

function AddressFields({ prefix, initial }: { prefix: "bill" | "ship"; initial: Addr }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}_line1`}>Address line 1</Label>
        <Input id={`${prefix}_line1`} name={`${prefix}_line1`} defaultValue={initial?.line1 ?? ""} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${prefix}_line2`}>Address line 2</Label>
        <Input id={`${prefix}_line2`} name={`${prefix}_line2`} defaultValue={initial?.line2 ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}_city`}>City</Label>
        <Input id={`${prefix}_city`} name={`${prefix}_city`} defaultValue={initial?.city ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}_state`}>State / Region</Label>
        <Input id={`${prefix}_state`} name={`${prefix}_state`} defaultValue={initial?.state ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}_postalCode`}>Postal code</Label>
        <Input id={`${prefix}_postalCode`} name={`${prefix}_postalCode`} defaultValue={initial?.postalCode ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}_country`}>Country</Label>
        <Input id={`${prefix}_country`} name={`${prefix}_country`} defaultValue={initial?.country ?? ""} />
      </div>
    </div>
  );
}
