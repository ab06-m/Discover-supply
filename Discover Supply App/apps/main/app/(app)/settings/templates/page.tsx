import Link from "next/link";
import { requireActiveOrg } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { can, type Role } from "@/lib/permissions";
import { saveInvoiceTemplate } from "@/modules/invoices/actions";
import { saveOrderTemplate } from "@/modules/orders/actions";
import { AVAILABLE_MERGE_FIELDS } from "@/modules/invoices/lib/merge-fields";
import { AVAILABLE_ORDER_MERGE_FIELDS } from "@/modules/orders/lib/merge-fields";
import { listTemplates } from "@/modules/invoices/queries";
import { listOrderTemplates } from "@/modules/orders/template-queries";
import {
  DEFAULT_INVOICE_TEMPLATE_CONFIG,
  type InvoiceTemplateConfig,
} from "@/modules/invoices/schema";
import {
  DEFAULT_ORDER_TEMPLATE_CONFIG,
  type OrderTemplateConfig,
} from "@/modules/orders/schema";
import {
  ensureInvoiceTemplatePresets,
  INVOICE_TEMPLATE_LAYOUTS,
} from "@/modules/invoices/template-presets";
import {
  ensureOrderTemplatePresets,
  ORDER_TEMPLATE_LAYOUTS,
} from "@/modules/orders/template-presets";
import { ORDER_TEMPLATES_MIGRATION_MESSAGE } from "@/modules/orders/template-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TemplateType = "invoice" | "order";

function asInvoiceConfig(config: unknown): InvoiceTemplateConfig {
  return {
    ...DEFAULT_INVOICE_TEMPLATE_CONFIG,
    ...((config && typeof config === "object" ? config : {}) as Partial<InvoiceTemplateConfig>),
  };
}

