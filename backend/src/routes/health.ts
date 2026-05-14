import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cacheService';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const cache = cacheService.status();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Pricewise Backend API',
      version: '1.0.0',
      services: {
        cache
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Pricewise Backend API',
      error: error.message
    });
  }
});

