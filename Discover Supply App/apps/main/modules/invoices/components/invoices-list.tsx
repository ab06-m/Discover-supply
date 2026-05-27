"use client";

import * as React from "react";
import Link from "next/link";
import { Columns3, Eye, EyeOff, Minus, Plus, RotateCcw, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  addSpot,
  assignFieldToSpot,
  defaultLayout,
  fieldLabels,
  loadLayoutConfig,
  removeSpot,
  saveLayoutConfig,
  setSectionName,
  toggleFieldVisibility,
  type FieldId,
  type InvoiceCardLayoutConfig,
  type SectionId,
} from "@/modules/invoices/lib/invoice-card-layout";
import { cn, formatMoney } from "@/lib/utils";
import {
  CustomerInfoDialog,
  type CustomerInfoSummary,
} from "@/modules/customers/components/customer-info-dialog";

export type InvoiceListRow = CustomerInfoSummary & {
  id: string;
  number: string;
  status: string;
  total: string;
  amountPaid: string;
  issueDate: Date | string;
  dueDate: Date | string | null;
  viewedAt: Date | string | null;
};

type Field = {
  id: FieldId;
  label: string;
  render: (invoice: InvoiceListRow) => React.ReactNode;
};

const STATUS_STYLES: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  voided: "bg-secondary text-secondary-foreground",
};

const sectionDescriptions: Record<SectionId, string> = {
  main: "Center row beside the invoice title",
  side: "Right rail on desktop",
  footer: "Full-width row below the card",
};

function getDisplayStatus(status: string): "unpaid" | "partial" | "paid" | "voided" {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  if (status === "void") return "voided";
  return "unpaid";
}

function formatDisplayStatus(status: "unpaid" | "partial" | "paid" | "voided") {
  return status[0].toUpperCase() + status.slice(1);
}

