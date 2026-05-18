/**
 * Simplified grocery flow: OpenAI normalizes list → HasData one item at a time →
 * OpenAI picks one product per store (batched 5 stores) → totals + sort by category.
 */
import type { ComparisonResult, Product } from '../types/comparison';
import type { HasDataResult } from './hasDataService';
import { hasDataService } from './hasDataService';
import { isMajorRetailerStoreName } from '../constants/majorRetailers';
import {
  estimateLocalOnlineStoresBatchWithGemini,
  estimateMajorRetailersBatchWithGemini,
  isGeminiPriceEstimateConfigured,
  type GeminiPriceFillGap,
} from './geminiSingleItemPriceService';

const BATCH_SIZE = 5;

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim();
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
}

/** When multiple list items: full-basket stores first (matchedItems === totalItems), then price ascending within each tier. */
function compareStoresByBasketCompletenessThenPrice(
  a: ComparisonResult,
  b: ComparisonResult,
  totalItems: number
): number {
  if (totalItems > 1) {
    const aFull = a.matchedItems === totalItems ? 0 : 1;
    const bFull = b.matchedItems === totalItems ? 0 : 1;
    if (aFull !== bFull) return aFull - bFull;
  }
  return a.totalPrice - b.totalPrice;
}

function truncateForLog(s: string, max: number): string {
  const t = String(s ?? '');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function lineItemFromProductName(name: string): string {
  const sep = name.indexOf(' — ');
  return sep >= 0 ? name.slice(0, sep).trim() : name.trim();
}

function countDistinctMatchedListLines(products: Product[], listItems: string[]): number {
  const allowed = new Set(listItems);
  const covered = new Set<string>();
  for (const p of products) {
    const line = lineItemFromProductName(p.name);
    if (allowed.has(line)) covered.add(line);
  }
  return covered.size;
}

/** At most 2 Gemini calls: one batch for major retailers, one for local & online. */
async function fillMissingPricesWithGemini(
  stores: ComparisonResult[],
  listItems: string[],
  address: string
): Promise<void> {
  if (!isGeminiPriceEstimateConfigured()) {
    console.log('[SimplifiedPipeline] Gemini price fill skipped (GEMINI_API_KEY not set)');
    return;
  }

  const majorGaps: GeminiPriceFillGap[] = [];
  const localOnlineGaps: GeminiPriceFillGap[] = [];

  for (const store of stores) {
    const isMajor = isMajorRetailerStoreName(store.storeName);
    for (let li = 0; li < listItems.length; li++) {
      const listItem = listItems[li]!;
      const hasLine = store.products.some((p) => lineItemFromProductName(p.name) === listItem);
      if (hasLine) continue;

      const gap: GeminiPriceFillGap = {
        id: `${store.storeId}-gem-${li}`,
        storeId: store.storeId,
        storeName: store.storeName,
        listItem,
        listItemIndex: li,
      };
      if (isMajor) majorGaps.push(gap);
      else localOnlineGaps.push(gap);
    }
  }

  console.log(
    `[SimplifiedPipeline] Gemini price fill — up to 2 calls: major batch cells=${majorGaps.length}, local/online batch cells=${localOnlineGaps.length}`
  );

  const byStoreId = new Map(stores.map((s) => [s.storeId, s] as const));

  const applyBatch = (gaps: GeminiPriceFillGap[], batchMap: Map<string, { priceUsd: number; productDescription: string }>) => {
    for (const gap of gaps) {
      const est = batchMap.get(gap.id);
      if (!est) continue;
      const store = byStoreId.get(gap.storeId);
      if (!store) continue;
      store.products.push({
        id: `${store.storeId}-gem-${gap.listItemIndex}`,
        name: `${gap.listItem} — ${est.productDescription}`,
        price: est.priceUsd,
        storeId: store.storeId,
        storeName: store.storeName,
        priceSource: 'gemini_estimate',
      });
    }
  };

  try {
    if (majorGaps.length > 0) {
      const majorMap = await estimateMajorRetailersBatchWithGemini({
        address,
        normalizedShoppingList: listItems,
        gaps: majorGaps,
      });
      applyBatch(majorGaps, majorMap);
    }
  } catch (e) {
    console.error('⚠️ [SimplifiedPipeline] Gemini major retailers batch failed:', e);
  }

  try {
    if (localOnlineGaps.length > 0) {
      const localMap = await estimateLocalOnlineStoresBatchWithGemini({
        address,
        normalizedShoppingList: listItems,
        gaps: localOnlineGaps,
      });
      applyBatch(localOnlineGaps, localMap);
    }
  } catch (e) {
    console.error('⚠️ [SimplifiedPipeline] Gemini local/online batch failed:', e);
  }

  for (const store of stores) {
    store.products.sort((a, b) => {
      const la = lineItemFromProductName(a.name);
      const lb = lineItemFromProductName(b.name);
      const ia = listItems.indexOf(la);
      const ib = listItems.indexOf(lb);
      const sa = ia === -1 ? 999 : ia;
      const sb = ib === -1 ? 999 : ib;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
    store.totalPrice = store.products.reduce((sum, p) => sum + p.price, 0);
    store.matchedItems = countDistinctMatchedListLines(store.products, listItems);
  }
}

/** Step 1: turn raw client lines into a clean shopping list. */
export async function parseGroceryItemsWithOpenAI(rawLines: string[]): Promise<string[]> {
  const key = getApiKey();
  if (!key) {
    console.warn('⚠️ [SimplifiedPipeline] OPENAI_API_KEY missing; falling back to trimmed non-empty lines only');
    return rawLines.map((s) => s.trim()).filter(Boolean);
  }

  const joined = rawLines.map((s) => s.trim()).filter(Boolean).join('\n');

  const system = `You normalize grocery shopping lists. Return ONLY valid JSON: {"items": string[]}.
Rules:
- Each element is ONE purchasable grocery item (include size/quantity in the string when the user specified it, e.g. "whole milk 1 gallon").
- Remove duplicates, blank lines, and non-grocery noise.
- Keep the user's intent; do not add items they did not ask for.`;

  const user = `Shopping lines from the user (may be messy):\n${joined}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_GROCERY_PARSE_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI parse failed (${res.status})`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI parse returned empty content');
  const parsed = JSON.parse(content) as { items?: unknown };
  if (!Array.isArray(parsed.items)) throw new Error('OpenAI parse JSON missing items array');
  const items = parsed.items
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
  if (items.length === 0) throw new Error('Parsed grocery list is empty');
  return items;
}

function groupHasDataByStore(results: HasDataResult[]): Map<string, HasDataResult[]> {
  const m = new Map<string, HasDataResult[]>();
  for (const r of results) {
    const name = r.source || 'Unknown';
    if (!m.has(name)) m.set(name, []);
    m.get(name)!.push(r);
  }
  return m;
}

function capCandidates(list: HasDataResult[], max = 18): HasDataResult[] {
  if (list.length <= max) return list;
  return list.slice(0, max);
}

type StoreBatchEntry = { storeName: string; candidates: HasDataResult[] };

/** Step 3: OpenAI picks one candidate index per store (5 stores at a time). */
async function selectOneProductPerStoreBatch(
  listItem: string,
  batch: StoreBatchEntry[],
  batchIndex: number,
  totalBatches: number
): Promise<Map<string, HasDataResult | null>> {
  const out = new Map<string, HasDataResult | null>();
  const key = getApiKey();
  if (!key) {
    console.warn('⚠️ [SimplifiedPipeline] OPENAI_API_KEY missing; using cheapest candidate per store');
    for (const { storeName, candidates } of batch) {
      if (!candidates.length) {
        out.set(storeName, null);
        continue;
      }
      const cheapest = [...candidates].sort((a, b) => (a.extractedPrice ?? 0) - (b.extractedPrice ?? 0))[0];
      out.set(storeName, cheapest);
    }
    return out;
  }

  const payload = batch.map(({ storeName, candidates }) => ({
    storeName,
    candidates: candidates.map((c, idx) => ({
      idx,
      title: c.title,
      price: c.extractedPrice,
      currency: 'USD',
    })),
  }));

  const system = `You choose grocery offers from shopping API results.
Return ONLY JSON: {"selections":[{"storeName":string,"chosenCandidateIndex":number|null}]}
Rules for the user's requested item:
1) If multiple candidates clearly match the SAME requested item, choose the CHEAPEST.
2) If there is no exact match, choose the CLOSEST reasonable substitute for the requested item (size/type/brand), preferring lower price among close options.
3) If nothing is a reasonable match, use chosenCandidateIndex null for that store.
4) chosenCandidateIndex refers to the idx field under that store's candidates array.`;

  const user = JSON.stringify({
    batchIndex: batchIndex + 1,
    totalBatches,
    userRequestedItem: listItem,
    stores: payload,
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_STORE_SELECT_MODEL?.trim() || 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI store batch failed (${res.status})`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI store batch returned empty');

  const parsed = JSON.parse(content) as {
    selections?: Array<{ storeName?: string; chosenCandidateIndex?: number | null }>;
  };
  const selections = parsed.selections;
  if (!Array.isArray(selections)) throw new Error('OpenAI JSON missing selections array');

  const byName = new Map(batch.map((b: StoreBatchEntry) => [b.storeName, b]));

  for (const { storeName } of batch) {
    out.set(storeName, null);
  }

  for (const row of selections) {
    const storeName = String(row.storeName || '');
    const pack = byName.get(storeName);
    if (!pack) continue;
    const idx = row.chosenCandidateIndex;
    if (idx === null || idx === undefined) {
      out.set(storeName, null);
      continue;
    }
    const i = Number(idx);
    if (!Number.isInteger(i) || i < 0 || i >= pack.candidates.length) {
      out.set(storeName, null);
      continue;
    }
    out.set(storeName, pack.candidates[i]!);
  }

  return out;
}

export interface SimplifiedPipelineRequest {
  items: string[];
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface StoreAccumLine {
  listItem: string;
  product: HasDataResult;
}

/** Per-store merged lines across all list items */
export type StoreAccumulator = Map<string, StoreAccumLine[]>;

export async function runSimplifiedGroceryPipeline(req: SimplifiedPipelineRequest): Promise<ComparisonResult[]> {
  const start = Date.now();
  const rawLines = req.items.map((s) => String(s ?? '').trim()).filter(Boolean);
  if (!rawLines.length) throw new Error('No items');

  console.log('\n======== [SimplifiedPipeline] START ========');
  console.log('[SimplifiedPipeline] Step 0 — raw lines from client:', rawLines);

  const listItems = await parseGroceryItemsWithOpenAI(rawLines);
  console.log('[SimplifiedPipeline] Step 1 — normalized item array:', listItems);

  const storeAccum: StoreAccumulator = new Map();

  for (let itemIdx = 0; itemIdx < listItems.length; itemIdx++) {
    const listItem = listItems[itemIdx]!;
    console.log(
      `\n[SimplifiedPipeline] --- Item ${itemIdx + 1}/${listItems.length}: "${listItem}" ---`
    );

    const { results } = await hasDataService.searchProduct({
      product: listItem,
      address: req.address,
      zipCode: req.zipCode,
      latitude: req.latitude,
      longitude: req.longitude,
    });

    console.log(
      `[SimplifiedPipeline] HasData returned ${results.length} rows for "${truncateForLog(listItem, 80)}"`
    );

    const byStore = groupHasDataByStore(results);
    const storeNames = Array.from(byStore.keys()).sort((a, b) => a.localeCompare(b));
    console.log(
      `[SimplifiedPipeline] Unique stores in this result set: ${storeNames.length}`,
      storeNames.slice(0, 30)
    );

    const batches: StoreBatchEntry[][] = [];
    for (let i = 0; i < storeNames.length; i += BATCH_SIZE) {
      const slice = storeNames.slice(i, i + BATCH_SIZE);
      batches.push(
        slice.map((storeName) => ({
          storeName,
          candidates: capCandidates(byStore.get(storeName) || []),
        }))
      );
    }

    if (batches.length === 0) {
      console.log('[SimplifiedPipeline] No stores for this item; skipping selection.');
      continue;
    }

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi]!;
      console.log(
        `[SimplifiedPipeline] Step 2 — OpenAI select batch ${bi + 1}/${batches.length} (stores):`,
        batch.map((b) => b.storeName)
      );

      const picks = await selectOneProductPerStoreBatch(listItem, batch, bi, batches.length);

      for (const [storeName, product] of picks.entries()) {
        if (!product) {
          console.log(`[SimplifiedPipeline]   • ${storeName}: (no pick)`);
          continue;
        }
        if (!storeAccum.has(storeName)) storeAccum.set(storeName, []);
        storeAccum.get(storeName)!.push({ listItem, product });
        console.log(
          `[SimplifiedPipeline]   • ${storeName}: "${truncateForLog(product.title, 70)}" @ $${product.extractedPrice}`
        );
      }
    }
  }

  console.log('\n[SimplifiedPipeline] Step 3 — build ComparisonResult[] from per-store lines');

  const results: ComparisonResult[] = [];
  const totalListItems = listItems.length;

  for (const [storeName, lines] of storeAccum.entries()) {
    const products: Product[] = lines.map((line, idx) => {
      const price = Number(line.product.extractedPrice ?? 0) || 0;
      const title = line.product.title || 'Item';
      return {
        id: `${slug(storeName)}-${idx}`,
        name: `${line.listItem} — ${title}`,
        price,
        storeId: slug(storeName),
        storeName,
        link: line.product.productLink,
        imageUrl: line.product.thumbnail,
        priceSource: 'live',
      };
    });

    const totalPrice = products.reduce((s, p) => s + p.price, 0);

    results.push({
      storeId: slug(storeName),
      storeName,
      totalPrice,
      matchedItems: lines.length,
      totalItems: totalListItems,
      currencySymbol: '$',
      currencyCode: 'USD',
      products,
    });
  }

  const major = results
    .filter((r) => isMajorRetailerStoreName(r.storeName))
    .sort((a, b) => compareStoresByBasketCompletenessThenPrice(a, b, totalListItems));
  const others = results
    .filter((r) => !isMajorRetailerStoreName(r.storeName))
    .sort((a, b) => compareStoresByBasketCompletenessThenPrice(a, b, totalListItems));

  const ordered = [...major, ...others];

  await fillMissingPricesWithGemini(ordered, listItems, req.address);

  const majorResorted = ordered
    .filter((r) => isMajorRetailerStoreName(r.storeName))
    .sort((a, b) => compareStoresByBasketCompletenessThenPrice(a, b, totalListItems));
  const othersResorted = ordered
    .filter((r) => !isMajorRetailerStoreName(r.storeName))
    .sort((a, b) => compareStoresByBasketCompletenessThenPrice(a, b, totalListItems));
  const finalOrdered = [...majorResorted, ...othersResorted];

  console.log(
    '[SimplifiedPipeline] Step 4 — sort: within major/other, full basket first (matchedItems === N), then price ↑; single-item lists unchanged'
  );
  console.log(
    '[SimplifiedPipeline] Major count:',
    majorResorted.length,
    'Other count:',
    othersResorted.length,
    'listItems:',
    totalListItems,
    'elapsedMs:',
    Date.now() - start
  );
  console.log(
    '[SimplifiedPipeline] Totals preview:',
    finalOrdered.map((r) => ({
      store: r.storeName,
      total: r.totalPrice,
      matched: r.matchedItems,
      of: r.totalItems,
      fullBasket: r.matchedItems === r.totalItems,
    }))
  );
  console.log('======== [SimplifiedPipeline] END ========\n');

  return finalOrdered;
}

/** Legacy `/api/grocery/search` shape used by Expo `backendApiService` (nested stores + line items). */
export type LegacySearchStoresShape = {
  [storeName: string]: {
    products: Array<{
      item: string;
      product: Record<string, unknown>;
      score: number;
      confidence_ok: boolean;
      reason: string;
      exact_match: boolean;
    }>;
    totalPrice: number;
  };
};

export function comparisonResultsToLegacySearchStores(results: ComparisonResult[]): LegacySearchStoresShape {
  const stores: LegacySearchStoresShape = {};
  for (const cr of results) {
    stores[cr.storeName] = {
      totalPrice: cr.totalPrice,
      products: cr.products.map((p) => {
        const sep = p.name.indexOf(' — ');
        const listItem = sep >= 0 ? p.name.slice(0, sep).trim() : p.name;
        const title = sep >= 0 ? p.name.slice(sep + 3).trim() : '';
        const isGemini = p.priceSource === 'gemini_estimate';
        return {
          item: listItem,
          product: {
            title: title || listItem,
            extractedPrice: p.price,
            price: String(p.price),
            source: cr.storeName,
            productLink: p.link,
            thumbnail: p.imageUrl,
            priceSource: p.priceSource,
          },
          score: 1,
          confidence_ok: !isGemini,
          reason: isGemini ? 'gemini_estimate' : 'simplified_pipeline',
          exact_match: !isGemini,
        };
      }),
    };
  }
  return stores;
}
