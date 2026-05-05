"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  EyeOff,
  GripVertical,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatMoney } from "@/lib/utils";
import { setCustomerActive } from "../actions";
import type { Address } from "../schema";

export type CustomerListRow = {
  id: string;
  name: string;
  storeCode: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  taxId: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  openOrders: number;
  totalOrders: number;
  totalSpent: string | number;
  lastOrderAt: Date | string | null;
  accountBalance: string | number;
};

type FieldId =
  | "name"
  | "phone"
  | "email"
  | "accountBalance"
  | "totalOrders"
  | "totalSpent"
  | "lastOrder"
  | "openOrders"
  | "storeCode"
  | "paymentTerms"
  | "taxId"
  | "shippingAddress"
  | "billingAddress"
  | "notes"
  | "map"
  | "status"
  | "actions";

type Field = {
  id: FieldId;
  label: string;
  align?: "right" | "center";
  render: (customer: CustomerListRow) => React.ReactNode;
};

const mobileActionFieldIds = new Set<FieldId>(["notes", "map", "actions"]);
const storageKey = "discover-supply.customers.fields.v2";
const defaultOrder: FieldId[] = [
  "name",
  "phone",
  "email",
  "accountBalance",
  "totalOrders",
  "totalSpent",
  "lastOrder",
  "notes",
  "map",
  "actions",
];
const optionalOrder: FieldId[] = [
  "openOrders",
  "storeCode",
  "paymentTerms",
  "taxId",
  "shippingAddress",
  "billingAddress",
  "status",
];
const allFieldIds = [...defaultOrder, ...optionalOrder];

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function sanitizeFieldOrder(value: unknown): FieldId[] {
  if (!Array.isArray(value)) return allFieldIds;
  const valid = value.filter((id): id is FieldId => allFieldIds.includes(id as FieldId));
  return [...valid, ...allFieldIds.filter((id) => !valid.includes(id))];
}

