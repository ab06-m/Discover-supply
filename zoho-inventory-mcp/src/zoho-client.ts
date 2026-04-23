import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from the project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ---------------------------------------------------------------------------
// Datacenter → domain mapping
// ---------------------------------------------------------------------------
const DC_DOMAINS: Record<string, { api: string; accounts: string }> = {
  us: { api: "www.zohoapis.com", accounts: "accounts.zoho.com" },
  eu: { api: "www.zohoapis.eu", accounts: "accounts.zoho.eu" },
  in: { api: "www.zohoapis.in", accounts: "accounts.zoho.in" },
  au: { api: "www.zohoapis.com.au", accounts: "accounts.zoho.com.au" },
  jp: { api: "www.zohoapis.jp", accounts: "accounts.zoho.jp" },
  ca: { api: "www.zohoapis.ca", accounts: "accounts.zoho.ca" },
  sa: { api: "www.zohoapis.sa", accounts: "accounts.zoho.sa" },
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const dc = (process.env.ZOHO_DATACENTER || "us").toLowerCase();
const domains = DC_DOMAINS[dc] ?? DC_DOMAINS.us;

const CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID ?? "",
  clientSecret: process.env.ZOHO_CLIENT_SECRET ?? "",
  refreshToken: process.env.ZOHO_REFRESH_TOKEN ?? "",
  orgId: process.env.ZOHO_ORG_ID ?? "",
  apiBase: `https://${domains.api}/inventory/v1`,
  tokenUrl: `https://${domains.accounts}/oauth/v2/token`,
};

// ---------------------------------------------------------------------------
// Token state
// ---------------------------------------------------------------------------
let accessToken = "";
let tokenExpiresAt = 0;

// ---------------------------------------------------------------------------
// Refresh access token
// ---------------------------------------------------------------------------
async function refreshAccessToken(): Promise<string> {
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
  console.error(`[zoho] Access token refreshed, expires in ${data.expires_in}s`);
  return accessToken;
}

// ---------------------------------------------------------------------------
// Generic API request helper
// ---------------------------------------------------------------------------
export interface ZohoResponse<T = any> {
  code: number;
  message: string;
  data: T;
  page_context?: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
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

  // Normalize response — Zoho puts module data under different keys
  return {
    code: json.code,
    message: json.message,
    data: json,
    page_context: json.page_context,
  };
}

// ---------------------------------------------------------------------------
// Quick helpers for common patterns
// ---------------------------------------------------------------------------
export async function zohoGet<T = any>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  return zohoRequest<T>({ method: "GET", path, params });
}

export async function zohoPost<T = any>(
  path: string,
  body?: Record<string, any>,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  return zohoRequest<T>({ method: "POST", path, body, params });
}

export async function zohoPut<T = any>(
  path: string,
  body?: Record<string, any>,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  return zohoRequest<T>({ method: "PUT", path, body, params });
}

export async function zohoPostForm<T = any>(
  path: string,
  formData: FormData,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  const token = await refreshAccessToken();
  const url = new URL(`${CONFIG.apiBase}${path}`);
  url.searchParams.set("organization_id", CONFIG.orgId);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const fetchOpts: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      // Note: Omit Content-Type so fetch can auto-generate the multipart boundary for FormData
    },
    body: formData,
  };

  const res = await fetch(url.toString(), fetchOpts);
  const json = (await res.json()) as any;

  if (!res.ok || json.code !== 0) {
    const errMsg = json.message || `HTTP ${res.status}`;
    throw new Error(`Zoho API error: ${errMsg} (code ${json.code ?? res.status})`);
  }

  return {
    code: json.code,
    message: json.message,
    data: json,
    page_context: json.page_context,
  };
}

export async function zohoDelete<T = any>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ZohoResponse<T>> {
  return zohoRequest<T>({ method: "DELETE", path, params });
}

// ---------------------------------------------------------------------------
// Status action helper (confirm, void, delivered, etc.)
// ---------------------------------------------------------------------------
export async function zohoStatusAction(
  path: string
): Promise<ZohoResponse> {
  return zohoPost(path);
}

// ---------------------------------------------------------------------------
// Export config for resources
// ---------------------------------------------------------------------------
export function getConfig() {
  return { ...CONFIG };
}
