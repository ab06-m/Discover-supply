"use client";

import { useMemo, useState } from "react";
import type React from "react";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  FileText,
  Image,
  Palette,
  PanelRight,
  ReceiptText,
  Save,
  Settings2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG, type InvoiceTemplateConfig } from "../schema";
import { InvoiceRender } from "./invoice-render";
import type { InvoiceTemplateLayout } from "../template-presets";

type LayoutOption = {
  value: InvoiceTemplateLayout;
  label: string;
};

export type InvoiceTemplateEditorItem = {
  id: string;
  name: string;
  layout: InvoiceTemplateLayout;
  isDefault: boolean;
  config: InvoiceTemplateConfig;
};

type CompanyInfo = {
  name: string;
  logoUrl?: string | null;
  currency: string;
};

type MergeField = {
  key: string;
  label: string;
};

type SaveInvoiceTemplateAction = (formData: FormData) => Promise<void>;

export function InvoiceTemplateManager({
  templates,
  layouts,
  mergeFields,
  companyInfo,
  canManage,
  saveAction,
}: {
  templates: InvoiceTemplateEditorItem[];
  layouts: ReadonlyArray<LayoutOption>;
  mergeFields: ReadonlyArray<MergeField>;
  companyInfo: CompanyInfo;
  canManage: boolean;
  saveAction: SaveInvoiceTemplateAction;
}) {
  const [activeId, setActiveId] = useState(templates[0]?.id ?? "");
  const [drafts, setDrafts] = useState<InvoiceTemplateEditorItem[]>(templates);
  const [mobileView, setMobileView] = useState<"preview" | "edit">("preview");

  const activeTemplate = drafts.find((template) => template.id === activeId) ?? drafts[0];

  function updateActive(patch: Partial<Omit<InvoiceTemplateEditorItem, "config">>) {
    setDrafts((current) =>
      current.map((template) =>
        template.id === activeTemplate.id ? { ...template, ...patch } : template,
      ),
    );
  }

  function updateConfig(patch: Partial<InvoiceTemplateConfig>) {
    setDrafts((current) =>
      current.map((template) =>
        template.id === activeTemplate.id
          ? { ...template, config: { ...template.config, ...patch } }
          : template,
      ),
    );
  }

  function updateDefaultTemplate(checked: boolean) {
    setDrafts((current) =>
      current.map((template) =>
        template.id === activeTemplate.id
          ? { ...template, isDefault: checked }
          : checked
            ? { ...template, isDefault: false }
            : template,
      ),
    );
  }

  if (!activeTemplate) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No invoice templates are available yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TemplateSelector
        templates={drafts}
        activeId={activeTemplate.id}
        onSelect={setActiveId}
      />

      <div className="flex gap-2 rounded-lg border bg-card p-1 md:hidden">
        <ViewTab active={mobileView === "preview"} onClick={() => setMobileView("preview")}>
          <Eye className="h-4 w-4" />
          Preview
        </ViewTab>
        <ViewTab active={mobileView === "edit"} onClick={() => setMobileView("edit")}>
          <PanelRight className="h-4 w-4" />
          Edit
        </ViewTab>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className={cn(mobileView !== "preview" && "hidden md:block")}>
          <InvoicePreview
            template={activeTemplate}
            companyInfo={companyInfo}
          />
        </div>

        <div className={cn(mobileView !== "edit" && "hidden md:block")}>
          <form action={saveAction} className="sticky top-4 space-y-4">
            <input type="hidden" name="id" value={activeTemplate.id} />
            <input type="hidden" name="layout" value={activeTemplate.layout} />

            <div className="overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="border-b bg-muted/25 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h2 className="text-base font-semibold">Template editor</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Changes update the invoice preview immediately.
                    </p>
                  </div>
                  {activeTemplate.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Default
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="max-h-none space-y-3 p-4 xl:max-h-[calc(100vh-15rem)] xl:overflow-y-auto">
                <EditorSection icon={FileText} title="Template settings" defaultOpen>
                  <Field label="Template name" htmlFor="invoice-template-name">
                    <Input
                      id="invoice-template-name"
                      name="name"
                      value={activeTemplate.name}
                      onChange={(event) => updateActive({ name: event.target.value })}
                      required
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Layout" htmlFor="invoice-template-layout">
                      <Select
                        id="invoice-template-layout"
                        value={activeTemplate.layout}
                        onChange={(event) =>
                          updateActive({ layout: event.target.value as InvoiceTemplateLayout })
                        }
                      >
                        {layouts.map((layout) => (
                          <option key={layout.value} value={layout.value}>
                            {layout.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Date format" htmlFor="invoice-date-format">
                      <Select
                        id="invoice-date-format"
                        name="dateFormat"
                        value={activeTemplate.config.dateFormat}
                        onChange={(event) =>
                          updateConfig({
                            dateFormat: event.target.value as InvoiceTemplateConfig["dateFormat"],
                          })
                        }
                      >
                        <option value="us">MM/DD/YYYY</option>
                        <option value="iso">YYYY-MM-DD</option>
                        <option value="eu">DD/MM/YYYY</option>
                      </Select>
                    </Field>
                  </div>

                  <Toggle
                    name="isDefault"
                    label="Use as default invoice template"
                    checked={activeTemplate.isDefault}
                    onChange={updateDefaultTemplate}
                  />
                </EditorSection>

                <EditorSection icon={Palette} title="Branding and colors" defaultOpen>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColorField
                      id="invoice-brand-color"
                      name="brandColor"
                      label="Brand color"
                      value={activeTemplate.config.brandColor}
                      onChange={(value) => updateConfig({ brandColor: value })}
                    />
                    <ColorField
                      id="invoice-accent-color"
                      name="accentColor"
                      label="Accent color"
                      value={activeTemplate.config.accentColor}
                      onChange={(value) => updateConfig({ accentColor: value })}
                    />
                  </div>

                  <Field label="Preview font" htmlFor="invoice-font">
                    <Select
                      id="invoice-font"
                      name="fontFamily"
                      value={activeTemplate.config.fontFamily}
                      onChange={(event) =>
                        updateConfig({
                          fontFamily: event.target.value as InvoiceTemplateConfig["fontFamily"],
                        })
                      }
                    >
                      <option value="sans">Sans</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Mono</option>
                    </Select>
                  </Field>
                </EditorSection>

                <EditorSection icon={Image} title="Logo">
                  <Field label="Logo URL" htmlFor="invoice-logo-url">
                    <Input
                      id="invoice-logo-url"
                      name="logoUrl"
                      value={activeTemplate.config.logoUrl ?? ""}
                      onChange={(event) => updateConfig({ logoUrl: event.target.value })}
                      placeholder="https://..."
                    />
                  </Field>

                  <Toggle
                    name="showLogo"
                    label="Show logo on invoice"
                    checked={activeTemplate.config.showLogo}
                    onChange={(checked) => updateConfig({ showLogo: checked })}
                  />
                </EditorSection>

                <EditorSection icon={ReceiptText} title="Invoice fields" defaultOpen>
                  <div className="grid gap-2">
                    <Toggle
                      name="showDueDate"
                      label="Show due date"
                      checked={activeTemplate.config.showDueDate}
                      onChange={(checked) => updateConfig({ showDueDate: checked })}
                    />
                    <Toggle
                      name="showOrderNumber"
                      label="Show order number"
                      checked={activeTemplate.config.showOrderNumber}
                      onChange={(checked) => updateConfig({ showOrderNumber: checked })}
                    />
                    <Toggle
                      name="showTaxBreakdown"
                      label="Show tax breakdown"
                      checked={activeTemplate.config.showTaxBreakdown}
                      onChange={(checked) => updateConfig({ showTaxBreakdown: checked })}
                    />
                    <Toggle
                      name="showPaymentInstructions"
                      label="Show payment instructions"
                      checked={activeTemplate.config.showPaymentInstructions}
                      onChange={(checked) => updateConfig({ showPaymentInstructions: checked })}
                    />
                  </div>
                </EditorSection>

                <EditorSection icon={Type} title="Header, footer, and terms">
                  <Field label="Header / note text" htmlFor="invoice-header-text">
                    <Textarea
                      id="invoice-header-text"
                      name="headerText"
                      rows={3}
                      value={activeTemplate.config.headerText ?? ""}
                      onChange={(event) => updateConfig({ headerText: event.target.value })}
                    />
                  </Field>

                  <Field label="Footer text" htmlFor="invoice-footer-text">
                    <Textarea
                      id="invoice-footer-text"
                      name="footerText"
                      rows={3}
                      value={activeTemplate.config.footerText ?? ""}
                      onChange={(event) => updateConfig({ footerText: event.target.value })}
                    />
                  </Field>

                  <Field label="Terms" htmlFor="invoice-terms-text">
                    <Textarea
                      id="invoice-terms-text"
                      name="termsText"
                      rows={3}
                      value={activeTemplate.config.termsText ?? ""}
                      onChange={(event) => updateConfig({ termsText: event.target.value })}
                    />
                  </Field>

                  <Field label="Payment instructions" htmlFor="invoice-payment-instructions">
                    <Textarea
                      id="invoice-payment-instructions"
                      name="paymentInstructions"
                      rows={3}
                      value={activeTemplate.config.paymentInstructions ?? ""}
                      onChange={(event) =>
                        updateConfig({ paymentInstructions: event.target.value })
                      }
                    />
                  </Field>
                </EditorSection>

                <EditorSection icon={CalendarDays} title="Merge fields">
                  <div className="flex flex-wrap gap-2">
                    {mergeFields.map((field) => (
                      <span
                        key={field.key}
                        title={field.label}
                        className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground"
                      >
                        {"{{"}
                        {field.key}
                        {"}}"}
                      </span>
                    ))}
                  </div>
                </EditorSection>
              </div>

              <div className="sticky bottom-0 border-t bg-card/95 p-4 backdrop-blur">
                <Button
                  type="submit"
                  disabled={!canManage}
                  className="h-11 w-full gap-2 shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  Save template
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function TemplateSelector({
  templates,
  activeId,
  onSelect,
}: {
  templates: InvoiceTemplateEditorItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Invoice templates</h2>
          <p className="text-xs text-muted-foreground">Select a template to preview and edit.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={cn(
              "rounded-lg border bg-background/45 p-3 text-left transition hover:border-primary/70 hover:bg-accent/40",
              activeId === template.id && "border-primary bg-primary/10 shadow-sm",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{template.name}</div>
                <div className="mt-1 text-xs capitalize text-muted-foreground">
                  {template.layout === "clean" ? "modern" : template.layout}
                </div>
              </div>
              {template.isDefault ? (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  Default
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className="h-5 flex-1 rounded-full border"
                style={{ backgroundColor: template.config.brandColor }}
              />
              <span
                className="h-5 flex-1 rounded-full border"
                style={{ backgroundColor: template.config.accentColor }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InvoicePreview({
  template,
  companyInfo,
}: {
  template: InvoiceTemplateEditorItem;
  companyInfo: CompanyInfo;
}) {
  const sample = useMemo(() => {
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(issueDate.getDate() + 7);
    const taxTotal = template.config.showTaxBreakdown ? 32 : 0;
    const total = 400 + taxTotal;

    return {
      org: {
        name: companyInfo.name || "My Company",
        logoUrl: companyInfo.logoUrl,
        currency: companyInfo.currency || "USD",
        address: {
          line1: "125 Market Street",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA",
        },
      },
      customer: {
        name: "Sample Customer",
        storeCode: "CUST-001",
        email: "billing@example.com",
        billingAddress: {
          line1: "48 Client Avenue",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11201",
          country: "USA",
        },
      },
      invoice: {
        number: "INV-001",
        status: "draft",
        issueDate,
        dueDate,
        subtotal: "400.00",
        taxTotal: taxTotal.toFixed(2),
        discountTotal: "0.00",
        total: total.toFixed(2),
        amountPaid: "0.00",
        notes: "Delivery scheduled after payment confirmation.",
        terms: null,
        orderNumber: "SO-001",
      },
      items: [
        {
          name: "Service Item 1",
          sku: "SVC-001",
          quantity: 1,
          unitPrice: "250.00",
          lineTotal: "250.00",
        },
        {
          name: "Service Item 2",
          sku: "SVC-002",
          quantity: 1,
          unitPrice: "150.00",
          lineTotal: "150.00",
        },
      ],
    };
  }, [companyInfo.currency, companyInfo.logoUrl, companyInfo.name, template.config.showTaxBreakdown]);

  const previewConfig = useMemo(
    () => ({
      ...template.config,
      brandColor: template.config.brandColor || DEFAULT_INVOICE_TEMPLATE_CONFIG.brandColor,
      accentColor: template.config.accentColor || DEFAULT_INVOICE_TEMPLATE_CONFIG.accentColor,
    }),
    [template.config],
  );

  return (
    <div className="rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Live invoice preview</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Sample invoice data shows how this template will look when shared.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" />
          Live
        </div>
      </div>

      <div className="overflow-auto bg-slate-950/35 p-3 sm:p-6">
        <div className="mx-auto w-full max-w-[820px] overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-white/10">
          <InvoiceRender
            layout={template.layout}
            config={previewConfig}
            org={sample.org}
            customer={sample.customer}
            invoice={sample.invoice}
            items={sample.items}
            previewMode
          />
        </div>
      </div>
    </div>
  );
}

function EditorSection({
  icon: Icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-lg border bg-background/35" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </span>
        <span className="text-xs text-muted-foreground transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3">{children}</div>
    </details>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2 rounded-md border bg-card p-1.5">
        <Input
          id={id}
          name={name}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-12 border-0 p-0"
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </Field>
  );
}

function Toggle({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex h-6 w-11 items-center rounded-full p-0.5 transition",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow-sm transition",
            checked && "translate-x-5",
          )}
        >
          {checked ? <Check className="h-3 w-3" /> : null}
        </span>
      </span>
    </label>
  );
}

function ViewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
