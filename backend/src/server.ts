import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { groceryPriceRouter } from './routes/groceryPrice';
import { healthRouter } from './routes/health';
import { analyticsRouter } from './routes/analytics';
import { databaseService } from './services/databaseService';

// Load environment variables from root .env file
// Try root .env first, then fallback to backend/.env if it exists
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  console.log('✅ Loaded .env from project root');
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
  console.log('✅ Loaded .env from backend directory');
} else {
  dotenv.config(); // Try default locations
  console.log('⚠️ No .env file found, using system environment variables');
}

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

// Test database connection on startup (only if enabled)
if (databaseService.isEnabled()) {
  databaseService.testConnection().then((connected) => {
    if (connected) {
      console.log('✅ [Database] Connection pool initialized');
    } else {
      console.warn('⚠️ [Database] Connection failed - check your .env configuration');
    }
  });
} else {
  console.log('ℹ️ [Database] Database functionality is disabled (set ENABLE_DATABASE=true to enable)');
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🛒 Grocery search: http://localhost:${PORT}/api/grocery/search`);
  console.log(`📊 Analytics: http://localhost:${PORT}/api/analytics`);
});

export default app;

