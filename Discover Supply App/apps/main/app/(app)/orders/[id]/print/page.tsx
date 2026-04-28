import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireActiveOrg } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getOrder } from "@/modules/orders/queries";
import { OrderRender } from "@/modules/orders/components/order-render";
import { DEFAULT_ORDER_TEMPLATE_CONFIG, type OrderTemplateConfig } from "@/modules/orders/schema";
import {
  ensureOrderTemplatePresets,
  type OrderTemplateLayout,
} from "@/modules/orders/template-presets";
import {
  getDefaultOrderTemplate,
  getOrderTemplate,
} from "@/modules/orders/template-queries";

export const dynamic = "force-dynamic";

export default async function PrintOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { id } = await params;
  const { template: templateId } = await searchParams;

  const record = await getOrder(org.id, id);
  if (!record) notFound();

  await ensureOrderTemplatePresets(org.id);

  const template = templateId
    ? await getOrderTemplate(org.id, templateId)
    : await getDefaultOrderTemplate(org.id);

  const config: OrderTemplateConfig = {
    ...DEFAULT_ORDER_TEMPLATE_CONFIG,
    ...((template?.config as OrderTemplateConfig | undefined) ?? {}),
  };
  const layout = (template?.layout ?? "clean") as OrderTemplateLayout;

  let orgAddress: unknown = null;
  const orgRow = await db
    .select({ settings: schema.organizations.settings })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, org.id))
    .limit(1);
  if (orgRow.length) {
    const settings = orgRow[0].settings as Record<string, unknown> | null;
    orgAddress = settings?.address ?? null;
  }

  return (
    <html>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('load', () => setTimeout(() => window.print(), 200));",
          }}
        />
        <OrderRender
          layout={layout}
          config={config}
          org={{
            name: org.name,
            logoUrl: org.logoUrl ?? config.logoUrl ?? null,
            currency: org.currency,
            address: orgAddress as any,
          }}
          customer={record.customer}
          order={{
            number: record.order.number,
            stage: record.stage?.name ?? null,
            issueDate: record.order.createdAt,
            subtotal: record.order.subtotal,
            taxTotal: record.order.taxTotal,
            discountTotal: record.order.discountTotal,
            total: record.order.total,
            notes: record.order.notes,
          }}
          items={record.items.map((it) => ({
            name: it.name,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount,
            taxRate: it.taxRate,
            lineTotal: it.lineTotal,
          }))}
        />
      </body>
    </html>
  );
}
