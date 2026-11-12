/**
 * auth.ts
 * Multi-source authentication middleware extracting JWT and scoped API tokens.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { JwtService } from '../auth/jwt.ts';
import { ApiTokenService, hasScope } from '../auth/api-tokens.ts';
import { SessionRevocationService } from '../auth/session-revocation.ts';
import type { UserRole } from '@cpanel-clean-room/shared';
import type { UserEntity } from '../auth/rbac.ts';

export interface AuthMiddlewareOptions {
  db: DatabaseConnection;
  jwtSecret?: string;
  allowAnonymousPaths?: string[];
}

export function createAuthMiddleware(options: AuthMiddlewareOptions): RequestHandler {
  const jwt = new JwtService(options.jwtSecret);
  const apiTokens = new ApiTokenService(options.db);
  const revocations = new SessionRevocationService(options.db);
  const anonymousPaths = new Set(options.allowAnonymousPaths || [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/domains/ddns/update',
  ]);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Check if path is anonymous
    if (anonymousPaths.has(req.path)) {
      next();
      return;
    }

    const token = extractToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No bearer token or session cookie provided',
          status: 401,
          requestId: req.id,
        },
      });
      return;
    }

    try {
      let callerUser: UserEntity;
      let apiScopes: string[] | undefined;

      // 1. API Bearer Token
      if (token.startsWith('cpr_tok_')) {
        const apiToken = apiTokens.validateToken(token);
        if (!apiToken) {
          res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired API token',
              status: 401,
              requestId: req.id,
            },
          });
          return;
        }
        callerUser = lookupUserById(options.db, apiToken.userId);
        apiScopes = apiToken.scopes;
      } else {
        // 2. JWT Access Token
        let payload;
        try {
          payload = jwt.verifyAccessToken(token);
        } catch (err: any) {
          res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: err.message || 'Invalid or expired JWT token',
              status: 401,
              requestId: req.id,
            },
          });
          return;
        }

        if (revocations.isRevoked(payload.jti)) {
          res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Token has been revoked',
              status: 401,
              requestId: req.id,
            },
          });
          return;
        }

        callerUser = lookupUserById(options.db, payload.sub);
      }

      if (callerUser.status === 'suspended') {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'User account is suspended',
            status: 403,
            requestId: req.id,
          },
        });
        return;
      }

      // Populate base security context
      req.user = callerUser;
      req.effectiveUser = callerUser;
      req.isImpersonating = false;
      req.apiTokenScopes = apiScopes;

      next();
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: err.message || 'Authentication failed',
          status: 401,
          requestId: req.id,
        },
      });
    }
  };
}

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Role check enforces effectiveUser role when impersonating to prevent privilege escalation!
    const activeRole = req.isImpersonating ? req.effectiveUser.role : req.user.role;
    if (!allowedRoles.includes(activeRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role '${activeRole}' is not authorized to access this resource`,
          status: 403,
          requestId: req.id,
        },
      });
      return;
    }
    next();
  };
}

export function requireScope(...requiredScopes: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiTokenScopes) {
      next(); // Standard JWT session has full role access
      return;
    }

    const granted = req.apiTokenScopes;
    const isAllowed = requiredScopes.length === 0 || requiredScopes.some((s) => hasScope(granted, s));
    if (isAllowed) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: `Missing required API scope '${requiredScopes.join('\' or \'')}'`,
        status: 403,
        requestId: req.id,
      },
    });
  };
}

function extractToken(req: Request): string | null {
  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Cookie
  if (req.cookies?.panel_token) {
    return req.cookies.panel_token;
  }
  if (req.cookies?.session_token) {
    return req.cookies.session_token;
  }

  // Parse Cookie header manually if req.cookies not populated
  const rawCookie = req.headers.cookie;
  if (rawCookie) {
    const match = rawCookie.match(/(?:panel_token|session_token)=([^;]+)/);
    if (match) {
      return match[1].trim();
    }
  }

  // 3. Query param ?token=<token>
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

function lookupUserById(db: DatabaseConnection, id: string): UserEntity {
  const row = db.prepare<any>(
    `SELECT id, username, email, role, reseller_id, status, quota_bytes, uid, gid, home_dir FROM users WHERE id = ?`
  ).get(id);

  if (!row) {
    throw new Error('UNAUTHORIZED: User record does not exist');
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role as UserRole,
    resellerId: row.reseller_id,
    status: row.status,
    quotaBytes: row.quota_bytes,
    uid: row.uid || 1001,
    gid: row.gid || 1001,
    homeDir: row.home_dir || `/home/${row.username}`,
  };
}
