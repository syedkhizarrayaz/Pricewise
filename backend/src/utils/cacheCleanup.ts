/**
 * Cache Cleanup Utility
 * 
 * Runs periodically to clean expired cache entries
 * Can be called from a cron job or scheduled task
 */

import { databaseService } from '../services/databaseService';

export async function cleanupExpiredCache() {
  try {
    console.log('🧹 [CacheCleanup] Starting cache cleanup...');
    const deleted = await databaseService.cleanExpiredCache();
    console.log(`✅ [CacheCleanup] Cleaned ${deleted} expired cache entries`);
    return deleted;
  } catch (error: any) {
    console.error('❌ [CacheCleanup] Error:', error.message);
    return 0;
  }
}

// Run cleanup every hour if running as a scheduled task
if (require.main === module) {
  setInterval(async () => {
    await cleanupExpiredCache();
  }, 60 * 60 * 1000); // Every hour

  // Run immediately
  cleanupExpiredCache();
}

