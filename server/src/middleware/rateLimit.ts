import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../types';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for action endpoints (more lenient for demo)
 */
export const actionLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 50, // 50 actions per second (for rapid-fire demo)
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Action rate limit exceeded',
    },
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});
