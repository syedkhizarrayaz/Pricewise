# Database Setup Guide for Permanent Storage

## Recommendation: MySQL/PostgreSQL on DigitalOcean

### Why MySQL/PostgreSQL over Firebase?

**MySQL/PostgreSQL Advantages:**
- ✅ **Cost-effective**: Managed database starts at ~$15/month on DigitalOcean
- ✅ **Better for analytics**: SQL queries are perfect for statistics and reporting
- ✅ **Full control**: You own the data, no vendor lock-in
- ✅ **Scalable**: Can handle millions of queries efficiently
- ✅ **Same infrastructure**: Already hosting backend on DigitalOcean
- ✅ **Relational data**: Perfect for complex queries (user queries, locations, stores, etc.)

**Firebase Disadvantages:**
- ❌ **Expensive**: Can get costly with high read/write volumes
- ❌ **Vendor lock-in**: Harder to migrate later
- ❌ **Limited analytics**: NoSQL makes complex queries harder
- ❌ **Less control**: Dependant on Google's infrastructure

## Database Schema Design

### Option 1: MySQL Schema (Recommended)

```sql
-- Users/Locations table (permanent storage)
CREATE TABLE user_locations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    address VARCHAR(255) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    location_source ENUM('gps', 'manual') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_location (address(100), zip_code),
    INDEX idx_coordinates (latitude, longitude),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Queries table (permanent storage)
CREATE TABLE user_queries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    location_id BIGINT NOT NULL,
    items JSON NOT NULL, -- ["mazola corn oil", "milk"]
    items_text TEXT NOT NULL, -- For searching: "mazola corn oil, milk"
    query_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of items+location
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES user_locations(id) ON DELETE CASCADE,
    INDEX idx_location_id (location_id),
    INDEX idx_query_hash (query_hash),
    INDEX idx_created (created_at),
    FULLTEXT INDEX idx_items_text (items_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nearby stores table (permanent storage)
CREATE TABLE query_stores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_id BIGINT NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    store_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES user_queries(id) ON DELETE CASCADE,
    INDEX idx_query_id (query_id),
    INDEX idx_store_name (store_name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Query results table (permanent storage)
CREATE TABLE query_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_id BIGINT NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    products JSON NOT NULL, -- Store product details
    result_type ENUM('hasdata', 'ai', 'fallback') NOT NULL,
    exact_match BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES user_queries(id) ON DELETE CASCADE,
    INDEX idx_query_id (query_id),
    INDEX idx_store_name (store_name(100)),
    INDEX idx_total_price (total_price),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cache table (24-hour TTL)
CREATE TABLE query_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    cached_result JSON NOT NULL,
    nearby_stores JSON NOT NULL,
    hasdata_results JSON,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_hash (query_hash),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Analytics/Statistics view
CREATE VIEW query_statistics AS
SELECT 
    DATE(created_at) as query_date,
    location_source,
    COUNT(*) as total_queries,
    COUNT(DISTINCT location_id) as unique_locations,
    COUNT(DISTINCT items) as unique_item_combinations,
    AVG((SELECT COUNT(*) FROM query_results WHERE query_results.query_id = user_queries.id)) as avg_stores_per_query
FROM user_queries
JOIN user_locations ON user_queries.location_id = user_locations.id
GROUP BY DATE(created_at), location_source;
```

### Option 2: PostgreSQL Schema (Alternative)

PostgreSQL is also a great choice with better JSON support:

```sql
-- Users/Locations table
CREATE TABLE user_locations (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    location_source VARCHAR(10) CHECK (location_source IN ('gps', 'manual')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location ON user_locations(address, zip_code);
CREATE INDEX idx_coordinates ON user_locations(latitude, longitude);
CREATE INDEX idx_created ON user_locations(created_at);

-- Queries table
CREATE TABLE user_queries (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES user_locations(id) ON DELETE CASCADE,
    items JSONB NOT NULL,
    items_text TEXT NOT NULL,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_id ON user_queries(location_id);
CREATE INDEX idx_query_hash ON user_queries(query_hash);
CREATE INDEX idx_created ON user_queries(created_at);
CREATE INDEX idx_items_text ON user_queries USING GIN(to_tsvector('english', items_text));

-- Similar tables for stores, results, cache...
```

## Implementation Steps

### 1. Setup DigitalOcean Managed Database

1. Go to DigitalOcean Dashboard → Databases
2. Create Database:
   - Choose: **MySQL** or **PostgreSQL**
   - Version: Latest stable (MySQL 8.0+ or PostgreSQL 15+)
   - Plan: **Basic** ($15/month) for development, **Professional** for production
   - Region: Same as your backend server
3. Create Database User
4. Whitelist your backend server IP
5. Note connection details

### 2. Install Database Client for Backend

```bash
cd backend
npm install mysql2  # For MySQL
# OR
npm install pg  # For PostgreSQL
npm install dotenv  # Already installed
```

### 3. Create Database Service

Create `backend/src/services/databaseService.ts`:

