export interface NormalizedGroceryBody {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  nearbyStores?: string[];
}

export function normalizeGrocerySearchBody(raw: any): { ok: true; body: NormalizedGroceryBody } | { ok: false; status: number; json: object } {
  const body = raw as Partial<NormalizedGroceryBody>;

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return {
      ok: false,
      status: 400,
      json: { success: false, error: 'Items array is required and cannot be empty' },
    };
  }

  if (!body.address || String(body.address).trim().length === 0) {
    return {
      ok: false,
      status: 400,
      json: { success: false, error: 'Address is required' },
    };
  }

  let zipCode = (body.zipCode || '').trim();
  if (!zipCode && body.address) {
    const zipMatch = String(body.address).match(/\b\d{5}(-\d{4})?\b/);
    if (zipMatch) zipCode = zipMatch[0];
  }

  if (!zipCode) {
    // Do not hard-fail when users search by city/place without explicit postal code.
    // Downstream providers can still use address and/or lat/lng.
    zipCode = '';
  }

  return {
    ok: true,
    body: {
      items: body.items,
      address: String(body.address).trim(),
      zipCode,
      latitude: body.latitude,
      longitude: body.longitude,
      nearbyStores: body.nearbyStores,
    },
  };
}
