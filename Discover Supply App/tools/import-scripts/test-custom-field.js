const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'zoho-inventory-mcp', '.env') });

const CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  orgId: process.env.ZOHO_ORG_ID,
  apiBase: `https://www.zohoapis.com/inventory/v1`,
  tokenUrl: `https://accounts.zoho.com/oauth/v2/token`,
};

async function refreshAccessToken() {
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

  return res.data.access_token;
}

async function run() {
  try {
    const token = await refreshAccessToken();
    console.log(`\nFetching Custom Fields...`);
    const getRes = await axios.get(`${CONFIG.apiBase}/settings/customfields?entity=item&organization_id=${CONFIG.orgId}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
    });
    
    console.log("Items Custom Fields:", JSON.stringify(getRes.data.customfields.item, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

run();
