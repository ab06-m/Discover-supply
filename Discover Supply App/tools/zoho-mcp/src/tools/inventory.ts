import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost } from "../zoho-client.js";

export function registerInventoryTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Create Inventory Adjustment
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_adjust_inventory",
    "Create an inventory adjustment to correct stock levels (add or remove stock manually).",
    {
      date: z.string().optional().describe("Adjustment date (YYYY-MM-DD, defaults to today)"),
      reason: z.string().optional().describe("Reason for adjustment"),
      description: z.string().optional().describe("Description/notes"),
      adjustment_type: z
        .enum(["quantity", "value"])
        .optional()
        .describe("Type of adjustment (default: quantity)"),
      line_items: z
        .array(
          z.object({
            item_id: z.string().describe("Zoho item ID"),
            quantity_adjusted: z.number().describe("Quantity to add (positive) or remove (negative)"),
            warehouse_id: z.string().optional().describe("Specific warehouse ID"),
          })
        )
        .describe("Items and quantities to adjust"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          date: params.date || new Date().toISOString().split("T")[0],
          line_items: params.line_items,
          adjustment_type: params.adjustment_type || "quantity",
        };
        if (params.reason) body.reason = params.reason;
        if (params.description) body.description = params.description;

        const res = await zohoPost("/inventoryadjustments", body);
        const adj = res.data.inventory_adjustment;
        return {
          content: [
            {
              type: "text",
              text: `✅ Inventory adjusted: ${params.line_items.length} item(s) | Reason: ${params.reason || "—"} | Adjustment ID: ${adj.inventory_adjustment_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // List Inventory Adjustments
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_adjustments",
    "List inventory adjustments with optional date filters.",
    {
      page: z.number().optional(),
    },
    async ({ page }) => {
      try {
        const res = await zohoGet("/inventoryadjustments", { page: page ?? 1 });
        const adjustments = res.data.inventory_adjustments ?? [];
        if (adjustments.length === 0) {
          return { content: [{ type: "text", text: "No inventory adjustments found." }] };
        }
        const summary = adjustments
          .map(
            (a: any) =>
              `• **${a.adjustment_number || a.inventory_adjustment_id}** | ${a.date} | Reason: ${a.reason || "—"} | Status: ${a.status || "—"}`
          )
          .join("\n");
        return {
          content: [
            { type: "text", text: `${adjustments.length} adjustment(s):\n\n${summary}` },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
