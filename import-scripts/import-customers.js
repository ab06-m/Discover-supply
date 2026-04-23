const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', 'zoho-inventory-mcp', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'Customers_20260120_20260420.csv');
const RESULTS_FILE = path.join(__dirname, 'customer-import-results.json');
const DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Configuration & Zoho Auth
// ---------------------------------------------------------------------------
const CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  orgId: process.env.ZOHO_ORG_ID,
  apiBase: `https://www.zohoapis.com/inventory/v1`,
  tokenUrl: `https://accounts.zoho.com/oauth/v2/token`,
};

let accessToken = "";
let tokenExpiresAt = 0;

async function refreshAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  const params = new URLSearchParams({
    refresh_token: CONFIG.refreshToken,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await axios.post(CONFIG.tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (res.data.error) {
    throw new Error(`Zoho token error: ${res.data.error}`);
  }

  accessToken = res.data.access_token;
  tokenExpiresAt = Date.now() + res.data.expires_in * 1000;
  console.log(`[Auth] Access token refreshed.`);
  return accessToken;
}

// ---------------------------------------------------------------------------
// Main Importer
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("Loading customers CSV...");
  const fileContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} records. Processing...`);

  // To test
  const TEST_MODE = false;
  const targetCustomers = TEST_MODE ? records.slice(0, 5) : records;

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < targetCustomers.length; i++) {
    const row = targetCustomers[i];
    const rawName = (row['Name'] || '').trim();
    if (!rawName) continue;

    console.log(`[${i+1}/${targetCustomers.length}] Importing: ${rawName}`);

    const item = {
      contact_name: rawName,
      company_name: rawName,
      contact_type: "customer",
      ... (row['Email'] || '').trim() && { email: row['Email'].trim() },
      ... (row['Phone'] || '').trim() && { phone: row['Phone'].trim() },
      ... (row['Work Phone'] || '').trim() && { mobile: row['Work Phone'].trim() },
      ... (row['Notes'] || '').trim() && { notes: row['Notes'].trim() }
    };

    const address = (row['Address'] || '').trim();
    if (address) {
      item.billing_address = { address };
      item.shipping_address = { address };
    }

    try {
      const token = await refreshAccessToken();
      
      const res = await axios.post(`${CONFIG.apiBase}/contacts?organization_id=${CONFIG.orgId}`, item, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.data && res.data.code === 0) {
        console.log(`  -> Success! ID: ${res.data.contact.contact_id}`);
        results.success.push({ name: rawName, id: res.data.contact.contact_id });
      } else {
        throw new Error(res.data.message || 'Unknown error');
      }

    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`  -> Failed: ${errMsg}`);
      results.failed.push({ name: rawName, error: errMsg, payload: item });
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nImport complete! Success: ${results.success.length}, Failed: ${results.failed.length}`);
  console.log(`Results saved to ${RESULTS_FILE}`);
}

run().catch(console.error);
