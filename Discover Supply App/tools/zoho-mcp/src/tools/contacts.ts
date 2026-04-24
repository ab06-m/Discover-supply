import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoGet, zohoPost } from "../zoho-client.js";

export function registerContactTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // List contacts
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_list_contacts",
    "List all contacts (customers/vendors) in Zoho Inventory.",
    {
      contact_type: z
        .enum(["customer", "vendor"])
        .optional()
        .describe("Filter by contact type"),
      filter_by: z
        .enum(["Status.All", "Status.Active", "Status.Inactive", "Status.Crm"])
        .optional()
        .describe("Filter by status"),
      sort_column: z
        .enum(["contact_name", "company_name", "created_time"])
        .optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
    },
    async ({ contact_type, filter_by, sort_column, page, per_page }) => {
      try {
        const res = await zohoGet("/contacts", {
          contact_type,
          filter_by,
          sort_column,
          page: page ?? 1,
          per_page: per_page ?? 25,
        });
        const contacts = res.data.contacts ?? [];
        if (contacts.length === 0) {
          return { content: [{ type: "text", text: "No contacts found." }] };
        }
        const summary = contacts
          .map(
            (c: any) =>
              `• **${c.contact_name}** (${c.contact_type}) | ${c.email || "No email"} | ${c.phone || "No phone"} | Balance: $${c.outstanding_receivable_amount ?? 0} | ID: ${c.contact_id}`
          )
          .join("\n");
        return { content: [{ type: "text", text: `${contacts.length} contact(s):\n\n${summary}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Get contact details
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_get_contact",
    "Get full details of a contact (customer or vendor) including addresses.",
    {
      contact_id: z.string().describe("The Zoho contact ID"),
    },
    async ({ contact_id }) => {
      try {
        const res = await zohoGet(`/contacts/${contact_id}`);
        const c = res.data.contact;
        const addresses = (c.addresses ?? [])
          .map(
            (a: any) =>
              `  📍 ${a.attention || ""} ${a.address}, ${a.city} ${a.state} ${a.zip}`
          )
          .join("\n");
        const details = [
          `**${c.contact_name}** (${c.contact_type})`,
          `Company: ${c.company_name || "N/A"}`,
          `Email: ${c.email || "N/A"}`,
          `Phone: ${c.phone || "N/A"} | Mobile: ${c.mobile || "N/A"}`,
          `Outstanding: $${c.outstanding_receivable_amount ?? 0}`,
          `Unused Credits: $${c.unused_credits_receivable_amount ?? 0}`,
          `Status: ${c.status}`,
          `Contact ID: ${c.contact_id}`,
          addresses ? `\nAddresses:\n${addresses}` : "",
        ].join("\n");
        return { content: [{ type: "text", text: details }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Search contacts
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_search_contacts",
    "Search contacts by name, email, or phone number.",
    {
      query: z.string().describe("Search text — name, company, email, or phone"),
    },
    async ({ query }) => {
      try {
        const res = await zohoGet("/contacts", { search_text: query });
        const contacts = res.data.contacts ?? [];
        if (contacts.length === 0) {
          return {
            content: [{ type: "text", text: `No contacts found for "${query}"` }],
          };
        }
        const summary = contacts
          .map(
            (c: any) =>
              `• **${c.contact_name}** | ${c.email || "N/A"} | ${c.phone || "N/A"} | ID: ${c.contact_id}`
          )
          .join("\n");
        return {
          content: [
            { type: "text", text: `Found ${contacts.length} contact(s):\n\n${summary}` },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // -----------------------------------------------------------------------
  // Create a contact
  // -----------------------------------------------------------------------
  server.tool(
    "zoho_create_contact",
    "Create a new customer or vendor contact in Zoho Inventory.",
    {
      contact_name: z.string().describe("Full name of the contact"),
      company_name: z.string().optional().describe("Company/business name"),
      contact_type: z.enum(["customer", "vendor"]).describe("Type of contact"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      mobile: z.string().optional().describe("Mobile number"),
      billing_address_street: z.string().optional().describe("Billing street address"),
      billing_address_city: z.string().optional().describe("Billing city"),
      billing_address_state: z.string().optional().describe("Billing state"),
      billing_address_zip: z.string().optional().describe("Billing zip/postal code"),
      shipping_address_street: z.string().optional().describe("Shipping street address"),
      shipping_address_city: z.string().optional().describe("Shipping city"),
      shipping_address_state: z.string().optional().describe("Shipping state"),
      shipping_address_zip: z.string().optional().describe("Shipping zip/postal code"),
      payment_terms: z.number().optional().describe("Payment terms in days (e.g., 0, 15, 30)"),
      notes: z.string().optional().describe("Notes about the contact"),
    },
    async (params) => {
      try {
        const body: Record<string, any> = {
          contact_name: params.contact_name,
          contact_type: params.contact_type,
        };
        if (params.company_name) body.company_name = params.company_name;
        if (params.email) body.email = params.email;
        if (params.phone) body.phone = params.phone;
        if (params.mobile) body.mobile = params.mobile;
        if (params.payment_terms !== undefined) body.payment_terms = params.payment_terms;
        if (params.notes) body.notes = params.notes;

        // Billing address
        if (params.billing_address_street) {
          body.billing_address = {
            address: params.billing_address_street,
            city: params.billing_address_city || "",
            state: params.billing_address_state || "",
            zip: params.billing_address_zip || "",
          };
        }

        // Shipping address
        if (params.shipping_address_street) {
          body.shipping_address = {
            address: params.shipping_address_street,
            city: params.shipping_address_city || "",
            state: params.shipping_address_state || "",
            zip: params.shipping_address_zip || "",
          };
        }

        const res = await zohoPost("/contacts", body);
        const c = res.data.contact;
        return {
          content: [
            {
              type: "text",
              text: `✅ Contact created: **${c.contact_name}** (${c.contact_type}) | ID: ${c.contact_id}`,
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
