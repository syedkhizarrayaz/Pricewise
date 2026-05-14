import axios from 'axios';
import { US_STATE_ABBR_TO_NAME } from '../utils/usStateNames';

export interface HasDataSearchParams {
  product: string;
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface HasDataResult {
  position: number;
  title: string;
  productId: string;
  productLink: string;
  price: string;
  extractedPrice: number;
  source: string;
  reviews?: number;
  rating?: number;
  delivery?: string;
  extensions?: string[];
  thumbnail?: string;
}

export interface HasDataResponse {
  requestMetadata: {
    id: string;
    status: string;
    html: string;
    url: string;
  };
  shoppingResults: HasDataResult[];
  pagination?: {
    next: string;
  };
}

export class HasDataService {
  private readonly BASE_URL = 'https://api.hasdata.com/scrape/google/shopping';
  private warnedMissingKey = false;

  private getApiKey(): string {
    const key = (process.env.HASDATA_API_KEY || '').trim();
    if (!key && !this.warnedMissingKey) {
      this.warnedMissingKey = true;
      console.warn(
        '⚠️ [HasData] HASDATA_API_KEY not found in environment variables. Set it in repo root .env and restart the backend.'
      );
    }
    return key;
  }

  async searchProduct(params: HasDataSearchParams): Promise<{ results: HasDataResult[], requestMetadata: any }> {
    try {
      console.log('🔍 [HasData] Searching for:', params.product, 'near', params.address, params.zipCode);
      
      /** Geographic location for HasData `location` param: City,State,United States */
      const location = this.formatGeographicLocationParameter(params.address, params.zipCode);

      /** Shopping query near-clause: e.g. "6501 … Pkwy, Plano TX 75023" (no duplicate zip). */
      const nearSuffix = this.formatShoppingQueryNearSuffix(params.address, params.zipCode);
      const queryPrimary = `${params.product} near ${nearSuffix}`;

      console.log('📍 [HasData] Geographic location (API `location`):', location);
      console.log('📍 [HasData] Near suffix for shopping query `q`:', nearSuffix);
      console.log('🔍 [HasData] Primary request:', JSON.stringify({
        deviceType: 'desktop',
        location: location,
        q: queryPrimary
      }));
      
      const options1 = {
        method: 'GET',
        url: this.BASE_URL,
        params: {
          q: queryPrimary,
          location: location,
          deviceType: 'desktop'
        },
        headers: {
          'x-api-key': this.getApiKey(),
          'Content-Type': 'application/json'
        }
      };

      let allResults: any[] = [];
      let requestMetadata: any = null;
      
      try {
        const { data: data1 } = await axios.request(options1);
        console.log('✅ [HasData] First API response received:', data1.shoppingResults?.length || 0, 'results');
        
        if (data1.shoppingResults && data1.shoppingResults.length > 0) {
          allResults = [...data1.shoppingResults];
          requestMetadata = data1.requestMetadata;
        }
      } catch (error: any) {
        console.error('❌ [HasData] First API call error:', error.message);
      }

      console.log('✅ [HasData] Combined results:', allResults.length, 'total unique results');

      if (allResults.length === 0) {
        console.log('⚠️ [HasData] No results found from either call');
        return { results: [], requestMetadata: requestMetadata };
      }

      return { 
        results: allResults, 
        requestMetadata: requestMetadata 
      };

    } catch (error: any) {
      console.error('❌ [HasData] API error:', error.message);
      return { results: [], requestMetadata: null };
    }
  }

  /**
   * HasData `location` (geographic): City,State,United States — full state name, spelled-out country.
   */
  private formatGeographicLocationParameter(address: string, zipParam: string): string {
    try {
      const parsed = this.parseUsAddressTail(address, zipParam);
      if (!parsed) return 'Plano,Texas,United States';

      const fullState = US_STATE_ABBR_TO_NAME[parsed.stateCode];
      if (!fullState) return `${parsed.city},${parsed.stateCode},United States`;

      const city = parsed.city.replace(/\s+/g, ' ').trim();
      return `${city},${fullState},United States`;
    } catch {
      return 'Plano,Texas,United States';
    }
  }

  /**
   * Shopping `q` near-clause: full street + city + ST + zip once, e.g.
   * "6501 Independence Pkwy, Plano TX 75023" (not "… TX 75023 75023").
   */
  private formatShoppingQueryNearSuffix(address: string, zipParam: string): string {
    const parsed = this.parseUsAddressTail(address, zipParam);
    const zipFinal = (parsed?.zip || zipParam || '').trim();
    if (parsed && zipFinal) {
      return `${parsed.streetPart}, ${parsed.city} ${parsed.stateCode} ${zipFinal}`
        .replace(/\s+/g, ' ')
        .trim();
    }

    let s = address.trim().replace(/\s+/g, ' ').replace(/\n\r?/g, ', ');
    s = s.replace(/,?\s*(USA|United States)\s*$/i, '').trim();
    s = this.dedupeTrailingZip(s);
    const z = (zipParam || '').trim();
    if (z && !/\b\d{5}(-\d{4})?\b/.test(s)) {
      s = `${s} ${z}`.trim();
    }
    return this.dedupeTrailingZip(s);
  }

  private dedupeTrailingZip(s: string): string {
    return s.replace(/(\b\d{5}(?:-\d{4})?)(?:\s+\1)+\s*$/i, '$1').trim();
  }

  /** Parse "...Street, City, ST [zip]" US tail; zip from address or param. */
  private parseUsAddressTail(
    address: string,
    zipParam: string
  ): { streetPart: string; city: string; stateCode: string; zip: string } | null {
    let s = address.trim().replace(/\s+/g, ' ').replace(/\n\r?/g, ', ');
    s = s.replace(/,?\s*(USA|United States)\s*$/i, '').trim();

    let zip = (zipParam || '').trim();
    const zipAtEnd = s.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    if (zipAtEnd) {
      zip = zip || zipAtEnd[1]!;
      s = s.slice(0, s.length - zipAtEnd[0].length).replace(/,\s*$/, '').trim();
    } else if (zip) {
      // keep zip from param only
    }

    const m = s.match(/^(.+),\s*([^,]+),\s*([A-Z]{2})\s*$/);
    if (!m) return null;

    const streetPart = m[1]!.trim();
    const city = m[2]!.trim();
    const stateCode = m[3]!;
    if (!zip) {
      const inner = address.match(/\b(\d{5}(?:-\d{4})?)\b/g);
      if (inner?.length) zip = inner[inner.length - 1]!;
    }
    if (!/^[A-Z]{2}$/.test(stateCode)) return null;
    return { streetPart, city, stateCode, zip: zip || '' };
  }

  filterStoresByLists(results: HasDataResult[], majorStores: string[], nearbyStores: string[]): HasDataResult[] {
    const allTargetStores = [...majorStores, ...nearbyStores];
    const selectedStores: HasDataResult[] = [];
    const usedStores = new Set<string>();

    for (const result of results) {
      const storeName = result.source;
      const matchingStore = allTargetStores.find(targetStore => 
        storeName.toLowerCase().includes(targetStore.toLowerCase()) ||
        targetStore.toLowerCase().includes(storeName.toLowerCase())
      );
      
      if (matchingStore && !usedStores.has(storeName)) {
        selectedStores.push(result);
        usedStores.add(storeName);
      }
    }

    return selectedStores;
  }
}

export const hasDataService = new HasDataService();

