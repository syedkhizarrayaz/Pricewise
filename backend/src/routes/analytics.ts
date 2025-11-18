/**
 * Analytics Routes
 * Provides endpoints for querying statistics and analytics
 */

import { Router, Request, Response } from 'express';
import { databaseService } from '../services/databaseService';

export const analyticsRouter = Router();

/**
 * Get query analytics
 * GET /api/analytics?startDate=2024-01-01&endDate=2024-12-31
 */
analyticsRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!databaseService.isEnabled()) {
      return res.json({
        success: true,
        message: 'Database is disabled. Set ENABLE_DATABASE=true to enable analytics.',
        analytics: [],
        period: {
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string
        }
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const analytics = await databaseService.getAnalytics(startDate, endDate);

    res.json({
      success: true,
      analytics,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }
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
    if (!databaseService.isEnabled()) {
      return res.json({
        success: true,
        message: 'Database is disabled. Set ENABLE_DATABASE=true to enable statistics.',
        statistics: [],
        count: 0
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const statistics = await databaseService.getQueryStatistics(limit);

    res.json({
      success: true,
      statistics,
      count: statistics.length
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
    if (!databaseService.isEnabled()) {
      return res.json({
        success: true,
        message: 'Database is disabled. Set ENABLE_DATABASE=true to enable cache cleanup.',
        deleted: 0
      });
    }

    const deleted = await databaseService.cleanExpiredCache();

    res.json({
      success: true,
      deleted,
      message: `Cleaned ${deleted} expired cache entries`
    });
  } catch (error: any) {
    console.error('❌ [Analytics] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

