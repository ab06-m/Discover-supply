#!/usr/bin/env node

/**
 * Zoho Inventory MCP — OAuth Setup Script
 *
 * Run with: npm run setup
 *
 * This script helps you obtain a refresh token from Zoho by exchanging
 * an authorization code (grant token) that you generate from the Zoho
 * API Console Self Client.
 *
 * Steps:
 * 1. Go to https://accounts.zoho.com/developerconsole
 * 2. Click "Add Client" → "Self Client"
 * 3. Generate a grant token with scope: ZohoInventory.FullAccess.all
 * 4. Run this script and paste the Client ID, Client Secret, and Grant Token
 * 5. It exchanges for a refresh token and writes to .env
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

// Datacenter domains
const DC_ACCOUNTS: Record<string, string> = {
  us: "accounts.zoho.com",
  eu: "accounts.zoho.eu",
  in: "accounts.zoho.in",
  au: "accounts.zoho.com.au",
  jp: "accounts.zoho.jp",
  ca: "accounts.zoho.ca",
  sa: "accounts.zoho.sa",
};

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.error("\n🔧 Zoho Inventory MCP — OAuth Setup\n");
  console.error("This will help you obtain a refresh token for the Zoho API.\n");
  console.error("Prerequisites:");
  console.error("  1. Go to https://accounts.zoho.com/developerconsole");
  console.error("  2. Click 'Add Client' → 'Self Client'");
  console.error("  3. Generate a grant token with scope: ZohoInventory.FullAccess.all");
  console.error("  4. Duration: 10 minutes is fine\n");

  const dc = (await ask("Datacenter (us/eu/in/au/jp/ca/sa) [us]: ")) || "us";
  const clientId = await ask("Client ID: ");
  const clientSecret = await ask("Client Secret: ");
  const grantToken = await ask("Grant Token (authorization code): ");
  const orgId = (await ask("Organization ID [921541531]: ")) || "921541531";

  if (!clientId || !clientSecret || !grantToken) {
    console.error("❌ Client ID, Client Secret, and Grant Token are required.");
    process.exit(1);
  }

  const accountsDomain = DC_ACCOUNTS[dc] || DC_ACCOUNTS.us;
  const tokenUrl = `https://${accountsDomain}/oauth/v2/token`;

  console.error(`\n⏳ Exchanging grant token for refresh token via ${tokenUrl}...`);

  const params = new URLSearchParams({
    code: grantToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
  });

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };

    if (data.error || !data.refresh_token) {
      console.error(`❌ Token exchange failed: ${data.error || "No refresh token in response"}`);
      console.error("Full response:", JSON.stringify(data, null, 2));
      console.error("\nCommon issues:");
      console.error("  • Grant token expired (only valid for ~10 minutes)");
      console.error("  • Wrong datacenter selected");
      console.error("  • Scope not matching");
      process.exit(1);
    }

    // Write .env file
    const envContent = [
      "# Zoho Inventory MCP — Environment Configuration",
      `# Generated on ${new Date().toISOString()}`,
      "",
      `ZOHO_CLIENT_ID=${clientId}`,
      `ZOHO_CLIENT_SECRET=${clientSecret}`,
      `ZOHO_REFRESH_TOKEN=${data.refresh_token}`,
      `ZOHO_ORG_ID=${orgId}`,
      `ZOHO_DATACENTER=${dc}`,
      "",
    ].join("\n");

    fs.writeFileSync(envPath, envContent);

    console.error("\n✅ Success! Credentials saved to .env");
    console.error(`   Refresh Token: ${data.refresh_token.slice(0, 20)}...`);
    console.error(`   Access Token: ${data.access_token?.slice(0, 20)}... (will auto-refresh)`);
    console.error("\n📦 Next steps:");
    console.error("   1. Run: npm run build");
    console.error("   2. Add to your MCP config (see README)");
    console.error("   3. Restart Antigravity");
  } catch (err: any) {
    console.error(`❌ Network error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