```typescript
import mysql from 'mysql2/promise';
// OR for PostgreSQL:
// import { Pool } from 'pg';

class DatabaseService {
  private pool: mysql.Pool;
  // OR for PostgreSQL:
  // private pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // Save user location
  async saveLocation(location: {
    address: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    locationSource: 'gps' | 'manual';
  }): Promise<number> {
    const [result] = await this.pool.execute(
      `INSERT INTO user_locations 
       (address, zip_code, latitude, longitude, city, state, location_source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [location.address, location.zipCode, location.latitude || null, 
       location.longitude || null, location.city || null, 
       location.state || null, location.locationSource]
    );
    return (result as any).insertId;
  }

  // Save query
  async saveQuery(query: {
    locationId: number;
    items: string[];
    queryHash: string;
  }): Promise<number> {
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
    return (result as any).insertId;
  }

  // Save query statistics
  async saveQueryStatistics(stats: {
    queryId: number;
    nearbyStores: string[];
    resultCount: number;
  }): Promise<void> {
    // Save stores
    for (const store of stats.nearbyStores) {
      await this.pool.execute(
        `INSERT INTO query_stores (query_id, store_name)
         VALUES (?, ?)`,
        [stats.queryId, store]
      );
    }
  }

  // Save cache
  async saveCache(cache: {
    queryHash: string;
    cachedResult: any;
    nearbyStores: string[];
    hasdataResults?: any;
    expiresAt: Date;
  }): Promise<void> {
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
  }

  // Get cache
  async getCache(queryHash: string): Promise<any | null> {
    const [rows] = await this.pool.execute(
      `SELECT cached_result, nearby_stores, hasdata_results
       FROM query_cache
       WHERE query_hash = ? AND expires_at > NOW()`,
      [queryHash]
    );
    
    const results = rows as any[];
    if (results.length === 0) return null;
    
    return {
      result: JSON.parse(results[0].cached_result),
      nearbyStores: JSON.parse(results[0].nearby_stores),
      hasDataResults: results[0].hasdata_results 
        ? JSON.parse(results[0].hasdata_results) 
        : null
    };
  }

  // Clean expired cache
  async cleanExpiredCache(): Promise<number> {
    const [result] = await this.pool.execute(
      `DELETE FROM query_cache WHERE expires_at <= NOW()`
    );
    return (result as any).affectedRows;
  }

  // Get analytics
  async getAnalytics(startDate?: Date, endDate?: Date) {
    let query = `
      SELECT 
        DATE(q.created_at) as date,
        l.location_source,
        COUNT(*) as total_queries,
        COUNT(DISTINCT q.location_id) as unique_locations,
        COUNT(DISTINCT q.items) as unique_combinations
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
    
    query += ' GROUP BY DATE(q.created_at), l.location_source ORDER BY date DESC';
    
    const [rows] = await this.pool.execute(query, params);
    return rows;
  }

  // Close connections
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();
```

### 4. Update Backend Route

Update `backend/src/routes/groceryPrice.ts` to use database:

```typescript
import { databaseService } from '../services/databaseService';
import crypto from 'crypto';

// In the POST /search route, after successful search:

// Generate query hash
const queryHash = crypto
  .createHash('sha256')
  .update(JSON.stringify({ items: body.items, address: body.address, zipCode: body.zipCode }))
  .digest('hex');

// Save location
const locationId = await databaseService.saveLocation({
  address: body.address,
  zipCode: body.zipCode,
  latitude: body.latitude,
  longitude: body.longitude,
  locationSource: (body.latitude && body.longitude) ? 'gps' : 'manual'
});

// Save query
const queryId = await databaseService.saveQuery({
  locationId,
  items: body.items,
  queryHash
});

// Save statistics
await databaseService.saveQueryStatistics({
  queryId,
  nearbyStores: Object.keys(stores),
  resultCount: Object.keys(stores).length
});

// Save cache (24-hour TTL)
await databaseService.saveCache({
  queryHash,
  cachedResult: response,
  nearbyStores: Object.keys(stores),
  hasdataResults: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
```

### 5. Environment Variables

Add to `backend/.env`:

```env
DB_HOST=your-db-host.db.ondigitalocean.com
DB_PORT=25060
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=pricewise
DB_SSL=true
```

### 6. Migration from AsyncStorage

Create a migration script to move existing AsyncStorage data to database:

```typescript
// scripts/migrate-to-database.ts
import { cacheService } from '../services/cacheService';
import { databaseService } from '../backend/src/services/databaseService';

async function migrate() {
  const stats = await cacheService.getAllStatistics();
  
  for (const stat of stats) {
    // Save to database
    const locationId = await databaseService.saveLocation({
      address: stat.query.address,
      zipCode: stat.query.zipCode,
      latitude: stat.query.latitude,
      longitude: stat.query.longitude,
      locationSource: stat.locationSource
    });
    
    const queryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(stat.query))
      .digest('hex');
    
    const queryId = await databaseService.saveQuery({
      locationId,
      items: stat.query.items,
      queryHash
    });
    
    await databaseService.saveQueryStatistics({
      queryId,
      nearbyStores: stat.nearbyStores,
      resultCount: stat.resultCount
    });
  }
}
```

## Cost Comparison

### DigitalOcean MySQL
- **Basic**: $15/month (1GB RAM, 1 vCPU, 10GB storage)
- **Professional**: $60/month (2GB RAM, 1 vCPU, 25GB storage)
- **Scales**: Up to enterprise plans

### Firebase Firestore
- **Free tier**: 50K reads/day, 20K writes/day
- **Paid**: $0.06 per 100K reads, $0.18 per 100K writes
- **With 1M queries/month**: ~$60-100/month

## Recommendation

**Use MySQL on DigitalOcean** because:
1. ✅ More cost-effective for your use case
2. ✅ Better for analytics queries
3. ✅ Same infrastructure as backend
4. ✅ Full control over data
5. ✅ Easy to scale

## Next Steps

1. Create DigitalOcean managed database
2. Run schema SQL to create tables
3. Install database client (mysql2 or pg)
4. Create database service
5. Update backend routes to save data
6. Test with sample queries
7. Set up automated cache cleanup (cron job)

