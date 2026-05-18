/**
 * Gemini fallback when live pricing (HasData + selection) has no row for a store × list line.
 * Two batch entry points: major retailers (one call) and local/online (one call).
 */
import { GoogleGenAI } from '@google/genai';

export function isGeminiPriceEstimateConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export type GeminiSinglePriceResult = {
  priceUsd: number;
  productDescription: string;
};

/** Stable id for batch response matching (must be unique per missing cell). */
export type GeminiPriceFillGap = {
  id: string;
  storeId: string;
  storeName: string;
  listItem: string;
  listItemIndex: number;
};

/** @deprecated Use GeminiPriceFillGap */
export type LocalOnlinePriceGap = GeminiPriceFillGap;

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function getModel(): string {
  return (
    process.env.GEMINI_PRICE_ESTIMATE_MODEL?.trim() ||
    process.env.GEMINI_BASKET_MODEL?.trim() ||
    'gemini-2.0-flash'
  );
}

async function fetchPriceEstimatesBatchFromGemini(
  prompt: string,
  logTag: string,
  gapCount: number
): Promise<Map<string, GeminiSinglePriceResult>> {
  const out = new Map<string, GeminiSinglePriceResult>();
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return out;

  const ai = new GoogleGenAI({ apiKey: key });
  const model = getModel();

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
  } catch (e) {
    console.error(`⚠️ [GeminiPriceEstimate] ${logTag} batch generateContent failed:`, e);
    return out;
  }

  const text = response.text?.trim();
  if (!text) {
    console.warn(`⚠️ [GeminiPriceEstimate] ${logTag} batch empty response text`);
    return out;
  }

  let parsed: { estimates?: unknown };
  try {
    parsed = JSON.parse(extractJsonObject(text)) as { estimates?: unknown };
  } catch {
    console.warn(`⚠️ [GeminiPriceEstimate] ${logTag} batch JSON parse failed:`, text.slice(0, 280));
    return out;
  }

  const estimates = parsed.estimates;
  if (!Array.isArray(estimates)) {
    console.warn(`⚠️ [GeminiPriceEstimate] ${logTag} batch missing estimates array`);
    return out;
  }

  for (const row of estimates) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { id?: unknown; priceUsd?: unknown; productDescription?: unknown };
    const id = String(r.id ?? '').trim();
    if (!id) continue;
    const rawPrice = r.priceUsd;
    const priceUsd =
      typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;
    if (priceUsd === null) continue;
    const productDescription =
      String(r.productDescription ?? '').trim() || 'Estimated listing (AI)';
    out.set(id, { priceUsd, productDescription });
  }

  console.log(
    `[GeminiPriceEstimate] ${logTag} batch: requested ${gapCount} cells, parsed ${out.size} prices`
  );
  return out;
}

function buildBatchPromptBase(params: {
  address: string;
  normalizedShoppingList: string[];
  gaps: GeminiPriceFillGap[];
}): { gapsJson: string; listLines: string } {
  const gapsJson = JSON.stringify(
    params.gaps.map((g) => ({ id: g.id, storeName: g.storeName, item: g.listItem }))
  );
  const listLines = params.normalizedShoppingList.map((s) => `- ${s}`).join('\n');
  return { gapsJson, listLines };
}

/**
 * One Gemini call for all missing major-retailer cells (Walmart, Kroger, H-E-B, Target, Costco).
 */
export async function estimateMajorRetailersBatchWithGemini(params: {
  address: string;
  normalizedShoppingList: string[];
  gaps: GeminiPriceFillGap[];
}): Promise<Map<string, GeminiSinglePriceResult>> {
  if (params.gaps.length === 0) return new Map();

  const { gapsJson, listLines } = buildBatchPromptBase(params);

  const prompt = `You estimate grocery prices for **major national retailers only**: Walmart, Kroger, H-E-B (HEB), Target, and Costco — at locations near the customer's address.

Customer address (use for ~5 mile local context and typical shelf pricing for that area): ${params.address}

The user's full normalized shopping list (for context only):
${listLines}

Each object below is one **missing** price cell: a major-retailer store name and one list item. In a **single** response, estimate the accurate and cheapest **typical** in-store or pickup price (USD) for that item at that chain near this address.

Input gaps (you must return one estimate per id, same ids):
${gapsJson}

Return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:
{"estimates":[{"id":string,"priceUsd":number|null,"productDescription":string}]}

Rules:
- The "estimates" array must include **every** id from the input exactly once, in the same order as the input gaps array.
- priceUsd: positive number in US dollars, or null only if you cannot estimate at all.
- productDescription: one short line — the product name/size you assumed for the price.`;

  return fetchPriceEstimatesBatchFromGemini(prompt, 'major', params.gaps.length);
}

