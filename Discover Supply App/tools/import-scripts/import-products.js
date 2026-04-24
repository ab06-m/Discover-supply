const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', 'zoho-inventory-mcp', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'Products_20260120_20260420.csv');
const RESULTS_FILE = path.join(__dirname, 'product-import-results.json');
const DELAY_MS = 600; // ~100 calls per minute (Zoho limit)

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

function cleanNumber(str) {
  if (!str) return 0;
  // Remove commas used as thousands separators in some locales
  const clean = String(str).replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

async function run() {
  console.log("Loading products CSV...");
  const fileContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Found ${records.length} records. Cleaning and deduplicating...`);

  // Map to hold unique items by Name
  // We prioritize items with higher stock if duplicates are found
  const uniqueItems = new Map();

  for (const row of records) {
    const rawName = (row['Name'] || '').trim();
    if (!rawName) continue;

    const rawCode = (row['Code'] || '').trim();
    const upc = (rawCode && rawCode.toLowerCase() !== 'null') ? rawCode : '';

    const category = (row['Category'] || '').trim();
    const cost = cleanNumber(row['Cost']);
    const price = cleanNumber(row['Price']);
    const stock = Math.max(0, cleanNumber(row['Current Stock'])); // Avoid negative starting stock

    const item = {
      name: rawName,
      rate: price,
      purchase_rate: cost,
      unit: "unit",
      ... category && { group_name: category }, // Zoho creates item groups if they don't exist
      ... stock > 0 && { initial_stock: stock, initial_stock_rate: cost }
    };

    if (upc) {
      if (upc.length > 12) {
        item.sku = upc;
      } else {
        item.upc = upc;
      }
    }

    if (uniqueItems.has(rawName)) {
      const existing = uniqueItems.get(rawName);
      if (item.initial_stock && !existing.initial_stock) {
        // Replace with the one that has stock
        uniqueItems.set(rawName, item);
      } else if (item.initial_stock && existing.initial_stock && item.initial_stock > existing.initial_stock) {
         uniqueItems.set(rawName, item);
      }
    } else {
      uniqueItems.set(rawName, item);
    }
  }

  const itemsToImport = Array.from(uniqueItems.values());
  console.log(`Cleaned list: ${itemsToImport.length} unique items ready for import.`);

  // Set to false for the full import
  const TEST_MODE = false;
  const targetItems = TEST_MODE ? itemsToImport.slice(0, 5) : itemsToImport;
  
  if (TEST_MODE) {
    console.log("TEST MODE: Only running 5 items.");
  }

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    console.log(`[${i+1}/${targetItems.length}] Importing: ${item.name}`);

    try {
      const token = await refreshAccessToken();
      
      const payload = {
        name: item.name,
        rate: item.rate,
        purchase_rate: item.purchase_rate,
        item_type: "inventory", // Track inventory
        unit: item.unit
      };

      if (item.upc) payload.upc = item.upc;
      if (item.sku) payload.sku = item.sku;
      // We aren't doing group_name initially because it requires group object structure in API, 
      // but Zoho API allows flat category? Actually Zoho API usually requires product to be assigned to 
      // an item_group if you want groups. However, simple items don't strictly need a group.
      // Let's omit category for now to avoid complexity, or we can see if it fails.
      
      if (item.initial_stock) {
        payload.initial_stock = item.initial_stock;
        payload.initial_stock_rate = item.initial_stock_rate;
      }

      const res = await axios.post(`${CONFIG.apiBase}/items?organization_id=${CONFIG.orgId}`, payload, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.data && res.data.code === 0) {
        console.log(`  -> Success! ID: ${res.data.item.item_id}`);
        results.success.push({ name: item.name, id: res.data.item.item_id });
      } else {
        throw new Error(res.data.message || 'Unknown error');
      }

    } catch (err) {
      if (err.response && err.response.data && err.response.data.code === 1001) {
         console.log(`  -> Skipped (Already exists)`);
         results.success.push({ name: item.name, status: "already_exists" });
      } else {
         const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
         console.error(`  -> Failed: ${errMsg}`);
         results.failed.push({ name: item.name, error: errMsg, payload: item });
      }
    }

    // Delay for rate limiting
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nImport complete! Success: ${results.success.length}, Failed: ${results.failed.length}`);
  console.log(`Results saved to ${RESULTS_FILE}`);
}

run().catch(console.error);
