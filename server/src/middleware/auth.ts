import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';
import { UnauthorizedError } from './errorHandler';
import { store } from '../config/store';

interface JWTPayload {
  userId: string;
  walletAddress: string;
}

/**
 * Authenticate user via JWT token
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

      // Verify user exists
      const user = store.findUserById(decoded.userId);

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      req.user = {
        id: user.id,
        walletAddress: user.walletAddress,
      };

      next();
    } catch (jwtError) {
      throw new UnauthorizedError('Invalid token');
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

      const user = store.findUserById(decoded.userId);

      if (user) {
        req.user = {
          id: user.id,
          walletAddress: user.walletAddress,
        };
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string, walletAddress: string): string {
  return jwt.sign(
    { userId, walletAddress },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_EXPIRES_IN } as any
  );
}