/**
 * One Gemini call for all missing local / regional / online & delivery grocery cells.
 */
export async function estimateLocalOnlineStoresBatchWithGemini(params: {
  address: string;
  normalizedShoppingList: string[];
  gaps: GeminiPriceFillGap[];
}): Promise<Map<string, GeminiSinglePriceResult>> {
  if (params.gaps.length === 0) return new Map();

  const { gapsJson, listLines } = buildBatchPromptBase(params);

  const prompt = `You estimate grocery prices for **local stores, regional markets, specialty shops, and online / delivery grocery channels** (anything that is NOT one of these national big-box chains priced separately: Walmart, Kroger, H-E-B, Target, Costco).

Customer address (use for ~5 mile local context, regional pricing, and delivery-area pricing where relevant): ${params.address}

The user's full normalized shopping list (for context only):
${listLines}

Each object below is one **missing** price cell: a specific store name and one list item. In a **single** response, estimate the accurate and cheapest **typical** in-context price (USD) for that item at that store (or that store's typical online/delivery shelf price if the store is online-first).

Input gaps (you must return one estimate per id, same ids):
${gapsJson}

Return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:
{"estimates":[{"id":string,"priceUsd":number|null,"productDescription":string}]}

Rules:
- The "estimates" array must include **every** id from the input exactly once, in the same order as the input gaps array.
- priceUsd: positive number in US dollars, or null only if you cannot estimate at all.
- productDescription: one short line — the product name/size you assumed for the price.`;

  return fetchPriceEstimatesBatchFromGemini(prompt, 'local/online', params.gaps.length);
}

/**
 * Optional: one store + one item (single JSON object). Prefer the two batch APIs for pipeline use.
 */
export async function estimateStoreItemPriceWithGemini(params: {
  userItem: string;
  storeName: string;
  address: string;
}): Promise<GeminiSinglePriceResult | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const ai = new GoogleGenAI({ apiKey: key });
  const model = getModel();

  const prompt = `find the accurate and cheapest price for ${params.userItem} for the store ${params.storeName} near 5 miles of this address ${params.address}.

Respond with ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:
{"priceUsd":number|null,"productDescription":string}
Rules:
- priceUsd: typical in-store price in US dollars for that specific store chain/location context, as a number. Use null only if you cannot make a reasonable estimate.
- productDescription: the specific product name and size you used for the price (one short line).`;

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
  } catch (e) {
    console.error('⚠️ [GeminiPriceEstimate] generateContent failed:', e);
    return null;
  }

  const text = response.text?.trim();
  if (!text) {
    console.warn('⚠️ [GeminiPriceEstimate] empty response text');
    return null;
  }

  let parsed: { priceUsd?: unknown; productDescription?: unknown };
  try {
    parsed = JSON.parse(extractJsonObject(text)) as { priceUsd?: unknown; productDescription?: unknown };
  } catch {
    console.warn('⚠️ [GeminiPriceEstimate] JSON parse failed:', text.slice(0, 200));
    return null;
  }

  const rawPrice = parsed.priceUsd;
  const priceUsd =
    typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;
  if (priceUsd === null) {
    console.log(
      `[GeminiPriceEstimate] no price for "${params.userItem}" @ ${params.storeName} (model returned ${String(rawPrice)})`
    );
    return null;
  }

  const productDescription = String(parsed.productDescription ?? '').trim() || 'Estimated listing (AI)';

  return { priceUsd, productDescription };
}
