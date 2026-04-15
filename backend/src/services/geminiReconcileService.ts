/**
 * Final agent: merges Gemini draft comparison with live backend pricing signals.
 */
import { GoogleGenAI } from '@google/genai';
import type { ComparisonResult } from '../types/comparison';

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

export async function reconcileGeminiAndBackendPricing(
  userItems: string[],
  geminiDraft: ComparisonResult[],
  backendComparison: ComparisonResult[]
): Promise<ComparisonResult[]> {
  const ai = getClient();
  if (!ai) {
    return backendComparison.length ? backendComparison : geminiDraft;
  }

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
- matchedItems = number of user list lines you could map; totalItems = userShoppingList.length.
- Return ONLY a JSON array, no markdown, no explanation.

Schema for each element:
{ "storeId": string, "storeName": string, "totalPrice": number, "matchedItems": number, "totalItems": number, "currencySymbol": string, "currencyCode": string, "products": [{ "id": string, "name": string, "price": number, "storeId": string, "storeName": string }] }

Input data:
${JSON.stringify(payload)}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const text = response.text;
  if (!text) return backendComparison.length ? backendComparison : geminiDraft;

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const raw = jsonMatch ? jsonMatch[0] : text;
  try {
    const parsed = JSON.parse(raw) as ComparisonResult[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    console.error('Reconcile model returned non-JSON; falling back to backend-only');
  }

  return backendComparison.length ? backendComparison : geminiDraft;
}
