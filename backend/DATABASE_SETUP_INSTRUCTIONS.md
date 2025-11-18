# Database Setup Instructions

## Quick Setup Guide

### 1. Create DigitalOcean Managed Database

1. Go to DigitalOcean Dashboard → Databases
2. Click "Create Database Cluster"
3. Choose:
   - **Engine**: MySQL
   - **Version**: 8.0 or latest
   - **Plan**: Basic ($15/month) for development
   - **Region**: Same as your backend server
   - **Database Name**: `pricewise`
4. Click "Create Database Cluster"
5. Wait for database to be created (~5 minutes)

### 2. Configure Database Access

1. Go to your database dashboard
2. Click "Users & Databases" tab
3. Create a new database user:
   - Username: `pricewise_user` (or your choice)
   - Password: Generate strong password (save it!)
4. Add trusted sources:
   - Add your backend server IP address
   - Or allow connection from anywhere (for development only)

### 3. Get Connection Details

1. Go to "Connection Details" tab
2. Copy:
   - **Host**: `your-db-host.db.ondigitalocean.com`
   - **Port**: Usually `25060` (for managed databases)
   - **Username**: Your database user
   - **Password**: Your database password
   - **Database**: `pricewise`

### 4. Update Backend Environment Variables

Create/update `backend/.env`:

```env
DB_HOST=your-db-host.db.ondigitalocean.com
DB_PORT=25060
DB_USER=pricewise_user
DB_PASSWORD=your-strong-password
DB_NAME=pricewise
DB_SSL=true
```

### 5. Install Dependencies

```bash
cd backend
npm install
```

### 6. Run Database Schema

#### Option A: Using MySQL Client (Recommended)

```bash
# Install MySQL client if not already installed
# On macOS: brew install mysql-client
# On Ubuntu: sudo apt-get install mysql-client

cd backend
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database/schema.sql
```

#### Option B: Using DigitalOcean Console

1. Go to database dashboard
2. Click "SQL Editor" or "Query"
3. Copy contents of `backend/database/schema.sql`
4. Paste and execute

#### Option C: Using Database GUI Tool

Use MySQL Workbench, DBeaver, or TablePlus:
1. Connect to your database using connection details
2. Open `backend/database/schema.sql`
3. Execute the SQL script

### 7. Test Database Connection

```bash
cd backend
npm run dev
```

Check logs for:
```
✅ [Database] Connection pool created
✅ [Database] Connection test successful
```

### 8. Verify Tables Created

Run this query in your database:

```sql
SHOW TABLES;
```

You should see:
- `user_locations`
- `user_queries`
- `query_stores`
- `query_results`
- `query_cache`

## Testing the Setup

### Test API Endpoint

```bash
curl -X POST http://localhost:3001/api/grocery/search \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["mazola corn oil"],
    "address": "Plano, TX 75023, USA",
    "zipCode": "75023",
    "latitude": 33.0198,
    "longitude": -96.6989,
    "nearbyStores": ["Kroger", "Walmart"]
  }'
```

### Check Database

```sql
-- Check if location was saved
SELECT * FROM user_locations ORDER BY created_at DESC LIMIT 5;

-- Check if query was saved
SELECT * FROM user_queries ORDER BY created_at DESC LIMIT 5;

-- Check if cache was saved
SELECT query_hash, expires_at FROM query_cache ORDER BY created_at DESC LIMIT 5;
```

## Scheduled Cache Cleanup

### Option 1: Cron Job (Linux/macOS)

Add to crontab:

```bash
# Clean expired cache every hour
0 * * * * cd /path/to/backend && node dist/utils/cacheCleanup.js
```

### Option 2: Node-Cron Package

Install `node-cron`:

```bash
npm install node-cron
```

Add to `backend/src/server.ts`:

```typescript
import cron from 'node-cron';
import { cleanupExpiredCache } from './utils/cacheCleanup';

// Run cleanup every hour
cron.schedule('0 * * * *', () => {
  cleanupExpiredCache();
});
```

## Troubleshooting

### Connection Refused

- Check firewall rules
- Verify IP whitelist in DigitalOcean
- Check SSL settings (should be `true` for managed databases)

### Authentication Failed

- Verify username and password
- Check if user has correct permissions
- Try resetting password

### Table Already Exists

- Drop tables and recreate:
  ```sql
  DROP TABLE IF EXISTS query_cache;
  DROP TABLE IF EXISTS query_results;
  DROP TABLE IF EXISTS query_stores;
  DROP TABLE IF EXISTS user_queries;
  DROP TABLE IF EXISTS user_locations;
  ```
- Then run schema.sql again

### SSL Connection Error

- For managed databases, SSL is required
- Set `DB_SSL=true` in `.env`
- For local development, you might need SSL certificates

## Production Considerations

1. **Backup**: Enable automatic backups in DigitalOcean
2. **Monitoring**: Set up database monitoring and alerts
3. **Connection Pooling**: Already configured in `databaseService.ts`
4. **Indexes**: All tables have appropriate indexes for performance
5. **Cleanup**: Set up automated cache cleanup (cron job)

## Analytics Queries

### Get Daily Statistics

```sql
SELECT * FROM query_statistics 
WHERE query_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY query_date DESC;
```

### Get Most Searched Items

```sql
SELECT 
  JSON_EXTRACT(items, '$[*]') as item,
  COUNT(*) as search_count
FROM user_queries
GROUP BY items
ORDER BY search_count DESC
LIMIT 10;
```

### Get Location Distribution

```sql
SELECT 
  state,
  COUNT(*) as query_count,
  COUNT(DISTINCT location_id) as unique_locations
FROM user_queries q
JOIN user_locations l ON q.location_id = l.id
GROUP BY state
ORDER BY query_count DESC;
```

