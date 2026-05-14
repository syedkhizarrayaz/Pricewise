/**
 * OpenAI fallback for basket draft (web search) and reconcile (structured JSON).
 * Keys only on the server — never expose in the client bundle.
 */
import type { ComparisonResult } from '../types/comparison';

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

export function isOpenAIComparisonConfigured(): boolean {
  return Boolean(getApiKey());
}

function extractResponsesOutputText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return '';
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type === 'message' && item.role === 'assistant') {
      const content = item.content;
      if (!Array.isArray(content)) continue;
      for (const c of content as Array<Record<string, unknown>>) {
        if (c.type === 'output_text' && typeof c.text === 'string') return c.text;
        if (typeof c.text === 'string') return c.text;
      }
    }
  }
  return '';
}

function stripMarkdownFences(s: string): string {
  return s
    .replace(/^\uFEFF?/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * Extract outermost JSON array from first `[` using bracket depth, respecting strings.
 * Fixes: trailing prose after the array, and greedy regex grabbing past the real end.
 */
function extractBalancedJsonArray(input: string): string | null {
  const s = input.trim();
  const start = s.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryParseComparisonFromObject(raw: string): ComparisonResult[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of ['results', 'stores', 'comparison', 'data', 'draft']) {
      const v = obj[key];
      if (Array.isArray(v) && v.length > 0) {
        return v as ComparisonResult[];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseComparisonArray(text: string): ComparisonResult[] {
  const cleaned = stripMarkdownFences(text);

  const balanced = extractBalancedJsonArray(cleaned);
  if (balanced) {
    try {
      const parsed = JSON.parse(balanced) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ComparisonResult[];
      }
    } catch {
      /* fall through */
    }
  }

  const fromObject = tryParseComparisonFromObject(cleaned);
  if (fromObject) return fromObject;

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  const raw = jsonMatch ? jsonMatch[0] : cleaned;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('OpenAI returned empty or non-array comparison JSON');
  }
  return parsed as ComparisonResult[];
}

async function openaiResponsesWithWebSearch(prompt: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const model = process.env.OPENAI_BASKET_RESPONSES_MODEL?.trim() || 'gpt-4o';

  const body = {
    model,
    input: prompt,
    tools: [
      {
        type: 'web_search',
        user_location: { type: 'approximate', country: 'US' },
      },
    ],
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(msg);
  }

  const text = extractResponsesOutputText(data);
  if (!text.trim()) throw new Error('No assistant text in OpenAI Responses output');
  return text;
}

/** Chat Completions models with built-in web search (no Responses API). */
async function openaiChatSearchCompletion(prompt: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const model =
    process.env.OPENAI_BASKET_CHAT_SEARCH_MODEL?.trim() || 'gpt-4o-mini-search-preview';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(msg);
  }

  const text = data.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new Error('No content from OpenAI chat search model');
  return text;
}

function buildBasketDraftPrompt(
  items: string[],
  location: string,
  coords?: { lat: number; lng: number }
): string {
  return `You are a grocery price researcher with web search. Use web search to find current typical retail prices for the user's area when possible.

Shopping list: ${items.join(', ')}.
User location: ${location}.
${coords ? `Approximate coordinates: ${coords.lat}, ${coords.lng}.` : ''}

TASK:
1. Use web search to find grocery stores or supermarkets near the user's location and typical prices for those retailers when possible.
2. Include prices from major chains that serve this area where applicable: Walmart, Kroger, H-E-B, Target, Costco (if relevant), plus major online options (Amazon Fresh / Instacart typical pricing) when web sources support it.
3. For each store, estimate realistic current prices for every list item and compute total basket price.
4. Product name may include size on a new line or as "Product - Size".

Return ONLY a valid JSON array (no markdown fences) of objects with this exact shape:
[{ "storeId": string, "storeName": string, "totalPrice": number, "matchedItems": number, "totalItems": number, "currencySymbol": string, "currencyCode": string, "products": [{ "id": string, "name": string, "price": number, "storeId": string, "storeName": string }] }]

Use storeId as a short slug derived from storeName. matchedItems should reflect how many list items you mapped; totalItems must equal ${items.length}.`;
}

/**
 * Draft comparison using OpenAI web search (Responses API, then chat search model fallback).
 */
export async function generateOpenAIDraftWithWebSearch(
  items: string[],
  location: string,
  coords?: { lat: number; lng: number }
): Promise<ComparisonResult[]> {
  const prompt = buildBasketDraftPrompt(items, location, coords);
  let text: string;
  try {
    text = await openaiResponsesWithWebSearch(prompt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('⚠️ [Backend] OpenAI Responses + web_search failed, trying chat search model:', msg);
    text = await openaiChatSearchCompletion(prompt);
  }
  return parseComparisonArray(text);
}

/**
 * Merge draft + backend live prices using OpenAI (JSON mode). Returns null on failure.
 */
export async function reconcileWithOpenAI(
  userItems: string[],
  draft: ComparisonResult[],
  backend: ComparisonResult[]
): Promise<ComparisonResult[] | null> {
  const key = getApiKey();
  if (!key) return null;

  const model = process.env.OPENAI_RECONCILE_MODEL?.trim() || 'gpt-4o-mini';
  const payload = {
    userShoppingList: userItems,
    geminiDraftEstimate: draft,
    backendLivePrices: backend,
  };

  const system =
    'You merge grocery baskets. Return a single JSON object with one key "results" whose value is a JSON array of stores. Each store: { "storeId", "storeName", "totalPrice", "matchedItems", "totalItems", "currencySymbol", "currencyCode", "products": [{ "id", "name", "price", "storeId", "storeName" }] }. Prefer backendLivePrices when a product clearly matches a line in userShoppingList; otherwise use geminiDraftEstimate. When you choose a product from backendLivePrices, preserve that product\'s `id`, `storeId`, and `name` exactly. When you choose a product from geminiDraftEstimate, preserve that product\'s `id`, `storeId`, and `name` exactly. totalPrice must equal the sum of chosen product prices for that store. matchedItems = number of user list lines mapped; totalItems = userShoppingList length. No markdown, no code fences.';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    console.error('⚠️ [Backend] OpenAI reconcile HTTP error:', data?.error?.message || res.statusText);
    return null;
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { results?: ComparisonResult[] };
    if (!Array.isArray(parsed.results) || parsed.results.length === 0) return null;
    return parsed.results;
  } catch {
    return null;
  }
}
