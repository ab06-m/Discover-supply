import dotenv from 'dotenv';
dotenv.config();

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID } = process.env;

async function getAccessToken() {
    const params = new URLSearchParams();
    params.append('refresh_token', ZOHO_REFRESH_TOKEN);
    params.append('client_id', ZOHO_CLIENT_ID);
    params.append('client_secret', ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token?' + params.toString(), {
        method: 'POST'
    });
    const data = await response.json();
    return data.access_token;
}

async function countItems() {
    try {
        const token = await getAccessToken();
        let page = 1;
        let totalItems = 0;
        let hasMore = true;
        let inStock = 0;
        let outOfStock = 0;
        let totalStock = 0;
        
        while (hasMore) {
            const response = await fetch(`https://www.zohoapis.com/inventory/v1/items?page=${page}&organization_id=${ZOHO_ORG_ID}`, {
                headers: { Authorization: `Zoho-oauthtoken ${token}` }
            });
            const data = await response.json();
            if (data.code !== 0) {
                console.error("Error from API:", data);
                return;
            }
            
            const items = data.items;
            totalItems += items.length;
            
            items.forEach(item => {
                if (item.available_stock > 0) {
                    inStock++;
                } else {
                    outOfStock++;
                }
                totalStock += item.available_stock || 0;
            });
            
            hasMore = data.page_context?.has_more_page;
            page++;
        }
        console.log(`Total Items: ${totalItems}`);
        console.log(`Items In Stock (>0): ${inStock}`);
        console.log(`Items Out Of Stock (<=0): ${outOfStock}`);
        console.log(`Total Stock Quantity: ${totalStock}`);
    } catch (err) {
        console.error(err);
    }
}
countItems();
