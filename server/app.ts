import express from 'express';
import cors from 'cors';
import { gameRouter } from './routes/game.js';

/**
 * Express app setup (separated from server startup for testing)
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/game', gameRouter);

  // Error handling middleware
  app.use((err: Error, _req: express.Request, res: express.Response) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

