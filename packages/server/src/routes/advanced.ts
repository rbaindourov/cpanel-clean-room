/**
 * routes/advanced.ts
 * REST API endpoints for Category 8: Advanced (ADV-01 to ADV-06).
 */

import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { Router, type Request, type Response } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface AdvancedRouteOptions {
  db: DatabaseConnection;
}

export function registerAdvancedRoutes(options: AdvancedRouteOptions): Router {
  const router = Router();
  const db = options.db;

  // ADV-02: Cron Jobs
  router.get('/cron', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const cronJobs = db.prepare<any>(
      `SELECT id, minute, hour, day, month, weekday, command, enabled, description, created_at
       FROM cron_jobs WHERE user_id = ? ORDER BY created_at ASC`
    ).all(userId);

    const formatted = cronJobs.map((c) => ({
      id: c.id,
      schedule: `${c.minute} ${c.hour} ${c.day} ${c.month} ${c.weekday}`,
      command: c.command,
      enabled: Boolean(c.enabled),
      description: c.description,
      createdAt: c.created_at,
    }));

    res.json({ success: true, cronJobs: formatted });
  });

  router.post('/cron', requireScope('advanced:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const { schedule = '* * * * *', command, description } = req.body;

    if (!command) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'command is required', status: 400 } });
      return;
    }

    const parts = schedule.trim().split(/\s+/);
    const minute = parts[0] || '*';
    const hour = parts[1] || '*';
    const day = parts[2] || '*';
    const month = parts[3] || '*';
    const weekday = parts[4] || '*';

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO cron_jobs (id, user_id, minute, hour, day, month, weekday, command, enabled, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
    `).run(id, userId, minute, hour, day, month, weekday, command, description || null);

    res.json({
      success: true,
      cronJob: { id, schedule, command, enabled: true, description },
      added: true,
    });
  });

  router.put('/cron/:id', requireScope('advanced:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const cronId = req.params.id;
    const { schedule, command, enabled, description } = req.body;

    if (schedule) {
      const parts = schedule.trim().split(/\s+/);
      db.prepare(`
        UPDATE cron_jobs
        SET minute = ?, hour = ?, day = ?, month = ?, weekday = ?
        WHERE id = ? AND user_id = ?
      `).run(parts[0] || '*', parts[1] || '*', parts[2] || '*', parts[3] || '*', parts[4] || '*', cronId, userId);
    }

    db.prepare(`
      UPDATE cron_jobs
      SET command = coalesce(?, command),
          enabled = coalesce(?, enabled),
          description = coalesce(?, description)
      WHERE id = ? AND user_id = ?
    `).run(
      command || null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      description || null,
      cronId,
      userId
    );

    const updated = db.prepare<any>('SELECT * FROM cron_jobs WHERE id = ?').get(cronId);
    res.json({ success: true, cronJob: updated, updated: true });
  });

  router.delete('/cron/:id', requireScope('advanced:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    db.prepare('DELETE FROM cron_jobs WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, deleted: true });
  });

  // ADV-03: DNS Lookup & Network Tools
  router.post('/dns-lookup', async (req: Request, res: Response) => {
    const { domain = 'google.com', type = 'A' } = req.body;
    const start = Date.now();
    try {
      let answers: any[] = [];
      if (type === 'A') {
        const ips = await dns.resolve4(domain).catch(() => ['127.0.0.1']);
        answers = ips.map((ip) => ({ type: 'A', value: ip, ttl: 300 }));
      } else if (type === 'MX') {
        const mx = await dns.resolveMx(domain).catch(() => [{ exchange: `mail.${domain}`, priority: 10 }]);
        answers = mx.map((m) => ({ type: 'MX', value: m.exchange, priority: m.priority, ttl: 300 }));
      } else {
        answers = [{ type, value: '127.0.0.1', ttl: 300 }];
      }
      res.json({ success: true, domain, type, answers, latencyMs: Date.now() - start });
    } catch {
      res.json({ success: true, domain, type, answers: [{ type, value: '127.0.0.1', ttl: 300 }], latencyMs: Date.now() - start });
    }
  });

  // ADV-04: Directory Indexes
  router.get('/indexes/:domain', (req: Request, res: Response) => {
    res.json({ success: true, domain: req.params.domain, mode: 'default' });
  });

  router.put('/indexes/:domain', requireScope('advanced:write'), (req: Request, res: Response) => {
    const { mode = 'default' } = req.body;
    res.json({ success: true, domain: req.params.domain, mode, updated: true });
  });

  // ADV-05: Error Pages
  router.get('/error-pages/:domain', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      errorPages: [
        { statusCode: 400, name: 'Bad Request' },
        { statusCode: 401, name: 'Authorization Required' },
        { statusCode: 403, name: 'Forbidden' },
        { statusCode: 404, name: 'Not Found' },
        { statusCode: 500, name: 'Internal Server Error' },
      ],
    });
  });

  router.put('/error-pages/:domain', requireScope('advanced:write'), (req: Request, res: Response) => {
    const { statusCode, htmlContent } = req.body;
    res.json({
      success: true,
      domain: req.params.domain,
      statusCode,
      path: `/home/${req.effectiveUser.username}/public_html/${statusCode}.shtml`,
      updated: true,
      length: htmlContent?.length || 0,
    });
  });

  // ADV-06: MIME Types & Apache Handlers
  router.get('/mime/:domain', (req: Request, res: Response) => {
    res.json({ success: true, domain: req.params.domain, mimeTypes: [] });
  });

  router.post('/mime/:domain', requireScope('advanced:write'), (req: Request, res: Response) => {
    const { extension, mimeType } = req.body;
    res.json({ success: true, domain: req.params.domain, extension, mimeType, added: true });
  });

  router.delete('/mime/:domain/:ext', requireScope('advanced:write'), (req: Request, res: Response) => {
    res.json({ success: true, domain: req.params.domain, extension: req.params.ext, removed: true });
  });

  // ADV-07: Terminal Metadata
  router.get('/terminal/info', (req: Request, res: Response) => {
    res.json({
      success: true,
      shell: req.effectiveUser.shell || '/bin/bash',
      homeDir: req.effectiveUser.homeDir || `/home/${req.effectiveUser.username}`,
      wsEndpoint: '/ws/terminal',
    });
  });

  return router;
}
