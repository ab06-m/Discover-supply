const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID } = process.env;

async function getAccessToken() {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
            refresh_token: ZOHO_REFRESH_TOKEN,
            client_id: ZOHO_CLIENT_ID,
            client_secret: ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token'
        }
    });
    return response.data.access_token;
}

async function countItems() {
    try {
        const token = await getAccessToken();
        let page = 1;
        let totalItems = 0;
        let hasMore = true;
        let inventoryItems = 0;
        let salesItems = 0;
        
        while (hasMore) {
            const response = await axios.get('https://www.zohoapis.com/inventory/v1/items', {
                params: { page, organization_id: ZOHO_ORG_ID },
                headers: { Authorization: `Zoho-oauthtoken ${token}` }
            });
            const items = response.data.items;
            totalItems += items.length;
            
            items.forEach(item => {
                if (item.item_type === 'inventory') inventoryItems++;
                else salesItems++;
            });
            
            hasMore = response.data.page_context?.has_more_page;
            page++;
        }
        console.log(`Total Items: ${totalItems}`);
        console.log(`Inventory Items: ${inventoryItems}`);
        console.log(`Sales/Non-Inventory Items: ${salesItems}`);
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
    }
}
countItems();
