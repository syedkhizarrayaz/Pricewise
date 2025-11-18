# Environment Variables Setup

## Database Control

The database functionality can be enabled/disabled using the `ENABLE_DATABASE` environment variable.

### For Local Development (Database Disabled)

Create `backend/.env`:

```env
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:8081

# Database Configuration - DISABLED for local development
ENABLE_DATABASE=false

# API Keys
HASDATA_API_KEY=your-hasdata-api-key
UNWRANGLE_API_KEY=your-unwrangle-api-key
OPENAI_API_KEY=your-openai-api-key

# Service URLs
PYTHON_SERVICE_URL=http://localhost:8000
```

**When `ENABLE_DATABASE=false`:**
- ✅ App runs normally without database
- ✅ All API endpoints work as before
- ✅ No database connection attempts
- ✅ No cache functionality
- ✅ No data persistence
- ✅ Perfect for local development and demos

### For Production (Database Enabled)

Create `backend/.env`:

```env
# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:8081

# Database Configuration - ENABLED
ENABLE_DATABASE=true

# Database Connection (Required when ENABLE_DATABASE=true)
DB_HOST=your-db-host.db.ondigitalocean.com
DB_PORT=25060
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=pricewise
DB_SSL=true

# API Keys
HASDATA_API_KEY=your-hasdata-api-key
UNWRANGLE_API_KEY=your-unwrangle-api-key
OPENAI_API_KEY=your-openai-api-key

# Service URLs
PYTHON_SERVICE_URL=http://localhost:8000
```

**When `ENABLE_DATABASE=true`:**
- ✅ Database connection pool created
- ✅ Cache functionality enabled (24-hour TTL)
- ✅ All queries saved permanently
- ✅ Analytics available
- ✅ Requires valid database credentials

## Behavior

### When Database is Disabled (`ENABLE_DATABASE=false`)

- **Startup**: Logs `⚠️ [Database] Database functionality is DISABLED`
- **Health Check**: Returns `"database": "disabled"`
- **API Calls**: Work normally, no database operations
- **Cache**: Not checked, not saved
- **Analytics**: Returns empty arrays with message

### When Database is Enabled (`ENABLE_DATABASE=true`)

- **Startup**: Attempts to create connection pool
- **Health Check**: Tests connection, returns `"connected"` or `"disconnected"`
- **API Calls**: Cache checked first, data saved after
- **Cache**: 24-hour TTL, stored in database
- **Analytics**: Full functionality

## Quick Switch

To switch between modes, just change one line in `.env`:

```env
# Disable database
ENABLE_DATABASE=false

# Enable database
ENABLE_DATABASE=true
```

Then restart the backend server.

## Verification

Check the startup logs:

**Database Disabled:**
```
⚠️ [Database] Database functionality is DISABLED (set ENABLE_DATABASE=true to enable)
ℹ️ [Database] Database functionality is disabled (set ENABLE_DATABASE=true to enable)
```

**Database Enabled:**
```
✅ [Database] Connection pool created
✅ [Database] Connection test successful
✅ [Database] Connection pool initialized
```

Check health endpoint:

```bash
curl http://localhost:3001/api/health
```

Response when disabled:
```json
{
  "status": "healthy",
  "database": "disabled"
}
```

Response when enabled:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

