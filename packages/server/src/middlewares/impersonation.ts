/**
 * impersonation.ts
 * 1-Click User Impersonation middleware (ADR-03) with strict RBAC boundary checks
 * and automatic audit trail recording for mutating actions.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { RbacPolicyEngine, type UserEntity } from '../auth/rbac.ts';
import type { UserRole } from '@cpanel-clean-room/shared';

export interface ImpersonationMiddlewareOptions {
  db: DatabaseConnection;
}

export function createImpersonationMiddleware(options: ImpersonationMiddlewareOptions): RequestHandler {
  const rbac = new RbacPolicyEngine();
  const db = options.db;

  return (req: Request, res: Response, next: NextFunction): void => {
    // If not authenticated, skip impersonation handling
    if (!req.user) {
      next();
      return;
    }

    const impersonateHeader = req.headers['x-impersonate-user'] as string | undefined;

    // No impersonation requested or self-impersonation
    if (!impersonateHeader || impersonateHeader === req.user.username) {
      req.effectiveUser = req.user;
      req.isImpersonating = false;
      next();
      return;
    }

    // Customer cannot impersonate anyone
    if (req.user.role === 'customer') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_IMPERSONATION',
          message: 'Customers are strictly forbidden from impersonating users',
          status: 403,
          requestId: req.id,
        },
      });
      return;
    }

    // Lookup target user
    const targetRow = db.prepare<any>(
      `SELECT id, username, email, role, reseller_id, status, quota_bytes, uid, gid, home_dir FROM users WHERE username = ?`
    ).get(impersonateHeader);

    if (!targetRow) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Impersonation target user '${impersonateHeader}' not found`,
          status: 404,
          requestId: req.id,
        },
      });
      return;
    }

    const targetUser: UserEntity = {
      id: targetRow.id,
      username: targetRow.username,
      email: targetRow.email,
      role: targetRow.role as UserRole,
      resellerId: targetRow.reseller_id,
      status: targetRow.status,
      quotaBytes: targetRow.quota_bytes,
      uid: targetRow.uid || 1001,
      gid: targetRow.gid || 1001,
      homeDir: targetRow.home_dir || `/home/${targetRow.username}`,
    };

    const check = rbac.canImpersonate(req.user, targetUser);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_IMPERSONATION',
          message: check.reason || 'Unauthorized impersonation request',
          status: 403,
          requestId: req.id,
        },
      });
      return;
    }

    // Impersonation accepted
    req.effectiveUser = targetUser;
    req.isImpersonating = true;
    req.impersonator = req.user;

    // Mutating actions are logged to audit_logs
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (isMutating) {
      res.on('finish', () => {
        try {
          const auditId = crypto.randomUUID();
          const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
          const ua = (req.headers['user-agent'] as string) || '';
          const status = res.statusCode < 400 ? 'success' : 'failure';
          const action = `${req.method} ${req.baseUrl || ''}${req.path}`;
          const resource = req.path;
          const details = JSON.stringify({
            impersonator: req.user.username,
            effectiveUser: targetUser.username,
            statusCode: res.statusCode,
          });

          db.prepare(
            `INSERT INTO audit_logs (id, user_id, impersonator_id, action, resource, ip, user_agent, status, details, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).run(auditId, targetUser.id, req.user.id, action, resource, ip, ua, status, details);
        } catch {
          // Audit log write failure must not break request
        }
      });
    }

    next();
  };
}