export function InvoicesList({
  rows,
  currency,
}: {
  rows: InvoiceListRow[];
  currency: string;
}) {
  const [selectedCustomer, setSelectedCustomer] = React.useState<InvoiceListRow | null>(null);

  const fields = React.useMemo<Field[]>(
    () => [
      {
        id: "invoice",
        label: "Invoice #",
        render: (invoice) => (
          <Link href={`/invoices/${invoice.id}`} className="inline-block font-semibold hover:underline">
            {invoice.number}
          </Link>
        ),
      },
      {
        id: "customer",
        label: "Customer / store",
        render: (invoice) =>
          invoice.customerName ? (
            <button
              type="button"
              onClick={() => setSelectedCustomer(invoice)}
              className="min-w-0 text-left text-sm text-muted-foreground hover:underline"
            >
              {invoice.customerName}
              {invoice.storeCode ? ` · ${invoice.storeCode}` : ""}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">No store assigned</span>
          ),
      },
      {
        id: "viewed",
        label: "Viewed status",
        render: (invoice) => {
          const isViewed = invoice.status === "viewed" || Boolean(invoice.viewedAt);
          return (
            <span className="inline-flex items-center gap-1.5">
              {isViewed ? (
                <Eye className="h-4 w-4 text-success" />
              ) : (
                <EyeOff className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm">{isViewed ? "Viewed" : "Not viewed"}</span>
            </span>
          );
        },
      },
      {
        id: "issued",
        label: "Issued",
        render: (invoice) => <span>{new Date(invoice.issueDate).toLocaleDateString()}</span>,
      },
      {
        id: "due",
        label: "Due",
        render: (invoice) => (
          <span>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}</span>
        ),
      },
      {
        id: "total",
        label: "Total",
        render: (invoice) => (
          <span className="font-semibold">{formatMoney(invoice.total, currency)}</span>
        ),
      },
      {
        id: "balance",
        label: "Balance",
        render: (invoice) => {
          const balance = parseFloat(invoice.total) - parseFloat(invoice.amountPaid);
          return (
            <span className={cn(balance > 0 ? "font-semibold text-warning" : "font-medium text-success")}>
              {balance > 0 ? formatMoney(balance, currency) : "Paid"}
            </span>
          );
        },
      },
    ],
    [currency],
  );

  const [layout, setLayout] = React.useState<InvoiceCardLayoutConfig>(defaultLayout);
  const [storageLoaded, setStorageLoaded] = React.useState(false);

  React.useEffect(() => {
    setLayout(loadLayoutConfig());
    setStorageLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!storageLoaded) return;
    saveLayoutConfig(layout);
  }, [layout, storageLoaded]);

  const fieldMap = React.useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const visibleSet = React.useMemo(() => new Set(layout.visible), [layout.visible]);
  const hasVisibleCardContent = layout.visible.some((id) => fieldMap.has(id));

  return (
    <div className="space-y-3">
      <CustomerInfoDialog
        customer={selectedCustomer}
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomer(null);
        }}
      />

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3 className="mr-2 h-4 w-4" />
              Fields
            </Button>
          </DialogTrigger>
          <DialogContent title="Edit invoice fields" className="max-w-4xl">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Arrange sections, spots, and visible fields
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setLayout(defaultLayout)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="grid max-h-[min(70vh,42rem)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="space-y-3 p-4">
                {layout.sections.map((section) => (
                  <SectionEditor
                    key={section.id}
                    section={section}
                    layout={layout}
                    onNameChange={(name) => setLayout((current) => setSectionName(current, section.id, name))}
                    onAssign={(spotIndex, fieldId) =>
                      setLayout((current) => assignFieldToSpot(current, section.id, spotIndex, fieldId))
                    }
                    onAddSpot={() => setLayout((current) => addSpot(current, section.id))}
                    onRemoveSpot={(spotIndex) =>
                      setLayout((current) => removeSpot(current, section.id, spotIndex))
                    }
                  />
                ))}
              </div>

              <aside className="border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Visible fields
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Toggle which fields can appear on cards, then place them into section spots.
                </p>
                <div className="mt-3 space-y-2">
                  {fields.map((field) => {
                    const isVisible = visibleSet.has(field.id);
                    const assignedSection = layout.sections.find((entry) =>
                      entry.assignments.includes(field.id),
                    );

                    return (
                      <label
                        key={field.id}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                          isVisible ? "border-border bg-card" : "border-transparent bg-muted/40 text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => setLayout((current) => toggleFieldVisibility(current, field.id))}
                          className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{field.label}</span>
                          {assignedSection ? (
                            <span className="text-xs text-muted-foreground">
                              {assignedSection.name} · spot{" "}
                              {assignedSection.assignments.indexOf(field.id) + 1}
                            </span>
                          ) : isVisible ? (
                            <span className="text-xs text-muted-foreground">Not placed</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </aside>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {hasVisibleCardContent ? (
        <div className="grid gap-3">
          {rows.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              fieldMap={fieldMap}
              layout={layout}
              invoice={invoice}
              visibleSet={visibleSet}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionEditor({
  section,
  layout,
  onNameChange,
  onAssign,
  onAddSpot,
  onRemoveSpot,
}: {
  section: InvoiceCardLayoutConfig["sections"][number];
  layout: InvoiceCardLayoutConfig;
  onNameChange: (name: string) => void;
  onAssign: (spotIndex: number, fieldId: FieldId | null) => void;
  onAddSpot: () => void;
  onRemoveSpot: (spotIndex: number) => void;
}) {
  const assignedElsewhere = new Set<FieldId>();
  for (const entry of layout.sections) {
    if (entry.id === section.id) continue;
    for (const fieldId of entry.assignments) {
      if (fieldId) assignedElsewhere.add(fieldId);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Section name
          </label>
          <Input
            value={section.name}
            onChange={(event) => onNameChange(event.target.value)}
            className="mt-1 h-9"
            maxLength={32}
          />
        </div>
        <p className="max-w-xs text-xs text-muted-foreground">{sectionDescriptions[section.id]}</p>
      </div>

      <div className="space-y-2 p-3">
        {section.assignments.map((assignedFieldId, spotIndex) => (
          <div
            key={`${section.id}-${spotIndex}`}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
              {spotIndex + 1}
            </span>
            <Select
              value={assignedFieldId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onAssign(spotIndex, value ? (value as FieldId) : null);
              }}
              className="h-9"
            >
              <option value="">Empty spot</option>
              {Object.entries(fieldLabels).map(([fieldId, label]) => {
                const id = fieldId as FieldId;
                const disabled =
                  assignedElsewhere.has(id) ||
                  section.assignments.some((assigned, index) => assigned === id && index !== spotIndex);

                return (
                  <option key={fieldId} value={fieldId} disabled={disabled}>
                    {label}
                  </option>
                );
              })}
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Remove spot"
              aria-label={`Remove spot ${spotIndex + 1}`}
              disabled={section.assignments.length <= 1}
              onClick={() => onRemoveSpot(spotIndex)}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={section.assignments.length >= 6}
          onClick={onAddSpot}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add spot
        </Button>
      </div>
    </div>
  );
}

function InvoiceCard({
  fieldMap,
  layout,
  invoice,
  visibleSet,
}: {
  fieldMap: Map<FieldId, Field>;
  layout: InvoiceCardLayoutConfig;
  invoice: InvoiceListRow;
  visibleSet: Set<FieldId>;
}) {
  const mainSection = layout.sections.find((section) => section.id === "main");
  const sideSection = layout.sections.find((section) => section.id === "side");
  const footerSection = layout.sections.find((section) => section.id === "footer");

  const invoiceField = visibleSet.has("invoice") ? fieldMap.get("invoice") : undefined;
  const customerField = visibleSet.has("customer") ? fieldMap.get("customer") : undefined;

  const resolveSpotFields = (sectionId: SectionId) => {
    const section = layout.sections.find((entry) => entry.id === sectionId);
    if (!section) return [];

    return section.assignments
      .map((fieldId) => {
        if (!fieldId || !visibleSet.has(fieldId)) return null;
        if (fieldId === "invoice" || fieldId === "customer") return null;
        return fieldMap.get(fieldId) ?? null;
      })
      .filter((field): field is Field => Boolean(field));
  };

  const mainFields = resolveSpotFields("main");
  const sideFields = resolveSpotFields("side");
  const footerFields = resolveSpotFields("footer");
  const showSide = sideFields.length > 0;

  const displayStatus = getDisplayStatus(invoice.status);

  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      <div
        className={cn(
          "grid gap-3 p-3",
          showSide
            ? "sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-stretch"
            : "sm:grid-cols-[minmax(0,1fr)]",
        )}
      >
        <div className="relative min-w-0 space-y-3">
          <Badge
            variant="secondary"
            className={cn(
              "absolute right-0 top-0 text-[10px] uppercase",
              STATUS_STYLES[displayStatus] ?? "bg-muted text-muted-foreground",
            )}
          >
            {formatDisplayStatus(displayStatus)}
          </Badge>

          {invoiceField || customerField ? (
            <div className="min-w-0 pr-20">
              {invoiceField ? (
                <InvoiceField field={invoiceField} invoice={invoice} emphasis hideLabel />
              ) : null}
              {customerField ? (
                <div className={invoiceField ? "mt-1" : undefined}>
                  <InvoiceField field={customerField} invoice={invoice} hideLabel />
                </div>
              ) : null}
            </div>
          ) : null}

          {mainFields.length && mainSection ? (
            <CardSectionGroup name={mainSection.name} horizontal>
              {mainFields.map((field) => (
                <InvoiceField key={field.id} field={field} invoice={invoice} />
              ))}
            </CardSectionGroup>
          ) : null}
        </div>

        {showSide && sideSection ? (
          <div className="border-t pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <CardSectionGroup name={sideSection.name}>
              {sideFields.map((field) => (
                <InvoiceField key={field.id} field={field} invoice={invoice} compact />
              ))}
            </CardSectionGroup>
          </div>
        ) : null}
      </div>

      {footerFields.length && footerSection ? (
        <div className="border-t bg-muted/20 p-3">
          <CardSectionGroup name={footerSection.name} horizontal>
            {footerFields.map((field) => (
              <InvoiceField key={field.id} field={field} invoice={invoice} compact />
            ))}
          </CardSectionGroup>
        </div>
      ) : null}
    </Card>
  );
}

function CardSectionGroup({
  name,
  horizontal = false,
  children,
}: {
  name: string;
  horizontal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {name}
      </div>
      <div
        className={cn(
          horizontal
            ? "grid grid-cols-2 gap-x-3 gap-y-4 min-[430px]:grid-cols-3"
            : "space-y-2.5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function InvoiceField({
  field,
  invoice,
  emphasis = false,
  hideLabel = false,
  compact = false,
}: {
  field: Field;
  invoice: InvoiceListRow;
  emphasis?: boolean;
  hideLabel?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      {hideLabel ? null : (
        <div
          className={cn(
            "font-medium uppercase text-muted-foreground",
            compact ? "text-[10px] leading-tight" : "text-xs",
          )}
        >
          {field.label}
        </div>
      )}
      <div
        className={cn(
          "min-w-0 tabular-nums text-foreground",
          compact ? "text-xs" : "text-sm",
          hideLabel ? "mt-0" : "mt-1",
          emphasis ? "font-semibold leading-snug" : "truncate",
        )}
      >
        {field.render(invoice)}
      </div>
    </div>
  );
}
