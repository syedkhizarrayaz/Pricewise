import type { ComparisonResult } from '../types';

function getBackendBaseUrl(): string {
  const v = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (v && v.trim()) return v.replace(/\/$/, '');
  return 'http://localhost:3001';
}

function extractZipFromAddress(address: string): string {
  const m = address.match(/\b\d{5}(-\d{4})?\b/);
  return m ? m[0] : '';
}

export interface CompareUnifiedParams {
  items: string[];
  location: string;
  zipCode?: string;
  coords?: { lat: number; lng: number };
}

/**
 * Node pipeline: HasData (per list item) + OpenAI list normalization + OpenAI per-store product pick (see backend simplified pipeline).
 * No API keys in the browser bundle.
 */
export async function compareUnifiedPrices(params: CompareUnifiedParams): Promise<ComparisonResult[]> {
  const { items, location, coords } = params;
  const zipCode = params.zipCode?.trim() || extractZipFromAddress(location);

  const res = await fetch(`${getBackendBaseUrl()}/api/grocery/compare-unified`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      address: location,
      zipCode: zipCode || undefined,
      latitude: coords?.lat,
      longitude: coords?.lng,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any).error || `Backend error (${res.status})`);
  }
  if (!json.success || !Array.isArray(json.results)) {
    throw new Error((json as any).error || 'Invalid response from pricing backend');
  }
  return json.results as ComparisonResult[];
}
