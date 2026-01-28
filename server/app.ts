import express from 'express';
import cors from 'cors';
import { gameRouter } from './routes/game.js';
import { queryClient } from './db/cache.js';

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

  // Test-only endpoint to clear query cache (for E2E tests)
  // This should NEVER be exposed in production
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/test/clear-cache', async (req, res) => {
      // Clear all queries from L1 (in-memory) and L2 (shared cache)
      await queryClient.clear();
      res.json({ success: true, message: 'Cache cleared' });
    });
  }

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