function sanitizeVisibleFields(value: unknown): Set<FieldId> {
  if (!Array.isArray(value)) return new Set(defaultOrder);
  const valid = value.filter((id): id is FieldId => allFieldIds.includes(id as FieldId));
  return new Set(valid);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function textValue(value: string | null | undefined) {
  return value?.trim() ? value : "-";
}

function formatAddress(address: Address | null) {
  if (!address) return "-";
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const parts = [address.line1, address.line2, cityLine, address.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function mapUrl(customer: CustomerListRow) {
  const address = formatAddress(customer.shippingAddress ?? customer.billingAddress);
  if (address === "-") return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function whatsAppUrl(phone: string | null) {
  const digits = phone?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function moneyNumber(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: Date | string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export function CustomersList({ rows, currency }: { rows: CustomerListRow[]; currency: string }) {
  const [isPending, startTransition] = React.useTransition();

  const fields = React.useMemo<Field[]>(
    () => [
      {
        id: "name",
        label: "Name",
        render: (customer) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-600 text-sm font-semibold text-white">
              {initials(customer.name) || "?"}
            </div>
            <div className="min-w-0">
              <Link
                href={`/customers/${customer.id}`}
                className="line-clamp-2 font-semibold leading-snug hover:underline"
              >
                {customer.name}
              </Link>
              {customer.storeCode ? (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  Code {customer.storeCode}
                </div>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "phone",
        label: "Cellphone/WhatsApp",
        render: (customer) => {
          const href = whatsAppUrl(customer.phone);
          const content = (
            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-emerald-600">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{textValue(customer.phone)}</span>
            </span>
          );

          return href ? (
            <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
              {content}
            </a>
          ) : (
            content
          );
        },
      },
      {
        id: "email",
        label: "Email",
        render: (customer) =>
          customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="break-all text-foreground hover:underline"
            >
              {customer.email}
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        id: "accountBalance",
        label: "Account balance",
        align: "right",
        render: (customer) => {
          const balance = moneyNumber(customer.accountBalance);
          return (
            <span className={cn("font-medium", balance > 0 && "text-destructive")}>
              {formatMoney(balance, currency)}
            </span>
          );
        },
      },
      {
        id: "totalOrders",
        label: "Total orders",
        align: "right",
        render: (customer) => <span className="tabular-nums">{customer.totalOrders}</span>,
      },
      {
        id: "totalSpent",
        label: "Total spent",
        align: "right",
        render: (customer) => (
          <span className="font-medium">{formatMoney(customer.totalSpent, currency)}</span>
        ),
      },
      {
        id: "lastOrder",
        label: "Last order",
        render: (customer) => (
          <span className="text-muted-foreground">{formatDate(customer.lastOrderAt)}</span>
        ),
      },
      {
        id: "openOrders",
        label: "Open orders",
        align: "right",
        render: (customer) => <span className="tabular-nums">{customer.openOrders}</span>,
      },
      {
        id: "storeCode",
        label: "Store code",
        render: (customer) => <span className="text-muted-foreground">{textValue(customer.storeCode)}</span>,
      },
      {
        id: "paymentTerms",
        label: "Terms",
        render: (customer) => (
          <span className="text-xs uppercase text-muted-foreground">{customer.paymentTerms ?? "-"}</span>
        ),
      },
      {
        id: "taxId",
        label: "Tax ID",
        render: (customer) => <span className="text-muted-foreground">{textValue(customer.taxId)}</span>,
      },
      {
        id: "shippingAddress",
        label: "Shipping address",
        render: (customer) => (
          <span className="line-clamp-2 text-muted-foreground">{formatAddress(customer.shippingAddress)}</span>
        ),
      },
      {
        id: "billingAddress",
        label: "Billing address",
        render: (customer) => (
          <span className="line-clamp-2 text-muted-foreground">{formatAddress(customer.billingAddress)}</span>
        ),
      },
      {
        id: "notes",
        label: "Notes",
        align: "center",
        render: (customer) => (
          <IconLink
            href={`/customers/${customer.id}`}
            icon={MessageSquare}
            label={customer.notes ? "View notes" : "No notes"}
            disabled={!customer.notes}
          />
        ),
      },
      {
        id: "map",
        label: "Map",
        align: "center",
        render: (customer) => (
          <IconLink
            href={mapUrl(customer) ?? ""}
            icon={MapPin}
            label="Open address in maps"
            disabled={!mapUrl(customer)}
            external
          />
        ),
      },
      {
        id: "status",
        label: "Status",
        render: (customer) => (
          <Badge variant={customer.isActive ? "success" : "secondary"}>
            {customer.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        label: "Actions",
        align: "center",
        render: (customer) => (
          <div className="flex items-center justify-center gap-1">
            <Button asChild type="button" variant="ghost" size="icon" className="h-9 w-9" title="Edit customer">
              <Link href={`/customers/${customer.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              title={customer.isActive ? "Deactivate customer" : "Reactivate customer"}
              aria-label={customer.isActive ? "Deactivate customer" : "Reactivate customer"}
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  void setCustomerActive(customer.id, !customer.isActive);
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [currency, isPending],
  );

  const [fieldOrder, setFieldOrder] = React.useState<FieldId[]>(allFieldIds);
  const [visibleFields, setVisibleFields] = React.useState<Set<FieldId>>(
    () => new Set(defaultOrder),
  );
  const [storageLoaded, setStorageLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { order?: unknown; visible?: unknown };
        setFieldOrder(sanitizeFieldOrder(parsed.order));
        setVisibleFields(sanitizeVisibleFields(parsed.visible));
      }
    } catch {
      setFieldOrder(allFieldIds);
      setVisibleFields(new Set(defaultOrder));
    } finally {
      setStorageLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!storageLoaded) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ order: fieldOrder, visible: Array.from(visibleFields) }),
    );
  }, [fieldOrder, storageLoaded, visibleFields]);

  const orderedFields = fieldOrder
    .map((id) => fields.find((field) => field.id === id))
    .filter((field): field is Field => Boolean(field));
  const activeFields = orderedFields.filter((field) => visibleFields.has(field.id));

  function toggleField(id: FieldId) {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetFields() {
    setFieldOrder(allFieldIds);
    setVisibleFields(new Set(defaultOrder));
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fieldOrder.length) return;
    setFieldOrder((current) => moveItem(current, index, nextIndex));
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3 className="mr-2 h-4 w-4" />
              Fields
            </Button>
          </DialogTrigger>
          <DialogContent title="Edit customer fields" className="max-w-md">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Show and reorder customer info
                </div>
                <Button type="button" variant="outline" size="sm" onClick={resetFields}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {orderedFields.map((field, index) => {
                const isVisible = visibleFields.has(field.id);

                return (
                  <div
                    key={field.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3",
                      isVisible ? "bg-card" : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <label className="flex min-w-0 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleField(field.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move up"
                        aria-label={`Move ${field.label} up`}
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Move down"
                        aria-label={`Move ${field.label} down`}
                        disabled={index === orderedFields.length - 1}
                        onClick={() => moveField(index, 1)}
                        className="h-8 w-8"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeFields.length > 0 ? (
        <>
          <CustomerDesktopTable fields={activeFields} rows={rows} />
          <div className="grid gap-3 lg:hidden">
            {rows.map((customer) => (
              <CustomerMobileCard key={customer.id} fields={activeFields} customer={customer} />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <EyeOff className="h-5 w-5" />
            <span>No visible fields</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function CustomerDesktopTable({ fields, rows }: { fields: Field[]; rows: CustomerListRow[] }) {
  return (
    <Card className="hidden overflow-hidden shadow-card lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b">
              {fields.map((field) => (
                <th
                  key={field.id}
                  className={cn(
                    "h-12 whitespace-nowrap px-5 text-left font-semibold text-muted-foreground",
                    field.align === "right" && "text-right",
                    field.align === "center" && "text-center",
                  )}
                >
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr key={customer.id} className="border-b last:border-b-0 hover:bg-muted/30">
                {fields.map((field) => (
                  <td
                    key={field.id}
                    className={cn(
                      "max-w-72 px-5 py-4 align-middle",
                      field.align === "right" && "text-right",
                      field.align === "center" && "text-center",
                    )}
                  >
                    {field.render(customer)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CustomerMobileCard({ fields, customer }: { fields: Field[]; customer: CustomerListRow }) {
  const nameField = fields.find((field) => field.id === "name");
  const actionFields = fields.filter((field) => mobileActionFieldIds.has(field.id));
  const detailFields = fields.filter(
    (field) => field.id !== "name" && !mobileActionFieldIds.has(field.id),
  );

  return (
    <Card className="overflow-hidden shadow-card">
      <div className="space-y-4 p-4">
        {nameField ? <div>{nameField.render(customer)}</div> : null}
        {detailFields.length ? (
          <div className="grid grid-cols-1 gap-x-3 gap-y-4 min-[480px]:grid-cols-2">
            {detailFields.map((field) => (
              <div
                key={field.id}
                className={cn(
                  "min-w-0 rounded-md border bg-muted/20 px-3 py-2.5",
                  field.align === "right" && "min-[480px]:text-right",
                  (field.id === "email" ||
                    field.id === "shippingAddress" ||
                    field.id === "billingAddress") &&
                    "min-[480px]:col-span-2 min-[480px]:text-left",
                )}
              >
                <div className="mb-1 truncate text-xs font-medium uppercase text-muted-foreground">
                  {field.label}
                </div>
                <div className="min-w-0 text-sm [overflow-wrap:anywhere]">
                  {field.render(customer)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {actionFields.length ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
            {actionFields.map((field) => (
              <div key={field.id}>{field.render(customer)}</div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function IconLink({
  href,
  icon: Icon,
  label,
  disabled = false,
  external = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  external?: boolean;
}) {
  if (disabled) {
    return (
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground/50"
        title={label}
        aria-label={label}
      >
        <Icon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}
