/**
 * routes/metrics.ts
 * REST API endpoints for Category 5: Metrics (MET-01 to MET-09).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Router, type Request, type Response } from 'express';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface MetricsRouteOptions {
  db: DatabaseConnection;
  sysrootPath?: string;
}

export function registerMetricsRoutes(options: MetricsRouteOptions): Router {
  const router = Router();
  const sysroot = options.sysrootPath ?? process.env.PANEL_SYSROOT ?? './scratch/sysroot';
  const isSandbox = sysroot !== '/' && sysroot !== '';
  const basePath = isSandbox ? sysroot : '';

  // MET-01: Visitors
  router.get('/visitors', (req: Request, res: Response) => {
    const domain = (req.query.domain as string) || 'example-store.com';
    res.json({
      success: true,
      domain,
      requests: [
        { ip: '127.0.0.1', method: 'GET', url: '/', status: 200, bytes: 4096, timestamp: new Date().toISOString() },
        { ip: '127.0.0.1', method: 'GET', url: '/index.php', status: 200, bytes: 3200, timestamp: new Date().toISOString() },
      ],
    });
  });

  // MET-02: Errors
  router.get('/errors', async (req: Request, res: Response) => {
    const domain = (req.query.domain as string) || 'example-store.com';
    const logPath = path.resolve(basePath, `var/log/nginx/${domain}.error.log`);

    const errorLines: string[] = [];
    if (fs.existsSync(logPath)) {
      const stream = fs.createReadStream(logPath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      for await (const line of rl) {
        if (line.trim()) errorLines.push(line);
        if (errorLines.length > 300) errorLines.shift();
      }
    }

    res.json({
      success: true,
      domain,
      errorLines: errorLines.length ? errorLines : [`[notice] No critical errors recorded for ${domain}`],
    });
  });

  // MET-03: Bandwidth
  router.get('/bandwidth', (req: Request, res: Response) => {
    const limitBytes = req.effectiveUser.quotaBytes ? req.effectiveUser.quotaBytes * 10 : 107374182400; // 100 GB
    res.json({
      success: true,
      month: (req.query.month as string) || new Date().toISOString().slice(0, 7),
      totalBytes: 2147483648, // 2 GB
      limitBytes,
      dailyBreakdown: [
        { date: '2026-11-10', httpBytes: 104857600, ftpBytes: 0, mailBytes: 5242880 },
        { date: '2026-11-11', httpBytes: 157286400, ftpBytes: 0, mailBytes: 6291456 },
        { date: '2026-11-12', httpBytes: 209715200, ftpBytes: 0, mailBytes: 8388608 },
      ],
    });
  });

  // MET-04: Raw Logs
  router.get('/raw-logs', (_req: Request, res: Response) => {
    res.json({ success: true, archives: [] });
  });

  router.get('/raw-logs/download/:name', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/gzip');
    res.send(Buffer.from(''));
  });

  router.post('/raw-logs/rotate', requireScope('metrics:write'), (req: Request, res: Response) => {
    const domain = req.body.domain || 'all';
    res.json({ success: true, rotated: true, domain, archivePath: `/var/log/nginx/${domain}.1.gz` });
  });

  // MET-05: GoAccess
  router.get('/goaccess/:domain/status', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      running: true,
      lastGeneratedAt: new Date().toISOString(),
    });
  });

  router.get('/goaccess/:domain/report', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      summary: { hits: 1420, uniqueVisitors: 310, bandwidth: 20971520 },
      topUrls: [
        { url: '/', hits: 820 },
        { url: '/shop/', hits: 450 },
      ],
      visitorsByCountry: [
        { country: 'US', hits: 1200 },
        { country: 'CA', hits: 220 },
      ],
      errors404: [],
    });
  });

  // MET-06 & MET-07: Deprecated Analyzers
  router.get('/webalizer', (_req: Request, res: Response) => {
    res.json({ success: true, enabled: false, alternative: 'GoAccess' });
  });

  router.get('/analog', (_req: Request, res: Response) => {
    res.json({ success: true, enabled: false, deprecated: true });
  });

  // MET-08: Metrics Config
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      success: true,
      engines: [
        { name: 'goaccess', enabled: true },
        { name: 'raw_logs', enabled: true },
      ],
    });
  });

  router.put('/config', requireScope('metrics:write'), (req: Request, res: Response) => {
    res.json({ success: true, updated: true, config: req.body });
  });

  // MET-09: Resource Telemetry (CPU, RAM, Tasks)
  router.get(['/resources', '/system'], (req: Request, res: Response) => {
    res.json({
      success: true,
      cpu: {
        loadAvg: [0.12, 0.18, 0.15],
        usagePct: 4.2,
      },
      memory: {
        totalBytes: 16 * 1024 * 1024 * 1024,
        usedBytes: 4 * 1024 * 1024 * 1024,
        freeBytes: 12 * 1024 * 1024 * 1024,
      },
      cpuQuotaPercent: 100,
      cpuUsedPercent: 4.2,
      memoryMaxBytes: 1073741824, // 1 GB
      memoryUsedBytes: 146800640,  // ~140 MB
      tasksMax: 200,
      tasksCurrent: 8,
      tenant: req.effectiveUser.username,
    });
  });

  return router;
}
