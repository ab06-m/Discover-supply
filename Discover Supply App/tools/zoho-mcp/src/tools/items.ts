import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost, zohoPut, zohoPostForm } from "../zoho-client.js";
import fs from "fs";
import path from "path";
export function registerItemTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // Search items by name, SKU, or barcode
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_search_items",
    "Search Zoho Inventory items by name, SKU, or barcode (UPC/EAN). Great for barcode lookups.",
    {
      query: z.string().describe("Search text — item name, SKU, UPC, or EAN barcode"),
      page: z.number().optional().describe("Page number (default 1)"),
    },
    async ({ query, page }) => {
      try {
        const res = await zohoGet("/items", {
          search_text: query,
          page: page ?? 1,
        });
        const items = res.data.items ?? [];
        if (items.length === 0) {
          return {
            content: [{ type: "text", text: `No items found for "${query}"` }],
          };
        }
        const summary = items
          .map(
            (item: any) =>
              `• **${item.name}** (SKU: ${item.sku || "N/A"}) — $${item.rate} | Stock: ${item.stock_on_hand} (Available: ${item.available_stock ?? "N/A"}) | ID: ${item.item_id}`
          )
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text: `Found ${items.length} item(s) for "${query}":\n\n${summary}${res.page_context?.has_more_page ? "\n\n_More results available — use page parameter_" : ""}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get item details by ID
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_item",
    "Get full details of a Zoho Inventory item by its item_id.",
    {
      item_id: z.string().describe("The Zoho item ID"),
    },
    async ({ item_id }) => {
      try {
        const res = await zohoGet(`/items/${item_id}`);
        const item = res.data.item;
        const details = [
          `**${item.name}**`,
          `SKU: ${item.sku || "N/A"}`,
          `UPC: ${item.upc || "N/A"} | EAN: ${item.ean || "N/A"}`,
          `Selling Price: $${item.rate}`,
          `Cost Price: $${item.purchase_rate || "N/A"}`,
          `Stock on Hand: ${item.stock_on_hand}`,
          `Available Stock: ${item.available_stock ?? "N/A"}`,
          `Committed Stock: ${item.committed_stock ?? 0}`,
          `Reorder Level: ${item.reorder_level || "Not set"}`,
          `Group: ${item.group_name || "Ungrouped"}`,
          `Status: ${item.status}`,
          `Item ID: ${item.item_id}`,
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // List items with filters
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_items",
    "List all items in Zoho Inventory. Supports filtering by status and pagination.",
    {
      filter_by: z
        .enum(["Status.All", "Status.Active", "Status.Inactive", "Status.Lowstock"])
        .optional()
        .describe("Filter items by status"),
      sort_column: z
        .enum(["name", "rate", "sku", "created_time"])
        .optional()
        .describe("Column to sort by"),
      sort_order: z.enum(["ascending", "descending"]).optional(),
      page: z.number().optional().describe("Page number (default 1)"),
      per_page: z.number().optional().describe("Items per page (max 200)"),
    },
    async ({ filter_by, sort_column, sort_order, page, per_page }) => {
      try {
        const res = await zohoGet("/items", {
          filter_by,
          sort_column,
          sort_order,
          page: page ?? 1,
          per_page: per_page ?? 25,
        });
        const items = res.data.items ?? [];
        if (items.length === 0) {
          return { content: [{ type: "text", text: "No items found." }] };
        }
        const header = `| Name | SKU | Price | Stock | Available | Status |\n|------|-----|-------|-------|-----------|--------|\n`;
        const rows = items
          .map(
            (item: any) =>
              `| ${item.name} | ${item.sku || "-"} | $${item.rate} | ${item.stock_on_hand} | ${item.available_stock ?? "-"} | ${item.status} |`
          )
          .join("\n");
        const pageInfo = res.page_context
          ? `\n\nPage ${res.page_context.page} | Total: ${res.page_context.total}${res.page_context.has_more_page ? " | More pages available" : ""}`
          : "";
        return { content: [{ type: "text", text: `${header}${rows}${pageInfo}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Create an item
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_create_item",
    "Create a new item in Zoho Inventory.",
    {
      name: z.string().describe("Item name"),
      sku: z.string().optional().describe("SKU code"),
      rate: z.number().describe("Selling price"),
      purchase_rate: z.number().optional().describe("Cost price"),
      unit: z.string().optional().describe("Unit of measurement (e.g., 'case', 'unit', 'kg')"),
      upc: z.string().optional().describe("UPC/EAN barcode number"),
      group_name: z.string().optional().describe("Item group/category name"),
      reorder_level: z.number().optional().describe("Reorder level threshold"),
      initial_stock: z.number().optional().describe("Initial opening stock quantity"),
      initial_stock_rate: z.number().optional().describe("Cost per unit for opening stock"),
      description: z.string().optional().describe("Item description"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          name: params.name,
          rate: params.rate,
          item_type: "inventory",
        };
        if (params.sku) body.sku = params.sku;
        if (params.purchase_rate) body.purchase_rate = params.purchase_rate;
        if (params.unit) body.unit = params.unit;
        if (params.upc) body.upc = params.upc;
        if (params.group_name) body.group_name = params.group_name;
        if (params.reorder_level) body.reorder_level = params.reorder_level;
        if (params.description) body.description = params.description;
        if (params.initial_stock !== undefined) {
          body.initial_stock = params.initial_stock;
          body.initial_stock_rate = params.initial_stock_rate ?? params.purchase_rate ?? params.rate;
        }

        const res = await zohoPost("/items", body);
        const item = res.data.item;
        return {
          content: [
            {
              type: "text",
              text: `✅ Item created: **${item.name}** (ID: ${item.item_id}, SKU: ${item.sku || "N/A"})`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Update an item
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_update_item",
    "Update an existing item in Zoho Inventory.",
    {
      item_id: z.string().describe("The Zoho item ID to update"),
      name: z.string().optional().describe("New item name"),
      rate: z.number().optional().describe("New selling price"),
      purchase_rate: z.number().optional().describe("New cost price"),
      sku: z.string().optional().describe("New SKU"),
      upc: z.string().optional().describe("New UPC/EAN barcode"),
      reorder_level: z.number().optional().describe("New reorder level"),
      description: z.string().optional().describe("New description"),
    },
    async ({ item_id, ...updates }) => {
      try {
        // Filter out undefined values
        const body: Record<string, any> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) body[k] = v;
        }
        const res = await zohoPut(`/items/${item_id}`, body);
        const item = res.data.item;
        return {
          content: [
            {
              type: "text",
              text: `✅ Item updated: **${item.name}** (ID: ${item.item_id})`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Upload item image
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_upload_item_image",
    "Upload an image to an existing Zoho Inventory item.",
    {
      item_id: z.string().describe("The Zoho item ID"),
      image_path: z.string().describe("Absolute local path to the image file to upload"),
    },
    async ({ item_id, image_path }) => {
      try {
        if (!fs.existsSync(image_path)) {
          throw new Error(`File not found: ${image_path}`);
        }

        const stats = fs.statSync(image_path);
        if (!stats.isFile()) {
           throw new Error(`Path is not a regular file: ${image_path}`);
        }

        const fileData = fs.readFileSync(image_path);
        const ext = path.extname(image_path).toLowerCase();
        let mimeType = "application/octet-stream";
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".gif") mimeType = "image/gif";
        else if (ext === ".webp") mimeType = "image/webp";

        const blob = new Blob([fileData], { type: mimeType });
        const formData = new FormData();
        formData.append("image", blob, path.basename(image_path));

        const res = await zohoPostForm(`/items/${item_id}/image`, formData);
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Image uploaded successfully to item **${item_id}**. Message: ${res.message}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
