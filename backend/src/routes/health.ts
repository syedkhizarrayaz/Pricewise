import { Router, Request, Response } from 'express';
import { databaseService } from '../services/databaseService';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Test database connection only if enabled
    let dbStatus = 'disabled';
    if (databaseService.isEnabled()) {
      const dbConnected = await databaseService.testConnection();
      dbStatus = dbConnected ? 'connected' : 'disconnected';
    }
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Pricewise Backend API',
      version: '1.0.0',
      database: dbStatus,
      services: {
        database: dbStatus === 'connected'
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

