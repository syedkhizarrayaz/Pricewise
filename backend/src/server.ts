import './loadEnv';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { groceryPriceRouter } from './routes/groceryPrice';
import { healthRouter } from './routes/health';
import { analyticsRouter } from './routes/analytics';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/grocery', groceryPriceRouter);
app.use('/api/analytics', analyticsRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Pricewise Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      groceryPrice: '/api/grocery/search'
    }
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🛒 Grocery search: http://localhost:${PORT}/api/grocery/search`);
  console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics`);
});

export default app;

