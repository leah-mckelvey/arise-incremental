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
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // TODO: Replace with real Clerk authentication when deploying
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // const clerkUser = await verifyToken(token);
    
    // For local dev, use a mock user
    const mockUserId = 'test-user-1';
    
    req.userId = mockUserId;
    req.user = {
      id: mockUserId,
      email: 'test@example.com',
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Optional auth middleware - doesn't fail if no auth provided
 * Useful for endpoints that work with or without authentication
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Mock authentication for local development
  const mockUserId = 'test-user-1';
  req.userId = mockUserId;
  req.user = {
    id: mockUserId,
    email: 'test@example.com',
  };
  
  next();
};

