import "server-only";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID ?? "",
  clientSecret: process.env.ZOHO_CLIENT_SECRET ?? "",
  refreshToken: process.env.ZOHO_REFRESH_TOKEN ?? "",
  orgId: process.env.ZOHO_ORG_ID ?? "",
  apiBase: `https://www.zohoapis.com/inventory/v1`,
  tokenUrl: `https://accounts.zoho.com/oauth/v2/token`,
};

// ---------------------------------------------------------------------------
// Token state (in-memory for serverless/dev, should use KV/DB in production)
// ---------------------------------------------------------------------------
let accessToken = "";
let tokenExpiresAt = 0;

// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------
export async function refreshAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken; // still valid (with 60 s buffer)
  }

  const params = new URLSearchParams({
    refresh_token: CONFIG.refreshToken,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    error?: string;
  };

  if (data.error) {
    throw new Error(`Zoho token error: ${data.error}`);
  }

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  console.log(`[zoho] Access token refreshed, expires in ${data.expires_in}s`);
  return accessToken;
}

// ---------------------------------------------------------------------------
// Generic API request helper
// ---------------------------------------------------------------------------
export interface ZohoResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  [key: string]: any;
}

export interface ZohoRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, any>;
}

export async function zohoRequest<T = any>(
  opts: ZohoRequestOptions
): Promise<ZohoResponse<T>> {
  const token = await refreshAccessToken();

  // Build URL with query params
  const url = new URL(`${CONFIG.apiBase}${opts.path}`);
  url.searchParams.set("organization_id", CONFIG.orgId);

  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const fetchOpts: RequestInit = {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (opts.body && (opts.method === "POST" || opts.method === "PUT")) {
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url.toString(), fetchOpts);
  const json = (await res.json()) as any;

  if (!res.ok || json.code !== 0) {
    const errMsg = json.message || `HTTP ${res.status}`;
    throw new Error(`Zoho API error: ${errMsg} (code ${json.code ?? res.status})`);
  }

  return json;
}

// Quick helpers
export async function zohoGet<T = any>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  return zohoRequest<T>({ method: "GET", path, params }) as any;
}

export async function zohoPost<T = any>(
  path: string,
  body?: Record<string, any>,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  return zohoRequest<T>({ method: "POST", path, body, params });
}
