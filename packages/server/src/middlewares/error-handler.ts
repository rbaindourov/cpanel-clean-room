/**
 * error-handler.ts
 * Central RFC 7807-compliant error handler middleware for Express.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AgentdError } from '../agentd-client.ts';

export function createErrorHandler(): ErrorRequestHandler {
  return (err: any, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = req.id || (req.headers['x-request-id'] as string) || 'unknown';

    // 1. Agentd RPC Error
    if (err instanceof AgentdError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          status: err.statusCode,
          details: err.details || null,
          requestId,
        },
      });
      return;
    }

    // 2. Zod Validation Error
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Validation failed for request parameters',
          status: 400,
          details: err.issues,
          requestId,
        },
      });
      return;
    }

    // 3. Custom Error Codes from Authentication / RBAC
    const message = err.message || 'An unexpected error occurred';
    let statusCode = err.status || err.statusCode || 500;
    let code = err.code || 'INTERNAL_ERROR';

    if (message.startsWith('UNAUTHORIZED')) {
      statusCode = 401;
      code = 'UNAUTHORIZED';
    } else if (message.startsWith('FORBIDDEN_IMPERSONATION')) {
      statusCode = 403;
      code = 'FORBIDDEN_IMPERSONATION';
    } else if (message.startsWith('FORBIDDEN')) {
      statusCode = 403;
      code = 'FORBIDDEN';
    } else if (message.startsWith('NOT_FOUND')) {
      statusCode = 404;
      code = 'NOT_FOUND';
    } else if (message.startsWith('CONFLICT') || message.startsWith('ALREADY_EXISTS')) {
      statusCode = 409;
      code = 'ALREADY_EXISTS';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: message.replace(/^[A-Z_]+:\s*/, ''),
        status: statusCode,
        details: err.details || null,
        requestId,
      },
    });
  };
}
