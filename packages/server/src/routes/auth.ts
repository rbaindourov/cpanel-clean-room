/**
 * routes/auth.ts
 * Authentication endpoints (login, refresh, logout, me).
 */

import { Router, type Request, type Response } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { PasswordService } from '../auth/password.ts';
import { JwtService } from '../auth/jwt.ts';
import { TotpService } from '../auth/totp.ts';
import { SessionRevocationService } from '../auth/session-revocation.ts';
import { createAuthMiddleware } from '../middlewares/auth.ts';
import { createImpersonationMiddleware } from '../middlewares/impersonation.ts';
import type { UserRole } from '@cpanel-clean-room/shared';

export interface AuthRouteOptions {
  db: DatabaseConnection;
  jwtSecret?: string;
}

export function registerAuthRoutes(options: AuthRouteOptions): Router {
  const router = Router();
  const db = options.db;
  const passwordService = new PasswordService();
  const jwt = new JwtService(options.jwtSecret);
  const totp = new TotpService();
  const revocations = new SessionRevocationService(db);
  const authMiddleware = createAuthMiddleware({ db, jwtSecret: options.jwtSecret });
  const impersonationMiddleware = createImpersonationMiddleware({ db });

  /**
   * POST /login
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { username, password, twoFactorCode } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Username and password are required', status: 400 },
      });
      return;
    }

    const user = db.prepare<any>(
      `SELECT id, username, email, password_hash, role, reseller_id, status, quota_bytes,
              two_factor_enabled, two_factor_secret, two_factor_recovery_codes, last_totp_step
       FROM users WHERE username = ?`
    ).get(username);

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid username or password', status: 401 },
      });
      return;
    }

    const passwordMatch = await passwordService.verify(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid username or password', status: 401 },
      });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Account is suspended', status: 403 },
      });
      return;
    }

    // Check 2FA
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        res.status(403).json({
          success: false,
          requires2FA: true,
          error: { code: '2FA_REQUIRED', message: 'Two-factor authentication code required', status: 403 },
        });
        return;
      }

      const lastTotpStep = user.last_totp_step || 0;
      const totpResult = totp.verifyStep(twoFactorCode, user.two_factor_secret, lastTotpStep);
      if (!totpResult.valid) {
        // Try recovery codes
        let recoveryHashes: string[] = [];
        try {
          recoveryHashes = JSON.parse(user.two_factor_recovery_codes || '[]');
        } catch {}

        const recoveryRes = totp.verifyAndConsumeRecoveryCode(twoFactorCode, recoveryHashes);
        if (!recoveryRes.valid) {
          res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid two-factor code or recovery code', status: 401 },
          });
          return;
        }

        // Burn consumed recovery code
        db.prepare(
          `UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?`
        ).run(JSON.stringify(recoveryRes.remainingHashedCodes), user.id);
      } else {
        // Record consumed TOTP time step to prevent replay attacks (RFC 6238 §5.2)
        db.prepare(
          `UPDATE users SET last_totp_step = ? WHERE id = ?`
        ).run(totpResult.step, user.id);
      }
    }

    const { token: accessToken, expiresAt: accessExpiresAt } = jwt.signAccessToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as UserRole,
      resellerId: user.reseller_id,
    });

    const { token: refreshToken } = jwt.signRefreshToken(user.id);

    // Set cookie
    res.cookie('panel_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      expiresAt: accessExpiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        resellerId: user.reseller_id,
      },
    });
  });

  /**
   * POST /refresh
   */
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Refresh token required', status: 400 },
      });
      return;
    }

    try {
      const payload = jwt.verifyRefreshToken(refreshToken);
      const user = db.prepare<any>(
        `SELECT id, username, email, role, reseller_id, status FROM users WHERE id = ?`
      ).get(payload.sub);

      if (!user || user.status === 'suspended') {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not found or suspended', status: 401 },
        });
        return;
      }

      const { token: newAccessToken, expiresAt: accessExpiresAt } = jwt.signAccessToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as UserRole,
        resellerId: user.reseller_id,
      });

      res.cookie('panel_token', newAccessToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.json({
        success: true,
        accessToken: newAccessToken,
        expiresAt: accessExpiresAt,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: err.message || 'Invalid refresh token', status: 401 },
      });
    }
  });

  /**
   * POST /logout
   */
  router.post('/logout', async (req: Request, res: Response): Promise<void> => {
    // If authenticated via Bearer JWT, revoke JTI
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const payload = jwt.verifyAccessToken(token);
        revocations.revokeToken(payload.jti, payload.sub, payload.exp);
      } catch {}
    }

    res.clearCookie('panel_token');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  /**
   * GET /me
   */
  router.get('/me', authMiddleware, impersonationMiddleware, (req: Request, res: Response): void => {
    res.json({
      success: true,
      user: req.user,
      effectiveUser: req.effectiveUser,
      isImpersonating: req.isImpersonating,
      impersonator: req.impersonator,
    });
  });

  return router;
}
