/**
 * Analytics Routes
 * Provides endpoints for querying statistics and analytics
 */

import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cacheService';

export const analyticsRouter = Router();

/**
 * Get query analytics
 * GET /api/analytics?startDate=2024-01-01&endDate=2024-12-31
 */
analyticsRouter.get('/', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Relational analytics disabled. Using cache-only mode.',
      cache: cacheService.status(),
      analytics: [],
      period: {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      },
    });
  } catch (error: any) {
    console.error('❌ [Analytics] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get recent query statistics
 * GET /api/analytics/queries?limit=100
 */
analyticsRouter.get('/queries', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Query statistics require relational persistence and are currently disabled.',
      statistics: [],
      count: 0
    });
  } catch (error: any) {
    console.error('❌ [Analytics] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clean expired cache
 * POST /api/analytics/clean-cache
 */
analyticsRouter.post('/clean-cache', async (req: Request, res: Response) => {
  try {
    const deleted = await cacheService.cleanExpiredMemory();

    res.json({
      success: true,
      deleted,
      cache: cacheService.status(),
      message: `Cleaned ${deleted} expired in-memory cache entries`
    });
  } catch (error: any) {
    console.error('❌ [Analytics] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

