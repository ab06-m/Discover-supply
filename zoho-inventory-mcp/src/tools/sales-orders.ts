import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost, zohoPut, zohoStatusAction } from "../zoho-client.js";

export function registerSalesOrderTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Create a Sales Order
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_create_sales_order",
    "Create a new Sales Order in Zoho Inventory. This is the core tool for placing orders — from phone, in-person, or programmatic sources.",
    {
      customer_id: z.string().describe("Zoho contact_id of the customer"),
      line_items: z
        .array(
          z.object({
            item_id: z.string().describe("Zoho item_id"),
            quantity: z.number().describe("Quantity to order"),
            rate: z.number().optional().describe("Override price (uses default if omitted)"),
          })
        )
        .describe("Array of items to include in the order"),
      date: z.string().optional().describe("Order date in YYYY-MM-DD format"),
      shipment_date: z.string().optional().describe("Expected delivery date YYYY-MM-DD"),
      reference_number: z.string().optional().describe("External reference number"),
      notes: z.string().optional().describe("Internal notes"),
      custom_fields: z
        .array(
          z.object({
            label: z.string().describe("Custom field label (e.g., 'Order Source')"),
            value: z.string().describe("Custom field value"),
          })
        )
        .optional()
        .describe("Custom field values (Order Source, Payment Method, Driver, etc.)"),
      is_confirmed: z.boolean().optional().describe("Confirm immediately? (default true — commits inventory)"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          customer_id: params.customer_id,
          line_items: params.line_items,
        };
        if (params.date) body.date = params.date;
        if (params.shipment_date) body.shipment_date = params.shipment_date;
        if (params.reference_number) body.reference_number = params.reference_number;
        if (params.notes) body.notes = params.notes;
        if (params.custom_fields) body.custom_fields = params.custom_fields;

        const res = await zohoPost("/salesorders", body);
        const so = res.data.salesorder;

        // Auto-confirm unless explicitly set to false
        if (params.is_confirmed !== false) {
          try {
            await zohoStatusAction(`/salesorders/${so.salesorder_id}/status/confirmed`);
          } catch {
            // If confirm fails, still return the created SO
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Sales Order created: **${so.salesorder_number}** | Customer: ${so.customer_name} | Total: $${so.total} | ${params.is_confirmed !== false ? "Status: Confirmed (inventory committed)" : "Status: Draft"} | ID: ${so.salesorder_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // List Sales Orders
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_sales_orders",
    "List Sales Orders with status and date filters. Use to find orders by status (draft, confirmed, closed, void) or custom sub-status.",
    {
      status: z
        .enum(["draft", "confirmed", "closed", "void", "all"])
        .optional()
        .describe("Filter by SO status"),
      customer_id: z.string().optional().describe("Filter by customer"),
      date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
      date_to: z.string().optional().describe("End date YYYY-MM-DD"),
      search_text: z.string().optional().describe("Search by SO number or reference"),
      sort_column: z
        .enum(["salesorder_number", "customer_name", "date", "total", "created_time"])
        .optional(),
      sort_order: z.enum(["ascending", "descending"]).optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
    },
    async (params) => {
      try {
        const queryParams: Record<string, any> = {
          page: params.page ?? 1,
          per_page: params.per_page ?? 25,
        };
        if (params.status && params.status !== "all") queryParams.status = params.status;
        if (params.customer_id) queryParams.customer_id = params.customer_id;
        if (params.search_text) queryParams.search_text = params.search_text;
        if (params.sort_column) queryParams.sort_column = params.sort_column;
        if (params.sort_order) queryParams.sort_order = params.sort_order;

        const res = await zohoGet("/salesorders", queryParams);
        const orders = res.data.salesorders ?? [];
        if (orders.length === 0) {
          return { content: [{ type: "text", text: "No sales orders found." }] };
        }

        const header = `| SO# | Customer | Date | Total | Status | ID |\n|-----|----------|------|-------|--------|----|\n`;
        const rows = orders
          .map(
            (so: any) =>
              `| ${so.salesorder_number} | ${so.customer_name} | ${so.date} | $${so.total} | ${so.status}${so.sub_status ? ` (${so.sub_status})` : ""} | ${so.salesorder_id} |`
          )
          .join("\n");
        const pageInfo = res.page_context
          ? `\n\nPage ${res.page_context.page} | Total: ${res.page_context.total}`
          : "";
        return { content: [{ type: "text", text: `${header}${rows}${pageInfo}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get Sales Order details
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_sales_order",
    "Get full details of a Sales Order including line items, custom fields, and status.",
    {
      salesorder_id: z.string().describe("The Zoho sales order ID"),
    },
    async ({ salesorder_id }) => {
      try {
        const res = await zohoGet(`/salesorders/${salesorder_id}`);
        const so = res.data.salesorder;
        const items = (so.line_items ?? [])
          .map(
            (li: any) =>
              `  • ${li.name} — Qty: ${li.quantity} × $${li.rate} = $${li.item_total}`
          )
          .join("\n");
        const customFields = (so.custom_fields ?? [])
          .map((cf: any) => `  ${cf.label}: ${cf.value || "—"}`)
          .join("\n");
        const details = [
          `**Sales Order: ${so.salesorder_number}**`,
          `Customer: ${so.customer_name}`,
          `Date: ${so.date} | Delivery: ${so.shipment_date || "—"}`,
          `Status: ${so.status}${so.sub_status ? ` → ${so.sub_status}` : ""}`,
          `Subtotal: $${so.sub_total} | Tax: $${so.tax_total} | **Total: $${so.total}**`,
          `\nLine Items:\n${items}`,
          customFields ? `\nCustom Fields:\n${customFields}` : "",
          `\nReference: ${so.reference_number || "—"}`,
          `Notes: ${so.notes || "—"}`,
          `SO ID: ${so.salesorder_id}`,
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Update Sales Order (including sub-status changes)
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_update_sales_order",
    "Update a Sales Order — change items, quantities, custom fields, or sub-status (Picking, Packed, Ready for Dispatch).",
    {
      salesorder_id: z.string().describe("The Zoho sales order ID"),
      customer_id: z.string().optional().describe("Update customer (requires re-specifying all fields)"),
      line_items: z
        .array(
          z.object({
            item_id: z.string(),
            quantity: z.number(),
            rate: z.number().optional(),
          })
        )
        .optional()
        .describe("Updated line items (replaces existing)"),
      shipment_date: z.string().optional().describe("New expected delivery date"),
      reference_number: z.string().optional(),
      notes: z.string().optional(),
      custom_fields: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          })
        )
        .optional()
        .describe("Custom field updates (sub-status, driver, etc.)"),
    },
    async ({ salesorder_id, ...updates }) => {
      try {
        const body: Record<string, any> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) body[k] = v;
        }
        const res = await zohoPut(`/salesorders/${salesorder_id}`, body);
        const so = res.data.salesorder;
        return {
          content: [
            {
              type: "text",
              text: `✅ Sales Order updated: **${so.salesorder_number}** | Status: ${so.status}${so.sub_status ? ` → ${so.sub_status}` : ""}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Confirm Sales Order
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_confirm_sales_order",
    "Confirm a draft Sales Order. This commits inventory — reserved stock increases, available stock decreases.",
    {
      salesorder_id: z.string().describe("The Zoho sales order ID to confirm"),
    },
    async ({ salesorder_id }) => {
      try {
        await zohoStatusAction(`/salesorders/${salesorder_id}/status/confirmed`);
        return {
          content: [
            {
              type: "text",
              text: `✅ Sales Order ${salesorder_id} confirmed — inventory is now committed.`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Void Sales Order
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_void_sales_order",
    "Void a Sales Order. This releases all committed inventory back to available stock. ⚠️ This action cannot be undone.",
    {
      salesorder_id: z.string().describe("The Zoho sales order ID to void"),
    },
    async ({ salesorder_id }) => {
      try {
        await zohoStatusAction(`/salesorders/${salesorder_id}/status/void`);
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Sales Order ${salesorder_id} voided — committed inventory has been released.`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
