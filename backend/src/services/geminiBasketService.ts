/**
 * Server-side Gemini "draft" basket comparison (Google Maps tool).
 * API key must only exist on the server — never bundle in the web client.
 */
import { GoogleGenAI } from '@google/genai';
import type { ComparisonResult } from '../types/comparison';

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

export function isGeminiBasketConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateGeminiDraftComparison(
  items: string[],
  location: string,
  coords?: { lat: number; lng: number }
): Promise<ComparisonResult[]> {
  const ai = getClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const model = process.env.GEMINI_BASKET_MODEL?.trim() || 'gemini-2.0-flash';

  const prompt = `
    I have a shopping list: ${items.join(', ')}.
    The user is located at: ${location}.
    
    TASK:
    1. MANDATORY: Use the googleMaps tool to search for "grocery stores" or "supermarkets" near the user's provided location (${location}). 
    2. MANDATORY: You MUST find and include prices for ALL of these major retailers if they exist in the area: Walmart, Kroger, HEB, Target, and Costco.
    3. MANDATORY: Also include prices for major online retailers like Amazon Fresh or Instacart.
    4. For each store, provide realistic current prices for all items on the list.
    5. For the product name, include the specific quantity or size on a new line if possible, or format it as "Product Name - Quantity" (e.g., "Large Grade A Eggs - 12 count").
    6. Calculate the total basket price for each store.
    
    IMPORTANT: You MUST use the googleMaps tool to find REAL local stores. For online stores, use current market averages.
    
    Return the results as a JSON array of ComparisonResult objects.
    Format: [{ storeId, storeName, totalPrice, matchedItems, totalItems, currencySymbol, currencyCode, products: [{ id, name, price, storeId, storeName }] }]
    
    IMPORTANT: Return ONLY the JSON array. No preamble or explanation.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        includeServerSideToolInvocations: true,
        ...(coords
          ? {
              retrievalConfig: {
                latLng: { latitude: coords.lat, longitude: coords.lng },
              },
            }
          : {}),
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('No response from Gemini');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as ComparisonResult[];
    } catch {
      console.error('Failed to parse matched JSON from Gemini');
    }
  }

  try {
    return JSON.parse(text) as ComparisonResult[];
  } catch {
    throw new Error('Invalid response format from Gemini basket model');
  }
}
