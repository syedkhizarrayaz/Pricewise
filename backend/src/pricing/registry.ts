import type { PricingProvider } from './PricingProvider';
import { hasDataPricingProvider } from './providers/hasDataPricingProvider';
import { unwranglePricingProvider } from './providers/unwranglePricingProvider';
import { customExamplePricingProvider } from './providers/customExampleProvider';

/**
 * Register new providers here (single place).
 * Order in this array is only used for fallback when PRICING_PROVIDERS yields none available.
 */
const allRegisteredProviders: PricingProvider[] = [
  hasDataPricingProvider,
  unwranglePricingProvider,
  customExamplePricingProvider,
];

const providerById = new Map(allRegisteredProviders.map((p) => [p.id, p]));

function parseRequestedProviderIds(): string[] {
  const raw = process.env.PRICING_PROVIDERS || 'hasdata';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Providers that will run for each request, in PRICING_PROVIDERS order.
 * Unknown ids are skipped with a warning. If none resolve, falls back to first available
 * from allRegisteredProviders (typically hasdata).
 */
export async function getActivePricingProviders(): Promise<PricingProvider[]> {
  const requested = parseRequestedProviderIds();
  const selected: PricingProvider[] = [];

  for (const id of requested) {
    const p = providerById.get(id);
    if (!p) {
      console.warn(`⚠️ [Pricing] Unknown provider id in PRICING_PROVIDERS: "${id}"`);
      continue;
    }
    if (await Promise.resolve(p.isAvailable())) {
      selected.push(p);
    } else {
      console.log(`ℹ️ [Pricing] Provider "${id}" not available (missing config or disabled), skipped`);
    }
  }

  if (selected.length === 0) {
    for (const p of allRegisteredProviders) {
      if (await Promise.resolve(p.isAvailable())) {
        console.warn(`⚠️ [Pricing] No configured providers were usable; falling back to "${p.id}"`);
        return [p];
      }
    }
  }

  return selected;
}

export interface ProviderDescriptor {
  id: string;
  displayName: string;
  available: boolean;
  requested: boolean;
}

/**
 * For health checks / ops: all known providers + whether env would select them.
 */
export async function describePricingProviders(): Promise<ProviderDescriptor[]> {
  const requested = new Set(parseRequestedProviderIds());

  return Promise.all(
    allRegisteredProviders.map(async (p) => ({
      id: p.id,
      displayName: p.displayName,
      available: await Promise.resolve(p.isAvailable()),
      requested: requested.has(p.id),
    }))
  );
}
