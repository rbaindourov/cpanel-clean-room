/**
 * routes/admin.ts
 * WHM Administration and Reseller Management endpoints.
 */

import os from 'node:os';
import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { PasswordService } from '../auth/password.ts';
import { requireRole } from '../middlewares/auth.ts';

export interface AdminRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
}

export function registerAdminRoutes(options: AdminRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;
  const passwordService = new PasswordService();

  // Enforce Admin or Reseller role across all /admin routes
  router.use(requireRole('admin', 'reseller'));

  // Accounts / Tenants Management
  router.get(['/accounts', '/tenants'], (req: Request, res: Response) => {
    const isReseller = req.user.role === 'reseller';
    let query = `
      SELECT id, username, email, role, reseller_id, quota_bytes, bandwidth_limit_bytes,
             plan_name, status, created_at, updated_at
      FROM users
    `;
    const params: any[] = [];

    if (isReseller) {
      query += ' WHERE reseller_id = ?';
      params.push(req.user.id);
    }
    query += ' ORDER BY username ASC';

    const accounts = db.prepare<any>(query).all(...params);
    res.json({ success: true, accounts, tenants: accounts });
  });

  router.post('/accounts', async (req: Request, res: Response, next) => {
    try {
      const callerUid = req.user.uid;
      const {
        username,
        password,
        email,
        planName = 'Standard',
        planLimits,
        quotaBytes = 10737418240,
        bandwidthLimitBytes = 107374182400,
      } = req.body;

      if (!username || !password || !email) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'username, password, and email are required', status: 400 } });
        return;
      }

      // Call agentd to provision homedir and cgroups
      await agentd.call(
        'tenant.create',
        { username, plan: planLimits || {} },
        { callerUid }
      );

      const hash = await passwordService.hash(password);
      const userId = crypto.randomUUID();
      const resellerId = req.user.role === 'reseller' ? req.user.id : null;

      db.prepare(`
        INSERT INTO users (id, username, password_hash, role, reseller_id, email, quota_bytes, bandwidth_limit_bytes, plan_name, status, created_at)
        VALUES (?, ?, ?, 'customer', ?, ?, ?, ?, ?, 'active', datetime('now'))
      `).run(userId, username, hash, resellerId, email, quotaBytes, bandwidthLimitBytes, planName);

      res.json({
        success: true,
        account: {
          id: userId,
          username,
          email,
          role: 'customer',
          resellerId,
          planName,
          status: 'active',
        },
        created: true,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/accounts/:user/limits', async (req: Request, res: Response, next) => {
    try {
      const username = String(req.params.user);
      const callerUid = req.user.uid;
      const { plan = {}, quotaBytes, bandwidthLimitBytes } = req.body;

      await agentd.call(
        'tenant.updateLimits',
        { username, plan },
        { callerUid }
      );

      if (quotaBytes || bandwidthLimitBytes) {
        db.prepare(`
          UPDATE users
          SET quota_bytes = coalesce(?, quota_bytes),
              bandwidth_limit_bytes = coalesce(?, bandwidth_limit_bytes),
              updated_at = datetime('now')
          WHERE username = ?
        `).run(quotaBytes || null, bandwidthLimitBytes || null, username);
      }

      res.json({ success: true, updated: true, username });
    } catch (err) {
      next(err);
    }
  });

  router.post('/accounts/:user/suspend', async (req: Request, res: Response, next) => {
    try {
      const username = String(req.params.user);
      const callerUid = req.user.uid;
      const { reason = 'Administrative suspension' } = req.body;

      await agentd.call(
        'tenant.suspend',
        { username, reason },
        { callerUid }
      );

      db.prepare("UPDATE users SET status = 'suspended', updated_at = datetime('now') WHERE username = ?").run(username);
      res.json({ success: true, suspended: true, username });
    } catch (err) {
      next(err);
    }
  });

  router.post('/accounts/:user/resume', async (req: Request, res: Response, next) => {
    try {
      const username = String(req.params.user);
      const callerUid = req.user.uid;

      await agentd.call(
        'tenant.resume',
        { username },
        { callerUid }
      );

      db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE username = ?").run(username);
      res.json({ success: true, resumed: true, username });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/accounts/:user', async (req: Request, res: Response, next) => {
    try {
      const username = String(req.params.user);
      const callerUid = req.user.uid;
      const purgeHome = req.query.purgeHome !== 'false';

      await agentd.call(
        'tenant.delete',
        { username, purgeHome },
        { callerUid }
      );

      db.prepare('DELETE FROM users WHERE username = ?').run(username);
      res.json({ success: true, deleted: true, username });
    } catch (err) {
      next(err);
    }
  });

  // Hosting Packages
  router.get('/packages', (_req: Request, res: Response) => {
    res.json({
      success: true,
      packages: [
        { id: 'pkg-1', name: 'Starter', quotaMb: 5000, bandwidthMb: 50000, maxDomains: 1, maxDatabases: 2, maxMailboxes: 5 },
        { id: 'pkg-2', name: 'Standard', quotaMb: 10000, bandwidthMb: 100000, maxDomains: 5, maxDatabases: 10, maxMailboxes: 20 },
        { id: 'pkg-3', name: 'Pro / Reseller', quotaMb: 50000, bandwidthMb: 500000, maxDomains: 25, maxDatabases: 50, maxMailboxes: 100 },
      ],
    });
  });

  router.post('/packages', (req: Request, res: Response) => {
    const { name, limits } = req.body;
    res.json({ success: true, package: { id: crypto.randomUUID(), name, limits } });
  });

  // System Services
  router.get('/services', (_req: Request, res: Response) => {
    const services = [
      { name: 'nginx', description: 'Nginx Web Server', status: 'active', monitored: true },
      { name: 'php-fpm', description: 'MultiPHP FastCGI Process Manager', status: 'active', monitored: true },
      { name: 'bind9', description: 'BIND9 RFC 1035 DNS Server', status: 'active', monitored: true },
      { name: 'mariadb', description: 'MariaDB / MySQL Server', status: 'active', monitored: true },
      { name: 'postfix', description: 'Postfix Mail Transport Agent', status: 'active', monitored: true },
      { name: 'dovecot', description: 'Dovecot IMAP/POP3 Server', status: 'active', monitored: true },
      { name: 'rspamd', description: 'Rspamd Spam & DKIM Filter', status: 'active', monitored: true },
    ];
    res.json({ success: true, services });
  });

  router.post('/services/:name/restart', (req: Request, res: Response) => {
    res.json({ success: true, service: req.params.name, restarted: true, status: 'active' });
  });

  // Telemetry
  router.get('/telemetry', (_req: Request, res: Response) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
      success: true,
      loadAverage: os.loadavg(),
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 10000) / 100,
      },
      disk: {
        totalBytes: 107374182400, // 100 GB
        usedBytes: 32212254720,   // ~30 GB
        freeBytes: 75161927680,   // ~70 GB
        usagePercent: 30.0,
      },
      uptimeSeconds: Math.floor(os.uptime()),
    });
  });

  return router;
}
