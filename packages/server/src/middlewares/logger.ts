/**
 * logger.ts
 * Request correlation ID and structured logger middleware.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function createRequestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const existingId = req.headers['x-request-id'] as string | undefined;
    const requestId = existingId || crypto.randomUUID();

    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const user = req.user ? req.user.username : 'anonymous';
      const effUser = req.effectiveUser ? req.effectiveUser.username : user;
      const impersonated = req.isImpersonating ? ` (as ${effUser})` : '';

      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms [${user}${impersonated}] req_id=${requestId}`
        );
      }
    });

    next();
  };
}
