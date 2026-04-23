#!/usr/bin/env node

/**
 * Zoho Inventory MCP Server — Discovery Supply
 *
 * A Model Context Protocol server that wraps the Zoho Inventory REST API,
 * providing 25+ tools for managing inventory, orders, contacts, packages,
 * shipments, invoices, and payments.
 *
 * Transport: stdio (local process)
 * Auth: OAuth 2.0 with auto-refreshing access tokens
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Tool modules
import { registerItemTools } from "./tools/items.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerSalesOrderTools } from "./tools/sales-orders.js";
import { registerPackageTools } from "./tools/packages.js";
import { registerShipmentTools } from "./tools/shipments.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerPaymentTools } from "./tools/payments.js";
import { registerInventoryTools } from "./tools/inventory.js";

// Resources
import { registerResources } from "./resources/organization.js";

// Ensure .env is loaded (zoho-client.ts does this, but import it to be safe)
import "./zoho-client.js";

// ---------------------------------------------------------------------------
// Create server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "zoho-inventory-mcp",
  version: "1.0.0",
  description:
    "Zoho Inventory MCP Server for Discovery Supply — manage items, orders, contacts, packages, shipments, invoices, and payments via the Zoho Inventory API.",
});

// ---------------------------------------------------------------------------
// Register all tools (28 total)
// ---------------------------------------------------------------------------
registerItemTools(server);        // 5 tools
registerContactTools(server);     // 4 tools
registerSalesOrderTools(server);  // 6 tools
registerPackageTools(server);     // 3 tools
registerShipmentTools(server);    // 3 tools
registerInvoiceTools(server);     // 3 tools
registerPaymentTools(server);     // 2 tools
registerInventoryTools(server);   // 2 tools

// ---------------------------------------------------------------------------
// Register resources
// ---------------------------------------------------------------------------
registerResources(server);

// ---------------------------------------------------------------------------
// Connect via stdio transport
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[zoho-inventory-mcp] Server running on stdio");
  console.error("[zoho-inventory-mcp] 28 tools registered, 2 resources available");
}

main().catch((err) => {
  console.error("[zoho-inventory-mcp] Fatal error:", err);
  process.exit(1);
});
