// Thin wrapper around the Printful v1 REST API. Returns null (rather than
// throwing) when PRINTFUL_API_KEY isn't set, matching the getStripe()
// pattern in lib/stripe.ts -- callers should handle that gracefully so the
// app keeps working before Ben finishes Printful setup.

const PRINTFUL_API_BASE = 'https://api.printful.com';

function getHeaders(): Record<string, string> | null {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  // Only needed if the API key is a general user token spanning multiple
  // Printful stores -- a store-scoped token doesn't need this.
  if (process.env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
  return headers;
}

export interface PrintfulSyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string;
}

export interface PrintfulSyncVariant {
  id: number;
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price: string;
  currency: string;
  is_ignored: boolean;
}

export interface PrintfulSyncProductDetail {
  sync_product: PrintfulSyncProduct;
  sync_variants: PrintfulSyncVariant[];
}

async function printfulFetch(path: string, init?: RequestInit): Promise<any> {
  const headers = getHeaders();
  if (!headers) throw new Error('PRINTFUL_NOT_CONFIGURED');
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message || json?.result || `HTTP ${res.status}`;
    throw new Error(`Printful ${path} failed: ${message}`);
  }
  return json;
}

// Returns null if PRINTFUL_API_KEY isn't set (not configured yet), throws
// on an actual API error so the caller can surface it.
export async function listSyncProducts(): Promise<PrintfulSyncProduct[] | null> {
  if (!getHeaders()) return null;
  const json = await printfulFetch('/store/products');
  return (json.result || []) as PrintfulSyncProduct[];
}

export async function getSyncProduct(id: number): Promise<PrintfulSyncProductDetail | null> {
  if (!getHeaders()) return null;
  const json = await printfulFetch(`/store/products/${id}`);
  return json.result as PrintfulSyncProductDetail;
}

export interface PrintfulOrderRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  email?: string;
}

export interface PrintfulOrderItem {
  sync_variant_id: number;
  quantity: number;
}

export interface PrintfulOrderResult {
  id: number;
  external_id: string;
  status: string;
}

// Submits a real order to Printful for production/fulfillment. Draft by
// default (confirm: false) -- doesn't charge Ben's Printful billing or
// start production, just creates it in his dashboard for manual approval.
// Set AUTO_CONFIRM_PRINTFUL_ORDERS=true in env once Ben's ready to trust
// full auto-fulfillment on paid Stripe orders.
export async function createPrintfulOrder(params: {
  externalId: string;
  recipient: PrintfulOrderRecipient;
  items: PrintfulOrderItem[];
}): Promise<PrintfulOrderResult | null> {
  if (!getHeaders()) return null;
  const confirm = process.env.AUTO_CONFIRM_PRINTFUL_ORDERS === 'true';
  const json = await printfulFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({
      external_id: params.externalId,
      recipient: params.recipient,
      items: params.items,
      confirm,
    }),
  });
  return json.result as PrintfulOrderResult;
}
