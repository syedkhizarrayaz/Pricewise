/**
 * Final agent: merges AI draft comparison with live backend pricing signals.
 * Tries Gemini first; falls back to OpenAI JSON merge when Gemini is unavailable or fails.
 */
import { GoogleGenAI } from '@google/genai';
import type { ComparisonResult } from '../types/comparison';
import { reconcileWithOpenAI } from './openaiComparisonService';

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

export type ReconcileMeta = {
  results: ComparisonResult[];
  /** Which model produced the merged array, if any */
  provider: 'gemini' | 'openai' | null;
};

async function tryGeminiReconcile(
  userItems: string[],
  geminiDraft: ComparisonResult[],
  backendComparison: ComparisonResult[]
): Promise<ComparisonResult[] | null> {
  const ai = getClient();
  if (!ai) return null;

  const model = process.env.GEMINI_RECONCILE_MODEL?.trim() || 'gemini-2.0-flash';

  const payload = {
    userShoppingList: userItems,
    geminiDraftEstimate: geminiDraft,
    backendLivePrices: backendComparison,
  };

  const prompt = `You are a grocery pricing analyst. You receive:
1) userShoppingList — exact strings the user wants to buy
2) geminiDraftEstimate — AI-generated store baskets (may be approximate or outdated)
3) backendLivePrices — fresher structured prices from shopping APIs (preferred when they clearly match a list item)

Rules:
- Produce ONE unified JSON array of stores in the same schema as geminiDraftEstimate / backendLivePrices.
- For each user list item, prefer a price from backendLivePrices when title/name clearly matches that item; otherwise use geminiDraftEstimate or best judgment.
- Preserve storeName identity; normalize totals (totalPrice) as sum of chosen product prices for that store.
- If you copy a product from backendLivePrices, preserve that product's id, storeId, and name exactly.
- If you copy a product from geminiDraftEstimate, preserve that product's id, storeId, and name exactly.
- matchedItems = number of user list lines you could map; totalItems = userShoppingList.length.
- Return ONLY a JSON array, no markdown, no explanation.

Schema for each element:
{ "storeId": string, "storeName": string, "totalPrice": number, "matchedItems": number, "totalItems": number, "currencySymbol": string, "currencyCode": string, "products": [{ "id": string, "name": string, "price": number, "storeId": string, "storeName": string }] }

Input data:
${JSON.stringify(payload)}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const text = response.text;
    if (!text) return null;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const raw = jsonMatch ? jsonMatch[0] : text;
    const parsed = JSON.parse(raw) as ComparisonResult[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('⚠️ [Backend] Gemini reconcile failed (will try OpenAI if configured):', msg);
    return null;
  }

  console.warn('⚠️ [Backend] Gemini reconcile returned empty or invalid JSON; trying OpenAI fallback');
  return null;
}

export async function reconcileGeminiAndBackendPricing(
  userItems: string[],
  geminiDraft: ComparisonResult[],
  backendComparison: ComparisonResult[]
): Promise<ComparisonResult[]> {
  const meta = await reconcileGeminiAndBackendPricingWithMeta(
    userItems,
    geminiDraft,
    backendComparison
  );
  return meta.results;
}

/** Same as reconcileGeminiAndBackendPricing but exposes which LLM merged the payload. */
export async function reconcileGeminiAndBackendPricingWithMeta(
  userItems: string[],
  geminiDraft: ComparisonResult[],
  backendComparison: ComparisonResult[]
): Promise<ReconcileMeta> {
  const geminiMerged = await tryGeminiReconcile(userItems, geminiDraft, backendComparison);
  if (geminiMerged) {
    return { results: geminiMerged, provider: 'gemini' };
  }

  const openaiMerged = await reconcileWithOpenAI(userItems, geminiDraft, backendComparison);
  if (openaiMerged) {
    console.log('ℹ️ [Backend] Reconcile completed using OpenAI fallback');
    return { results: openaiMerged, provider: 'openai' };
  }

  const fallback =
    backendComparison.length > 0 ? backendComparison : geminiDraft;
  return { results: fallback, provider: null };
}
