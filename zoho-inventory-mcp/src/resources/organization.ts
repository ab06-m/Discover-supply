import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { zohoGet } from "../zoho-client.js";

export function registerResources(server: McpServer) {
  // -----------------------------------------------------------------------
  // Organization info
  // -----------------------------------------------------------------------
  server.resource(
    "organization",
    "zoho://organization",
    {
      description:
        "Current Zoho Inventory organization info — name, plan, currency, fiscal year.",
      mimeType: "text/plain",
    },
    async (uri) => {
      try {
        const res = await zohoGet("/organizations");
        const orgs = res.data.organizations ?? [];
        if (orgs.length === 0) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "text/plain",
                text: "No organizations found.",
              },
            ],
          };
        }
        const org = orgs[0];
        const info = [
          `Organization: ${org.name}`,
          `Plan: ${org.plan_name || "—"}`,
          `Currency: ${org.currency_code} (${org.currency_symbol})`,
          `Fiscal Year Start: ${org.fiscal_year_start_month || "—"}`,
          `Country: ${org.country || "—"}`,
          `Org ID: ${org.organization_id}`,
        ].join("\n");
        return {
          contents: [
            { uri: uri.href, mimeType: "text/plain", text: info },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error fetching organization: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Low stock summary
  // -----------------------------------------------------------------------
  server.resource(
    "stock-summary",
    "zoho://stock-summary",
    {
      description:
        "Quick overview of items that are low on stock (below reorder level).",
      mimeType: "text/plain",
    },
    async (uri) => {
      try {
        const res = await zohoGet("/items", {
          filter_by: "Status.Lowstock",
          per_page: 50,
        });
        const items = res.data.items ?? [];
        if (items.length === 0) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "text/plain",
                text: "✅ No items are below their reorder level!",
              },
            ],
          };
        }
        const header = `⚠️ ${items.length} item(s) below reorder level:\n\n`;
        const rows = items
          .map(
            (item: any) =>
              `• ${item.name} (${item.sku || "—"}) — Stock: ${item.stock_on_hand} / Reorder at: ${item.reorder_level}`
          )
          .join("\n");
        return {
          contents: [
            { uri: uri.href, mimeType: "text/plain", text: `${header}${rows}` },
          ],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error fetching stock summary: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
