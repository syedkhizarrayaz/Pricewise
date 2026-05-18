import crypto from 'crypto';
import { createClient, type RedisClientType } from 'redis';

type CacheBackend = 'redis' | 'memory';

interface MemoryEntry {
  expiresAt: number;
  value: unknown;
}

class CacheService {
  private redis: RedisClientType | null = null;
  private redisReady = false;
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly backend: CacheBackend;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.backend = 'memory';
      console.log('ℹ️ [Cache] REDIS_URL not set. Using in-memory cache.');
      return;
    }

    this.backend = 'redis';
    this.redis = createClient({ url: redisUrl });
    this.redis.on('error', (e) => {
      this.redisReady = false;
      console.error('⚠️ [Cache] Redis error, falling back to memory:', (e as Error).message);
    });
    this.redis
      .connect()
      .then(() => {
        this.redisReady = true;
        console.log('✅ [Cache] Redis connected');
      })
      .catch((e) => {
        this.redisReady = false;
        console.error('⚠️ [Cache] Redis connect failed, using memory fallback:', (e as Error).message);
      });
  }

  status(): { backend: CacheBackend; redisReady: boolean } {
    return { backend: this.backend, redisReady: this.redisReady };
  }

  getTtlSeconds(): number {
    const sec = parseInt(process.env.PRICE_CACHE_TTL_SECONDS || '', 10);
    if (!Number.isFinite(sec) || sec <= 0) {
      return 24 * 60 * 60; // 24h default
    }
    return sec;
  }

  makeQueryHash(
    namespace:
      | 'search'
      | 'search_simple_v1'
      | 'search_simple_v2'
      | 'compare_unified'
      | 'compare_unified_simple_v1'
      | 'compare_unified_simple_v2',
    items: string[],
    address: string,
    zipCode: string,
    nearbyStores?: string[]
  ): string {
    const normalized = {
      namespace,
      items: [...items].sort().map((i) => i.toLowerCase().trim()),
      address: address.toLowerCase().trim(),
      zipCode: zipCode.trim(),
      nearbyStoresKey: nearbyStores?.length
        ? [...nearbyStores].sort().map((s) => s.toLowerCase().trim()).join('|')
        : '',
      providers: (process.env.PRICING_PROVIDERS || 'hasdata').trim().toLowerCase(),
      cacheVersion: (process.env.PRICING_CACHE_VERSION || '1').trim(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.backend === 'redis' && this.redis && this.redisReady) {
      try {
        const v = await this.redis.get(key);
        if (!v) return null;
        return JSON.parse(v) as T;
      } catch (e) {
        console.error('⚠️ [Cache] Redis get failed, trying memory:', (e as Error).message);
      }
    }

    const now = Date.now();
    const hit = this.memory.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= now) {
      this.memory.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const ttlSec = this.getTtlSeconds();
    if (this.backend === 'redis' && this.redis && this.redisReady) {
      try {
        await this.redis.set(key, JSON.stringify(value), { EX: ttlSec });
        return;
      } catch (e) {
        console.error('⚠️ [Cache] Redis set failed, using memory:', (e as Error).message);
      }
    }

    this.memory.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  }

  async cleanExpiredMemory(): Promise<number> {
    const now = Date.now();
    let deleted = 0;
    for (const [k, v] of this.memory.entries()) {
      if (v.expiresAt <= now) {
        this.memory.delete(k);
        deleted++;
      }
    }
    return deleted;
  }
}

export const cacheService = new CacheService();
