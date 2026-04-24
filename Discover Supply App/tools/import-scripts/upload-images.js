const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '..', 'zoho-inventory-mcp', '.env') });

const CSV_PATH = path.join(__dirname, '..', 'Products_with_Images.csv');
const DELAY_MS = 600; 

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
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken;
  const params = new URLSearchParams({
    refresh_token: CONFIG.refreshToken,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await axios.post(CONFIG.tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  accessToken = res.data.access_token;
  tokenExpiresAt = Date.now() + (res.data.expires_in * 1000);
  return accessToken;
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const itemsWithImages = records.filter(r => r.Image_Path && r.Image_Path.trim().length > 0);
  console.log(`Found ${itemsWithImages.length} items with images to upload.`);

  for (const item of itemsWithImages) {
    const name = item.Name;
    const imagePath = item.Image_Path;
    
    if (!fs.existsSync(imagePath)) {
      console.warn(`File not found for ${name}: ${imagePath}`);
      continue;
    }

    try {
      await refreshAccessToken();
      
      // Search for item by name
      const searchRes = await axios.get(`${CONFIG.apiBase}/items`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        params: {
          organization_id: CONFIG.orgId,
          name_startswith: name.slice(0, 50)
        }
      });
      
      const foundItems = searchRes.data.items || [];
      const exactMatch = foundItems.find(i => i.name === name);
      
      if (!exactMatch) {
         console.warn(`Item not found in Zoho for name: ${name}`);
         continue;
      }
      
      const itemId = exactMatch.item_id;
      console.log(`Found item ID ${itemId} for ${name}. Uploading image...`);
      
      const form = new FormData();
      form.append('image', fs.createReadStream(imagePath));
      
      const uploadRes = await axios.post(`${CONFIG.apiBase}/items/${itemId}/image`, form, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          ...form.getHeaders()
        },
        params: { organization_id: CONFIG.orgId }
      });
      
      if (uploadRes.data.code === 0) {
        console.log(`Successfully uploaded image for ${name}`);
      } else {
         console.error(`Failed to upload for ${name}:`, uploadRes.data.message);
      }
      
    } catch (err) {
       console.error(`Error processing ${name}:`, err.response?.data || err.message);
    }
    await delay(DELAY_MS);
  }
}

main().catch(console.error);
