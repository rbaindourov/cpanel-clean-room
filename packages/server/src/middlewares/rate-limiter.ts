/**
 * rate-limiter.ts
 * In-memory token bucket rate limiter middleware.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  authMaxRequests?: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000; // 1 minute
  const maxRequests = options.maxRequests ?? 600; // 600 req/min
  const authLimit = options.authMaxRequests ?? (options.maxRequests !== undefined ? options.maxRequests : 15);
  const buckets = new Map<string, Bucket>();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets.entries()) {
      if (now - b.lastRefill > windowMs * 2) {
        buckets.delete(key);
      }
    }
  }, 300_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow unlimited requests
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const isAuthPath = req.path.startsWith('/api/v1/auth/login') || req.path.startsWith('/api/v1/preferences/password');
    const key = `${ip}:${isAuthPath ? 'auth' : 'general'}`;
    const limit = isAuthPath ? authLimit : maxRequests;

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: limit - 1, lastRefill: now };
      buckets.set(key, bucket);
      next();
      return;
    }

    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    if (elapsed > windowMs) {
      bucket.tokens = limit;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      next();
    } else {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and try again later.',
          status: 429,
          requestId: req.id,
        },
      });
    }
  };
}
