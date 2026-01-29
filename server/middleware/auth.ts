import { Request, Response, NextFunction } from 'express';

// Extended Request type with user info
export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Mock authentication middleware for local development
 * In production, this will be replaced with Clerk authentication
 *
 * For now, it creates a test user with ID 'test-user-1'
 * E2E tests can override this by passing x-test-user-id header
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // TODO: Replace with real Clerk authentication when deploying
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // const clerkUser = await verifyToken(token);

    // Allow E2E tests to override user ID via header
    const testUserId = req.headers['x-test-user-id'] as string | undefined;
    const mockUserId = testUserId || 'test-user-1';

    req.userId = mockUserId;
    req.user = {
      id: mockUserId,
      email: testUserId ? 'e2e-test@example.com' : 'test@example.com',
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};
