/**
 * routes/preferences.ts
 * REST API endpoints for Category 9: Preferences (PRE-01 to PRE-05).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { PasswordService } from '../auth/password.ts';
import { TotpService } from '../auth/totp.ts';
import { JwtService } from '../auth/jwt.ts';
import { RbacPolicyEngine } from '../auth/rbac.ts';
import type { UserRole } from '@cpanel-clean-room/shared';
import { requireScope } from '../middlewares/auth.ts';

export interface PreferencesRouteOptions {
  db: DatabaseConnection;
  jwtSecret?: string;
}

export function registerPreferencesRoutes(options: PreferencesRouteOptions): Router {
  const router = Router();
  const db = options.db;
  const passwordService = new PasswordService();
  const totp = new TotpService();
  const jwt = new JwtService(options.jwtSecret);
  const rbac = new RbacPolicyEngine();

  // PRE-01: User Manager (Subaccounts)
  router.get('/subusers', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const subusers = db.prepare<any>(
      'SELECT id, username, scopes, created_at FROM subusers WHERE user_id = ?'
    ).all(userId);

    const formatted = subusers.map((s) => ({
      id: s.id,
      username: s.username,
      scopes: JSON.parse(s.scopes || '[]'),
      createdAt: s.created_at,
    }));

    res.json({ success: true, subusers: formatted });
  });

  router.post('/subusers', requireScope('preferences:write'), async (req: Request, res: Response, next) => {
    try {
      const userId = req.effectiveUser.id;
      const { username, password, scopes = ['ftp', 'email'] } = req.body;

      if (!username || !password) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'username and password are required', status: 400 } });
        return;
      }

      const hash = await passwordService.hash(password);
      const id = crypto.randomUUID();

      db.prepare(`
        INSERT INTO subusers (id, user_id, username, password_hash, scopes, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(id, userId, username, hash, JSON.stringify(scopes));

      res.json({
        success: true,
        subuser: { id, username, scopes },
        created: true,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/subusers/:id', requireScope('preferences:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    db.prepare('DELETE FROM subusers WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, deleted: true });
  });

  // PRE-02: Password & Security
  router.post('/password', requireScope('preferences:write'), async (req: Request, res: Response, next) => {
    try {
      const userId = req.effectiveUser.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'currentPassword and newPassword are required', status: 400 } });
        return;
      }

      const user = db.prepare<any>('SELECT password_hash FROM users WHERE id = ?').get(userId);
      const match = await passwordService.verify(currentPassword, user.password_hash);

      if (!match) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Current password does not match', status: 401 } });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long', status: 400 } });
        return;
      }

      const newHash = await passwordService.hash(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newHash, userId);

      res.json({ success: true, updated: true, sessionsTerminated: 1 });
    } catch (err) {
      next(err);
    }
  });

  // PRE-03: Two-Factor Authentication (TOTP)
  router.post('/2fa/setup', requireScope('preferences:write'), (req: Request, res: Response) => {
    const username = req.effectiveUser.username;
    const enrollment = totp.generateEnrollment(username);

    // Store unverified secret in DB
    db.prepare(`
      UPDATE users
      SET two_factor_secret = ?,
          two_factor_recovery_codes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(enrollment.secret, JSON.stringify(enrollment.hashedRecoveryCodes), req.effectiveUser.id);

    res.json({
      success: true,
      secret: enrollment.secret,
      qrCodeUri: enrollment.uri,
      recoveryCodes: enrollment.recoveryCodes,
    });
  });

  router.post('/2fa/verify', requireScope('preferences:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Token required', status: 400 } });
      return;
    }

    const user = db.prepare<any>('SELECT two_factor_secret, last_totp_step FROM users WHERE id = ?').get(userId);
    if (!user?.two_factor_secret) {
      res.status(400).json({ success: false, error: { code: '2FA_NOT_INITIALIZED', message: 'Run 2FA setup first', status: 400 } });
      return;
    }

    const totpResult = totp.verifyStep(token, user.two_factor_secret, user.last_totp_step || 0);
    if (!totpResult.valid) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid 6-digit TOTP code', status: 400 } });
      return;
    }

    db.prepare('UPDATE users SET two_factor_enabled = 1, last_totp_step = ?, updated_at = datetime(\'now\') WHERE id = ?').run(totpResult.step, userId);
    res.json({ success: true, verified: true, enabled: true });
  });

  router.post('/2fa/disable', requireScope('preferences:write'), async (req: Request, res: Response, next) => {
    try {
      const userId = req.effectiveUser.id;
      const { password } = req.body;

      const user = db.prepare<any>('SELECT password_hash FROM users WHERE id = ?').get(userId);
      const match = await passwordService.verify(password || '', user?.password_hash || '');

      if (!match) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Current password required to disable 2FA', status: 401 } });
        return;
      }

      db.prepare(`
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret = NULL,
            two_factor_recovery_codes = NULL,
            last_totp_step = 0,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(userId);

      res.json({ success: true, disabled: true });
    } catch (err) {
      next(err);
    }
  });

  // PRE-04: User Impersonation Token Minting (Admin / Reseller)
  router.post('/impersonate', requireScope('preferences:write'), (req: Request, res: Response) => {
    const caller = req.user;
    const { targetUsername } = req.body;

    if (!targetUsername) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'targetUsername required', status: 400 } });
      return;
    }

    const targetUser = db.prepare<any>(
      'SELECT id, username, email, role, reseller_id, status FROM users WHERE username = ?'
    ).get(targetUsername);

    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Target user '${targetUsername}' not found`, status: 404 } });
      return;
    }

    const check = rbac.canImpersonate(caller, targetUser);
    if (!check.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN_IMPERSONATION', message: check.reason, status: 403 } });
      return;
    }

    const { token, expiresAt } = jwt.signAccessToken({
      id: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      role: targetUser.role as UserRole,
      resellerId: targetUser.reseller_id,
    });

    res.json({
      success: true,
      token,
      targetUser: { id: targetUser.id, username: targetUser.username, role: targetUser.role },
      expiresAt,
    });
  });

  router.post('/impersonate/exit', (_req: Request, res: Response) => {
    res.json({ success: true, exited: true });
  });

  // PRE-05: Contact Information
  router.get('/contact', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const row = db.prepare<any>('SELECT email, notify_at_80, notify_at_90 FROM contact_preferences WHERE user_id = ?').get(userId);

    res.json({
      success: true,
      email: row?.email || req.effectiveUser.email,
      notifyAt80Percent: row ? Boolean(row.notify_at_80) : true,
      notifyAt90Percent: row ? Boolean(row.notify_at_90) : true,
    });
  });

  router.put('/contact', requireScope('preferences:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const { email, notifyAt80Percent = true, notifyAt90Percent = true } = req.body;

    db.prepare(`
      INSERT INTO contact_preferences (user_id, email, notify_at_80, notify_at_90, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        email = excluded.email,
        notify_at_80 = excluded.notify_at_80,
        notify_at_90 = excluded.notify_at_90,
        updated_at = datetime('now')
    `).run(userId, email || req.effectiveUser.email, notifyAt80Percent ? 1 : 0, notifyAt90Percent ? 1 : 0);

    res.json({ success: true, email, notifyAt80Percent, notifyAt90Percent, updated: true });
  });

  // PREF-04: Theme Selection
  router.get('/theme', (_req: Request, res: Response) => {
    res.json({ success: true, theme: 'dark' });
  });

  router.put('/theme', requireScope('preferences:write'), (req: Request, res: Response) => {
    const { theme = 'dark' } = req.body;
    res.json({ success: true, theme, updated: true });
  });

  return router;
}
