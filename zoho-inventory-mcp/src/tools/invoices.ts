import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoStatusAction } from "../zoho-client.js";

export function registerInvoiceTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // List Invoices
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_invoices",
    "List invoices with filters by status, customer, or date range.",
    {
      status: z
        .enum(["draft", "sent", "overdue", "paid", "void", "unpaid", "partially_paid"])
        .optional()
        .describe("Filter by invoice status"),
      customer_id: z.string().optional().describe("Filter by customer"),
      date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
      date_to: z.string().optional().describe("End date YYYY-MM-DD"),
      search_text: z.string().optional().describe("Search by invoice number"),
      page: z.number().optional(),
      per_page: z.number().optional(),
    },
    async (params) => {
      try {
        const queryParams: Record<string, any> = {
          page: params.page ?? 1,
          per_page: params.per_page ?? 25,
        };
        if (params.status) queryParams.status = params.status;
        if (params.customer_id) queryParams.customer_id = params.customer_id;
        if (params.search_text) queryParams.search_text = params.search_text;

        const res = await zohoGet("/invoices", queryParams);
        const invoices = res.data.invoices ?? [];
        if (invoices.length === 0) {
          return { content: [{ type: "text", text: "No invoices found." }] };
        }

        const header = `| Invoice# | Customer | Date | Due Date | Total | Balance | Status |\n|----------|----------|------|----------|-------|---------|--------|\n`;
        const rows = invoices
          .map(
            (inv: any) =>
              `| ${inv.invoice_number} | ${inv.customer_name} | ${inv.date} | ${inv.due_date} | $${inv.total} | $${inv.balance} | ${inv.status} |`
          )
          .join("\n");
        return { content: [{ type: "text", text: `${header}${rows}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get Invoice details
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_invoice",
    "Get full details of an invoice including line items, payments, and custom fields.",
    {
      invoice_id: z.string().describe("The Zoho invoice ID"),
    },
    async ({ invoice_id }) => {
      try {
        const res = await zohoGet(`/invoices/${invoice_id}`);
        const inv = res.data.invoice;
        const items = (inv.line_items ?? [])
          .map(
            (li: any) =>
              `  • ${li.name} — Qty: ${li.quantity} × $${li.rate} = $${li.item_total}`
          )
          .join("\n");
        const payments = (inv.payments ?? [])
          .map(
            (p: any) =>
              `  💰 $${p.amount} via ${p.payment_mode || "—"} on ${p.date} (Ref: ${p.reference_number || "—"})`
          )
          .join("\n");
        const customFields = (inv.custom_fields ?? [])
          .map((cf: any) => `  ${cf.label}: ${cf.value || "—"}`)
          .join("\n");

        const details = [
          `**Invoice: ${inv.invoice_number}**`,
          `Customer: ${inv.customer_name}`,
          `Date: ${inv.date} | Due: ${inv.due_date}`,
          `Status: ${inv.status}`,
          `Subtotal: $${inv.sub_total} | Tax: $${inv.tax_total} | **Total: $${inv.total}**`,
          `Balance Due: $${inv.balance}`,
          `\nLine Items:\n${items}`,
          payments ? `\nPayments:\n${payments}` : "\nNo payments recorded.",
          customFields ? `\nCustom Fields:\n${customFields}` : "",
          `\nInvoice ID: ${inv.invoice_id}`,
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Void an Invoice
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_void_invoice",
    "Void an invoice. ⚠️ This reverses the invoice and the associated inventory transaction. Cannot be undone.",
    {
      invoice_id: z.string().describe("The Zoho invoice ID to void"),
    },
    async ({ invoice_id }) => {
      try {
        await zohoStatusAction(`/invoices/${invoice_id}/status/void`);
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Invoice ${invoice_id} has been voided.`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