function asOrderConfig(config: unknown): OrderTemplateConfig {
  return {
    ...DEFAULT_ORDER_TEMPLATE_CONFIG,
    ...((config && typeof config === "object" ? config : {}) as Partial<OrderTemplateConfig>),
  };
}

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const sp = await searchParams;
  const type: TemplateType = sp.type === "order" ? "order" : "invoice";

  await ensureInvoiceTemplatePresets(org.id);
  const orderTemplatesAvailable = await ensureOrderTemplatePresets(org.id);

  const invoiceTemplates = await listTemplates(org.id);
  const orderTemplates = await listOrderTemplates(org.id);
  const canManage = can(role as Role, "template.manage");

  async function saveInvoice(formData: FormData) {
    "use server";
    await saveInvoiceTemplate({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      layout: String(formData.get("layout") ?? "clean") as any,
      isDefault: checkbox(formData, "isDefault"),
      config: {
        brandColor: String(formData.get("brandColor") ?? DEFAULT_INVOICE_TEMPLATE_CONFIG.brandColor),
        accentColor: String(
          formData.get("accentColor") ?? DEFAULT_INVOICE_TEMPLATE_CONFIG.accentColor,
        ),
        fontFamily: String(
          formData.get("fontFamily") ?? DEFAULT_INVOICE_TEMPLATE_CONFIG.fontFamily,
        ) as InvoiceTemplateConfig["fontFamily"],
        logoUrl: String(formData.get("logoUrl") ?? ""),
        headerText: String(formData.get("headerText") ?? ""),
        footerText: String(formData.get("footerText") ?? ""),
        termsText: String(formData.get("termsText") ?? ""),
        paymentInstructions: String(formData.get("paymentInstructions") ?? ""),
        showLogo: checkbox(formData, "showLogo"),
        showTaxBreakdown: checkbox(formData, "showTaxBreakdown"),
        showPaymentInstructions: checkbox(formData, "showPaymentInstructions"),
        dateFormat: String(
          formData.get("dateFormat") ?? DEFAULT_INVOICE_TEMPLATE_CONFIG.dateFormat,
        ) as InvoiceTemplateConfig["dateFormat"],
        showDueDate: checkbox(formData, "showDueDate"),
        showOrderNumber: checkbox(formData, "showOrderNumber"),
      },
    });
  }

  async function saveOrder(formData: FormData) {
    "use server";
    await saveOrderTemplate({
      id: String(formData.get("id") ?? ""),
      name: String(formData.get("name") ?? ""),
      layout: String(formData.get("layout") ?? "clean") as any,
      isDefault: checkbox(formData, "isDefault"),
      config: {
        brandColor: String(formData.get("brandColor") ?? DEFAULT_ORDER_TEMPLATE_CONFIG.brandColor),
        accentColor: String(
          formData.get("accentColor") ?? DEFAULT_ORDER_TEMPLATE_CONFIG.accentColor,
        ),
        fontFamily: String(
          formData.get("fontFamily") ?? DEFAULT_ORDER_TEMPLATE_CONFIG.fontFamily,
        ) as OrderTemplateConfig["fontFamily"],
        logoUrl: String(formData.get("logoUrl") ?? ""),
        headerText: String(formData.get("headerText") ?? ""),
        footerText: String(formData.get("footerText") ?? ""),
        termsText: String(formData.get("termsText") ?? ""),
        showLogo: checkbox(formData, "showLogo"),
        showTaxBreakdown: checkbox(formData, "showTaxBreakdown"),
        dateFormat: String(
          formData.get("dateFormat") ?? DEFAULT_ORDER_TEMPLATE_CONFIG.dateFormat,
        ) as OrderTemplateConfig["dateFormat"],
        showOrderNumber: checkbox(formData, "showOrderNumber"),
        showCustomerAddress: checkbox(formData, "showCustomerAddress"),
        showSignatureBlock: checkbox(formData, "showSignatureBlock"),
      },
    });
  }

  const activeTemplates = type === "invoice" ? invoiceTemplates : orderTemplates;
  const activeMergeFields =
    type === "invoice" ? AVAILABLE_MERGE_FIELDS : AVAILABLE_ORDER_MERGE_FIELDS;
  const activeLayouts = type === "invoice" ? INVOICE_TEMPLATE_LAYOUTS : ORDER_TEMPLATE_LAYOUTS;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/settings"
        backLabel="Back to settings"
        title="Document templates"
        subtitle="Customize how invoices and sales orders look when printed or shared."
      />

      <div className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
        <Tab href="?type=invoice" active={type === "invoice"}>
          Invoice templates
        </Tab>
        <Tab href="?type=order" active={type === "order"}>
          Sales order templates
        </Tab>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Merge fields</CardTitle>
          <CardDescription>
            Drop these tokens into header, footer, terms, or other text fields below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {activeMergeFields.map((field) => (
              <span
                key={field.key}
                className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground"
                title={field.label}
              >
                {"{{"}
                {field.key}
                {"}}"}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {type === "order" && !orderTemplatesAvailable ? (
          <Card className="border-warning/30 bg-warning/5 shadow-card">
            <CardHeader>
              <CardTitle>Sales order templates need a database update</CardTitle>
              <CardDescription className="text-warning">
                {ORDER_TEMPLATES_MIGRATION_MESSAGE}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {activeTemplates.map((template) => {
          const config =
            type === "invoice"
              ? asInvoiceConfig(template.config)
              : asOrderConfig(template.config);
          const action = type === "invoice" ? saveInvoice : saveOrder;
          return (
            <Card key={template.id} className="shadow-card">
              <form action={action}>
                <input type="hidden" name="id" value={template.id} />
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {template.name}
                        {template.isDefault && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                            Default
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {template.layout === "clean"
                          ? "Modern visual style"
                          : `${template.layout[0]?.toUpperCase()}${template.layout.slice(1)} visual style`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-5 w-5 rounded-full border"
                        style={{ backgroundColor: config.brandColor }}
                      />
                      <span
                        className="h-5 w-5 rounded-full border"
                        style={{ backgroundColor: config.accentColor }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`name-${template.id}`}>Template name</Label>
                      <Input
                        id={`name-${template.id}`}
                        name="name"
                        defaultValue={template.name}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`layout-${template.id}`}>Layout</Label>
                      <Select
                        id={`layout-${template.id}`}
                        name="layout"
                        defaultValue={template.layout}
                      >
                        {activeLayouts.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 self-end rounded-md border bg-card px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        name="isDefault"
                        defaultChecked={template.isDefault}
                        className="h-4 w-4 accent-primary"
                      />
                      Use as default
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`brand-${template.id}`}>Brand color</Label>
                      <Input
                        id={`brand-${template.id}`}
                        name="brandColor"
                        type="color"
                        defaultValue={config.brandColor}
                        className="h-10 p-1"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`accent-${template.id}`}>Accent color</Label>
                      <Input
                        id={`accent-${template.id}`}
                        name="accentColor"
                        type="color"
                        defaultValue={config.accentColor}
                        className="h-10 p-1"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`font-${template.id}`}>Font</Label>
                      <Select
                        id={`font-${template.id}`}
                        name="fontFamily"
                        defaultValue={config.fontFamily}
                      >
                        <option value="sans">Sans</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Mono</option>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`date-${template.id}`}>Date format</Label>
                      <Select
                        id={`date-${template.id}`}
                        name="dateFormat"
                        defaultValue={config.dateFormat}
                      >
                        <option value="us">MM/DD/YYYY</option>
                        <option value="iso">YYYY-MM-DD</option>
                        <option value="eu">DD/MM/YYYY</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`logo-${template.id}`}>Logo URL</Label>
                    <Input
                      id={`logo-${template.id}`}
                      name="logoUrl"
                      defaultValue={config.logoUrl ?? ""}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {(type === "invoice"
                      ? ([
                          ["showLogo", "Show logo", config.showLogo],
                          [
                            "showTaxBreakdown",
                            "Show tax",
                            (config as InvoiceTemplateConfig).showTaxBreakdown,
                          ],
                          [
                            "showPaymentInstructions",
                            "Payment info",
                            (config as InvoiceTemplateConfig).showPaymentInstructions,
                          ],
                          [
                            "showDueDate",
                            "Due date",
                            (config as InvoiceTemplateConfig).showDueDate,
                          ],
                          ["showOrderNumber", "Order #", config.showOrderNumber],
                        ] as const)
                      : ([
                          ["showLogo", "Show logo", config.showLogo],
                          [
                            "showTaxBreakdown",
                            "Show tax",
                            (config as OrderTemplateConfig).showTaxBreakdown,
                          ],
                          ["showOrderNumber", "Order #", config.showOrderNumber],
                          [
                            "showCustomerAddress",
                            "Customer address",
                            (config as OrderTemplateConfig).showCustomerAddress,
                          ],
                          [
                            "showSignatureBlock",
                            "Signature line",
                            (config as OrderTemplateConfig).showSignatureBlock,
                          ],
                        ] as const)
                    ).map(([name, label, checked]) => (
                      <label
                        key={String(name)}
                        className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name={String(name)}
                          defaultChecked={Boolean(checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField
                      id={`header-${template.id}`}
                      name="headerText"
                      label="Header text"
                      defaultValue={config.headerText ?? ""}
                    />
                    <TextField
                      id={`footer-${template.id}`}
                      name="footerText"
                      label="Footer text"
                      defaultValue={config.footerText ?? ""}
                    />
                    <TextField
                      id={`terms-${template.id}`}
                      name="termsText"
                      label="Terms"
                      defaultValue={config.termsText ?? ""}
                    />
                    {type === "invoice" ? (
                      <TextField
                        id={`payment-${template.id}`}
                        name="paymentInstructions"
                        label="Payment instructions"
                        defaultValue={
                          (config as InvoiceTemplateConfig).paymentInstructions ?? ""
                        }
                      />
                    ) : null}
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={!canManage}>
                      Save template
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function TextField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} rows={3} defaultValue={defaultValue} />
    </div>
  );
}
