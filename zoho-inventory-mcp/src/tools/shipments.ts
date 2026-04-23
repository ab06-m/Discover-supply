import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost, zohoStatusAction } from "../zoho-client.js";

export function registerShipmentTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Create a Shipment
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_create_shipment",
    "Create a shipment order from a package. This dispatches the package for delivery.",
    {
      salesorder_id: z.string().describe("The sales order ID"),
      package_ids: z
        .array(z.string())
        .describe("Array of package IDs to include in this shipment"),
      shipment_number: z.string().optional().describe("Custom shipment number"),
      date: z.string().optional().describe("Shipment date (YYYY-MM-DD)"),
      delivery_method: z.string().optional().describe("Delivery method (e.g., 'Company Driver', 'Pickup')"),
      tracking_number: z.string().optional().describe("Tracking number"),
      notes: z.string().optional().describe("Shipment notes"),
    },
    async (params) => {
      try {
        // Build the shipment body
        // Zoho requires the package line items for shipment creation
        const packages: any[] = [];
        for (const pkgId of params.package_ids) {
          const pkgRes = await zohoGet(`/packages/${pkgId}`);
          const pkg = pkgRes.data.package;
          packages.push({
            package_id: pkgId,
            line_items: (pkg.line_items ?? []).map((li: any) => ({
              so_line_item_id: li.so_line_item_id || li.line_item_id,
              quantity: li.quantity,
            })),
          });
        }

        const body: Record<string, any> = {
          salesorder_id: params.salesorder_id,
          shipment_number: params.shipment_number,
          date: params.date,
          delivery_method: params.delivery_method || "Company Driver",
          tracking_number: params.tracking_number,
          notes: params.notes,
          // Flatten line items from all packages
          line_items: packages.flatMap((p) => p.line_items),
        };

        const res = await zohoPost("/shipmentorders", body);
        const shipment = res.data.shipmentorder ?? res.data;
        return {
          content: [
            {
              type: "text",
              text: `✅ Shipment created: **${shipment.shipment_number || "Shipment"}** | SO: ${params.salesorder_id} | Shipment ID: ${shipment.shipment_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get Shipment details
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_shipment",
    "Get details of a shipment order including delivery status.",
    {
      shipment_id: z.string().describe("The Zoho shipment order ID"),
    },
    async ({ shipment_id }) => {
      try {
        const res = await zohoGet(`/shipmentorders/${shipment_id}`);
        const s = res.data.shipmentorder;
        const items = (s.line_items ?? [])
          .map((li: any) => `  • ${li.name || li.item_name} — Qty: ${li.quantity}`)
          .join("\n");
        const details = [
          `**Shipment: ${s.shipment_number}**`,
          `Sales Order: ${s.salesorder_number || "—"}`,
          `Date: ${s.date}`,
          `Status: ${s.status}`,
          `Delivery Method: ${s.delivery_method || "—"}`,
          `Tracking: ${s.tracking_number || "—"}`,
          `\nItems:\n${items}`,
          `\nShipment ID: ${s.shipment_id}`,
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Mark Shipment as Delivered
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_mark_delivered",
    "Mark a shipment as delivered. If the Sales Order Cycle is configured, this auto-generates an invoice.",
    {
      shipment_id: z.string().describe("The Zoho shipment order ID to mark as delivered"),
    },
    async ({ shipment_id }) => {
      try {
        await zohoStatusAction(`/shipmentorders/${shipment_id}/status/delivered`);
        return {
          content: [
            {
              type: "text",
              text: `✅ Shipment ${shipment_id} marked as **Delivered**. Invoice should auto-generate if Sales Order Cycle is configured.`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
