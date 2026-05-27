"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type CustomerInfoSummary = {
  customerId: string | null;
  customerName: string | null;
  storeCode: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerBillingAddress: Address | null;
  customerShippingAddress: Address | null;
  customerPaymentTerms: string | null;
  customerTaxId: string | null;
  customerNotes: string | null;
  customerIsActive: boolean | null;
};

function formatWords(value: string | null) {
  if (!value) return "-";
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAddress(address: Address | null) {
  if (!address) return "-";
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const parts = [address.line1, address.line2, cityLine, address.country].filter(Boolean);
  return parts.length ? parts.join("\n") : "-";
}

function InfoField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2.5">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm", multiline && "whitespace-pre-line")}>{value}</div>
    </div>
  );
}

export function CustomerInfoDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: CustomerInfoSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Customer information" className="max-w-lg">
        <div className="space-y-5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{customer.customerName}</h2>
              {customer.storeCode ? (
                <p className="mt-1 text-sm text-muted-foreground">{customer.storeCode}</p>
              ) : null}
            </div>
            <Badge variant={customer.customerIsActive === false ? "secondary" : "success"}>
              {customer.customerIsActive === false ? "Inactive" : "Active"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Email" value={customer.customerEmail ?? "-"} />
            <InfoField label="Phone" value={customer.customerPhone ?? "-"} />
            <InfoField label="Payment terms" value={formatWords(customer.customerPaymentTerms)} />
            <InfoField label="Tax ID" value={customer.customerTaxId ?? "-"} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Billing address" value={formatAddress(customer.customerBillingAddress)} multiline />
            <InfoField
              label="Shipping address"
              value={formatAddress(customer.customerShippingAddress)}
              multiline
            />
          </div>

          {customer.customerNotes ? (
            <InfoField label="Notes" value={customer.customerNotes} multiline />
          ) : null}

          {customer.customerId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/customers/${customer.customerId}`}>Open customer profile</Link>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
