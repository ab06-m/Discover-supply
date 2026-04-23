import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost } from "../zoho-client.js";

export function registerPaymentTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Record a Payment
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_record_payment",
    "Record a customer payment (check, cash, card) against one or more invoices. For Discovery Supply's 'Check at Delivery' workflow.",
    {
      customer_id: z.string().describe("The Zoho customer contact_id"),
      amount: z.number().describe("Total payment amount"),
      date: z.string().optional().describe("Payment date (YYYY-MM-DD, defaults to today)"),
      payment_mode: z
        .enum(["check", "cash", "creditcard", "banktransfer", "bankremittance", "autotransaction", "others"])
        .optional()
        .describe("Payment method (default: check)"),
      reference_number: z.string().optional().describe("Check number or reference"),
      description: z.string().optional().describe("Payment description/notes"),
      invoice_id: z.string().optional().describe("Apply to specific invoice ID"),
      invoices: z
        .array(
          z.object({
            invoice_id: z.string().describe("Invoice ID"),
            amount_applied: z.number().describe("Amount to apply to this invoice"),
          })
        )
        .optional()
        .describe("Apply payment across multiple invoices"),
      bank_charges: z.number().optional().describe("Any bank processing charges"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          customer_id: params.customer_id,
          amount: params.amount,
          date: params.date || new Date().toISOString().split("T")[0],
          payment_mode: params.payment_mode || "check",
        };
        if (params.reference_number) body.reference_number = params.reference_number;
        if (params.description) body.description = params.description;
        if (params.bank_charges) body.bank_charges = params.bank_charges;

        // Apply to specific invoice(s)
        if (params.invoices) {
          body.invoices = params.invoices;
        } else if (params.invoice_id) {
          body.invoices = [
            { invoice_id: params.invoice_id, amount_applied: params.amount },
          ];
        }

        const res = await zohoPost("/customerpayments", body);
        const payment = res.data.payment;
        return {
          content: [
            {
              type: "text",
              text: `✅ Payment recorded: **$${payment.amount}** via ${payment.payment_mode || "check"} | Ref: ${payment.reference_number || "—"} | Payment ID: ${payment.payment_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // List Payments
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_payments",
    "List customer payments with optional filters.",
    {
      customer_id: z.string().optional().describe("Filter by customer"),
      date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
      date_to: z.string().optional().describe("End date YYYY-MM-DD"),
      page: z.number().optional(),
    },
    async (params) => {
      try {
        const queryParams: Record<string, any> = {
          page: params.page ?? 1,
        };
        if (params.customer_id) queryParams.customer_id = params.customer_id;

        const res = await zohoGet("/customerpayments", queryParams);
        const payments = res.data.customerpayments ?? res.data.payments ?? [];
        if (payments.length === 0) {
          return { content: [{ type: "text", text: "No payments found." }] };
        }
        const summary = payments
          .map(
            (p: any) =>
              `• **$${p.amount}** | ${p.payment_mode || "—"} | ${p.date} | Customer: ${p.customer_name || "—"} | Ref: ${p.reference_number || "—"} | ID: ${p.payment_id}`
          )
          .join("\n");
        return {
          content: [{ type: "text", text: `${payments.length} payment(s):\n\n${summary}` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
