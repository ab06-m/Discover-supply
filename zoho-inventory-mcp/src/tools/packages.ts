import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost } from "../zoho-client.js";

export function registerPackageTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Create a Package
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_create_package",
    "Create a package from a Sales Order. This locks the items — the SO can no longer be edited after packaging.",
    {
      salesorder_id: z.string().describe("The sales order ID to create a package for"),
      package_number: z.string().optional().describe("Optional custom package number"),
      date: z.string().optional().describe("Package date (YYYY-MM-DD, defaults to today)"),
      line_items: z
        .array(
          z.object({
            so_line_item_id: z.string().describe("The line_item_id from the sales order"),
            quantity: z.number().describe("Quantity to package"),
          })
        )
        .optional()
        .describe("Specific items to package (defaults to all items in the SO)"),
      notes: z.string().optional().describe("Package notes"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          salesorder_id: params.salesorder_id,
        };
        if (params.package_number) body.package_number = params.package_number;
        if (params.date) body.date = params.date;
        if (params.notes) body.notes = params.notes;

        // If specific line items not given, fetch the SO and package all
        if (params.line_items) {
          body.line_items = params.line_items;
        } else {
          const soRes = await zohoGet(`/salesorders/${params.salesorder_id}`);
          const so = soRes.data.salesorder;
          body.line_items = (so.line_items ?? []).map((li: any) => ({
            so_line_item_id: li.line_item_id,
            quantity: li.quantity,
          }));
        }

        const res = await zohoPost("/packages", body);
        const pkg = res.data.package ?? res.data;
        return {
          content: [
            {
              type: "text",
              text: `✅ Package created: **${pkg.package_number || "Package"}** | SO: ${params.salesorder_id} | Items are now locked. | Package ID: ${pkg.package_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // List Packages
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_packages",
    "List packages, optionally filtered by sales order.",
    {
      salesorder_id: z.string().optional().describe("Filter by sales order ID"),
      page: z.number().optional(),
    },
    async ({ salesorder_id, page }) => {
      try {
        const params: Record<string, any> = { page: page ?? 1 };
        if (salesorder_id) params.salesorder_id = salesorder_id;

        const res = await zohoGet("/packages", params);
        const packages = res.data.packages ?? [];
        if (packages.length === 0) {
          return { content: [{ type: "text", text: "No packages found." }] };
        }
        const summary = packages
          .map(
            (p: any) =>
              `• **${p.package_number}** | SO: ${p.salesorder_number || "—"} | Date: ${p.date} | Status: ${p.status || "Created"} | ID: ${p.package_id}`
          )
          .join("\n");
        return { content: [{ type: "text", text: `${packages.length} package(s):\n\n${summary}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get Package details
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_package",
    "Get details of a specific package including items.",
    {
      package_id: z.string().describe("The Zoho package ID"),
    },
    async ({ package_id }) => {
      try {
        const res = await zohoGet(`/packages/${package_id}`);
        const pkg = res.data.package;
        const items = (pkg.line_items ?? [])
          .map((li: any) => `  • ${li.name} — Qty: ${li.quantity}`)
          .join("\n");
        const details = [
          `**Package: ${pkg.package_number}**`,
          `Sales Order: ${pkg.salesorder_number || "—"}`,
          `Date: ${pkg.date}`,
          `Status: ${pkg.status || "Created"}`,
          `\nItems:\n${items}`,
          `\nPackage ID: ${pkg.package_id}`,
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
