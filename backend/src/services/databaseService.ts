/**
 * Database Service for Permanent Storage
 * 
 * Handles all database operations for:
 * - User locations (GPS/Manual)
 * - User queries
 * - Nearby stores
 * - Query results
 * - Cache with 24-hour TTL
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

interface LocationData {
  address: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  locationSource: 'gps' | 'manual';
}

interface QueryData {
  locationId: number;
  items: string[];
  queryHash: string;
}

interface QueryStatistics {
  queryId: number;
  nearbyStores: string[];
  resultCount: number;
}

interface CacheData {
  queryHash: string;
  cachedResult: any;
  nearbyStores: string[];
  hasdataResults?: any;
  expiresAt: Date;
}

interface QueryResult {
  queryId: number;
  storeName: string;
  totalPrice: number;
  products: any[];
  resultType: 'hasdata' | 'ai' | 'fallback';
  exactMatch: boolean;
}

class DatabaseService {
  private pool: mysql.Pool | null = null;
  private enabled: boolean;

  constructor() {
    // Check if database is enabled via environment variable
    this.enabled = process.env.ENABLE_DATABASE === 'true' || process.env.USE_DATABASE === 'true';
    
    if (!this.enabled) {
      console.log('⚠️ [Database] Database functionality is DISABLED (set ENABLE_DATABASE=true to enable)');
      return;
    }

    // Validate required environment variables
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      console.warn('⚠️ [Database] Database enabled but missing required environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)');
      this.enabled = false;
      return;
    }

    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'true' ? {
          rejectUnauthorized: false
        } : undefined
      });

      console.log('✅ [Database] Connection pool created');
    } catch (error: any) {
      console.error('❌ [Database] Failed to create connection pool:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Check if database is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.pool !== null;
  }

  /**
   * Generate query hash from items and location
   */
  generateQueryHash(items: string[], address: string, zipCode: string): string {
    const normalized = {
      items: items.sort().map(i => i.toLowerCase().trim()),
      address: address.toLowerCase().trim(),
      zipCode: zipCode.trim()
    };
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Save or get existing user location
   */
  async saveLocation(location: LocationData): Promise<number> {
    if (!this.isEnabled()) {
      console.log('⚠️ [Database] saveLocation skipped (database disabled)');
      return 0; // Return dummy ID
    }

    try {
      // Check if location already exists
      if (!this.pool) throw new Error('Database pool is not initialized');
      const [existing] = await this.pool.execute(
        `SELECT id FROM user_locations 
         WHERE address = ? AND zip_code = ?
         AND ((latitude IS NULL AND ? IS NULL) OR latitude = ?)
         AND ((longitude IS NULL AND ? IS NULL) OR longitude = ?)
         LIMIT 1`,
        [
          location.address,
          location.zipCode,
          location.latitude || null,
          location.latitude || null,
          location.longitude || null,
          location.longitude || null
        ]
      );

      const existingRows = existing as mysql.RowDataPacket[];
      if (existingRows.length > 0) {
        console.log(`📍 [Database] Location already exists, ID: ${existingRows[0].id}`);
        return existingRows[0].id;
      }

      // Insert new location
      const [result] = await this.pool.execute(
        `INSERT INTO user_locations 
         (address, zip_code, latitude, longitude, city, state, location_source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          location.address,
          location.zipCode,
          location.latitude || null,
          location.longitude || null,
          location.city || null,
          location.state || null,
          location.locationSource
        ]
      );

      const insertResult = result as mysql.ResultSetHeader;
      console.log(`📍 [Database] Location saved, ID: ${insertResult.insertId}`);
      return insertResult.insertId;
    } catch (error: any) {
      console.error('❌ [Database] Error saving location:', error.message);
      throw error;
    }
  }

  /**
   * Save user query
   */
  async saveQuery(query: QueryData): Promise<number> {
    if (!this.isEnabled()) {
      console.log('⚠️ [Database] saveQuery skipped (database disabled)');
      return 0; // Return dummy ID
    }

    try {
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const [result] = await this.pool.execute(
        `INSERT INTO user_queries (location_id, items, items_text, query_hash)
         VALUES (?, ?, ?, ?)`,
        [
          query.locationId,
          JSON.stringify(query.items),
          query.items.join(', '),
          query.queryHash
        ]
      );

      const insertResult = result as mysql.ResultSetHeader;
      console.log(`📝 [Database] Query saved, ID: ${insertResult.insertId}`);
      return insertResult.insertId;
    } catch (error: any) {
      console.error('❌ [Database] Error saving query:', error.message);
      throw error;
    }
  }

  /**
   * Save nearby stores for a query
   */
  async saveQueryStores(queryId: number, stores: string[]): Promise<void> {
    if (!this.isEnabled()) {
      return; // Silently skip
    }

    try {
      if (stores.length === 0) return;

      // Prepare batch insert
      const values = stores.map(store => [queryId, store]);
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const placeholders = stores.map(() => '(?, ?)').join(', ');

      await this.pool.execute(
        `INSERT INTO query_stores (query_id, store_name)
         VALUES ${placeholders}`,
        values.flat()
      );

      console.log(`🏪 [Database] Saved ${stores.length} stores for query ${queryId}`);
    } catch (error: any) {
      console.error('❌ [Database] Error saving stores:', error.message);
      // Don't throw - stores are optional
    }
  }

  /**
   * Save query results
   */
  async saveQueryResults(queryId: number, results: QueryResult[]): Promise<void> {
    if (!this.isEnabled()) {
      return; // Silently skip
    }

    try {
      if (results.length === 0) return;

      const values = results.map(r => [
        queryId,
        r.storeName,
        r.totalPrice,
        JSON.stringify(r.products),
        r.resultType,
        r.exactMatch
      ]);

      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const placeholders = results.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');

      await this.pool.execute(
        `INSERT INTO query_results 
         (query_id, store_name, total_price, products, result_type, exact_match)
         VALUES ${placeholders}`,
        values.flat()
      );

      console.log(`📊 [Database] Saved ${results.length} results for query ${queryId}`);
    } catch (error: any) {
      console.error('❌ [Database] Error saving results:', error.message);
      // Don't throw - results are optional
    }
  }

  /**
   * Save cache entry
   */
  async saveCache(cache: CacheData): Promise<void> {
    if (!this.isEnabled()) {
      console.log('⚠️ [Database] saveCache skipped (database disabled)');
      return; // Silently skip
    }

    try {
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      await this.pool.execute(
        `INSERT INTO query_cache 
         (query_hash, cached_result, nearby_stores, hasdata_results, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         cached_result = VALUES(cached_result),
         nearby_stores = VALUES(nearby_stores),
         hasdata_results = VALUES(hasdata_results),
         expires_at = VALUES(expires_at)`,
        [
          cache.queryHash,
          JSON.stringify(cache.cachedResult),
          JSON.stringify(cache.nearbyStores),
          cache.hasdataResults ? JSON.stringify(cache.hasdataResults) : null,
          cache.expiresAt
        ]
      );

      console.log(`💾 [Database] Cache saved for hash: ${cache.queryHash.substring(0, 8)}...`);
    } catch (error: any) {
      console.error('❌ [Database] Error saving cache:', error.message);
      throw error;
    }
  }

  /**
   * Get cache entry if valid
   */
  async getCache(queryHash: string): Promise<any | null> {
    if (!this.isEnabled()) {
      return null; // No cache if database is disabled
    }

    try {
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const [rows] = await this.pool.execute(
        `SELECT cached_result, nearby_stores, hasdata_results
         FROM query_cache
         WHERE query_hash = ? AND expires_at > NOW()`,
        [queryHash]
      );

      const results = rows as mysql.RowDataPacket[];
      if (results.length === 0) {
        console.log('📦 [Database] Cache miss or expired');
        return null;
      }

      const cached = results[0];
      console.log(`✅ [Database] Cache hit!`);
      
      return {
        result: JSON.parse(cached.cached_result),
        nearbyStores: JSON.parse(cached.nearby_stores),
        hasDataResults: cached.hasdata_results 
          ? JSON.parse(cached.hasdata_results) 
          : null
      };
    } catch (error: any) {
      console.error('❌ [Database] Error getting cache:', error.message);
      return null;
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    try {
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const [result] = await this.pool.execute(
        `DELETE FROM query_cache WHERE expires_at <= NOW()`
      );

      const deleteResult = result as mysql.ResultSetHeader;
      const deleted = deleteResult.affectedRows;
      
      if (deleted > 0) {
        console.log(`🧹 [Database] Cleaned ${deleted} expired cache entries`);
      }
      
      return deleted;
    } catch (error: any) {
      console.error('❌ [Database] Error cleaning cache:', error.message);
      return 0;
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(startDate?: Date, endDate?: Date): Promise<any[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      let query = `
        SELECT 
          DATE(q.created_at) as query_date,
          l.location_source,
          COUNT(*) as total_queries,
          COUNT(DISTINCT q.location_id) as unique_locations,
          COUNT(DISTINCT q.items) as unique_combinations,
          AVG((SELECT COUNT(*) FROM query_results WHERE query_results.query_id = q.id)) as avg_stores_per_query
        FROM user_queries q
        JOIN user_locations l ON q.location_id = l.id
      `;
      
      const params: any[] = [];
      if (startDate || endDate) {
        query += ' WHERE 1=1';
        if (startDate) {
          query += ' AND q.created_at >= ?';
          params.push(startDate);
        }
        if (endDate) {
          query += ' AND q.created_at <= ?';
          params.push(endDate);
        }
      }
      
      query += ' GROUP BY DATE(q.created_at), l.location_source ORDER BY query_date DESC';
      
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const [rows] = await this.pool.execute(query, params);
      return rows as any[];
    } catch (error: any) {
      console.error('❌ [Database] Error getting analytics:', error.message);
      return [];
    }
  }

  /**
   * Get query statistics
   */
  async getQueryStatistics(limit: number = 100): Promise<any[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      if (!this.pool) {
        throw new Error("Database pool has not been initialized.");
      }
      const [rows] = await this.pool.execute(
        `SELECT 
          q.id,
          q.items,
          q.items_text,
          q.created_at,
          l.address,
          l.zip_code,
          l.location_source,
          COUNT(DISTINCT qs.store_name) as store_count,
          COUNT(DISTINCT qr.id) as result_count
         FROM user_queries q
         JOIN user_locations l ON q.location_id = l.id
         LEFT JOIN query_stores qs ON q.id = qs.query_id
         LEFT JOIN query_results qr ON q.id = qr.query_id
         GROUP BY q.id
         ORDER BY q.created_at DESC
         LIMIT ?`,
        [limit]
      );

      return rows as any[];
    } catch (error: any) {
      console.error('❌ [Database] Error getting query statistics:', error.message);
      return [];
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    if (!this.pool) {
      return false;
    }

    try {
      const [rows] = await this.pool.execute('SELECT 1 as test');
      console.log('✅ [Database] Connection test successful');
      return true;
    } catch (error: any) {
      console.error('❌ [Database] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (!this.isEnabled() || !this.pool) {
      return;
    }

    await this.pool.end();
    console.log('🔌 [Database] Connection pool closed');
  }
}

export const databaseService = new DatabaseService();

