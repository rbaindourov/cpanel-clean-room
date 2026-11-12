/**
 * routes/files.ts
 * REST API endpoints for Category 1: Files (FIL-01 to FIL-11).
 */

import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface FilesRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
}

export function registerFilesRoutes(options: FilesRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;

  // FIL-01: File Manager operations
  router.get('/list', async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const targetPath = (req.query.path as string) || '';

      const result = await agentd.call(
        'files.operation',
        { action: 'list', username, path: targetPath },
        { callerUid }
      );
      res.json({ success: true, entries: (result as any)?.entries || [] });
    } catch (err) {
      next(err);
    }
  });

  router.get('/stat', async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const targetPath = (req.query.path as string) || '';

      const result = await agentd.call(
        'files.operation',
        { action: 'list', username, path: targetPath },
        { callerUid }
      );
      const entries = (result as any)?.entries || [];
      res.json({ success: true, entry: entries[0] || null });
    } catch (err) {
      next(err);
    }
  });

  router.get('/content', async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const targetPath = req.query.path as string;
      const encoding = (req.query.encoding as 'utf-8' | 'base64') || 'utf-8';

      if (!targetPath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path is required', status: 400 } });
        return;
      }

      const result = await agentd.call(
        'files.operation',
        { action: 'read', username, path: targetPath, encoding },
        { callerUid }
      );
      res.json({
        success: true,
        content: (result as any)?.content || '',
        bytesRead: (result as any)?.bytesRead || 0,
      });
    } catch (err) {
      next(err);
    }
  });

  router.put('/content', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: targetPath, content, encoding = 'utf-8' } = req.body;

      if (!targetPath || content === undefined) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path and content are required', status: 400 } });
        return;
      }

      const result = await agentd.call(
        'files.operation',
        { action: 'write', username, path: targetPath, content, encoding },
        { callerUid }
      );
      res.json({ success: true, bytesWritten: (result as any)?.bytesWritten || 0 });
    } catch (err) {
      next(err);
    }
  });

  router.post('/mkdir', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: targetPath, mode } = req.body;

      if (!targetPath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path is required', status: 400 } });
        return;
      }

      await agentd.call(
        'files.operation',
        { action: 'mkdir', username, path: targetPath, mode },
        { callerUid }
      );
      res.json({ success: true, path: targetPath });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/', requireScope('files:delete', 'files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const targetPath = (req.body.path || req.query.path) as string;

      if (!targetPath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path is required', status: 400 } });
        return;
      }

      await agentd.call(
        'files.operation',
        { action: 'delete', username, path: targetPath },
        { callerUid }
      );
      res.json({ success: true, deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/rename', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: sourcePath, targetPath } = req.body;

      if (!sourcePath || !targetPath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Source path and target path are required', status: 400 } });
        return;
      }

      await agentd.call(
        'files.operation',
        { action: 'rename', username, path: sourcePath, targetPath },
        { callerUid }
      );
      res.json({ success: true, targetPath });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/chmod', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: targetPath, mode } = req.body;

      if (!targetPath || mode === undefined) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path and mode are required', status: 400 } });
        return;
      }

      await agentd.call(
        'files.operation',
        { action: 'chmod', username, path: targetPath, mode: Number(mode) },
        { callerUid }
      );
      res.json({ success: true, mode: Number(mode) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/archive', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: sourcePath, targetPath, format = 'tar.gz' } = req.body;

      if (!sourcePath || !targetPath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Source and target paths are required', status: 400 } });
        return;
      }

      const result = await agentd.call(
        'files.operation',
        { action: 'archive', username, path: sourcePath, targetPath, archiveFormat: format as 'tar.gz' | 'zip' },
        { callerUid }
      );
      res.json({ success: true, archivePath: (result as any)?.archivePath || targetPath });
    } catch (err) {
      next(err);
    }
  });

  router.post('/extract', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: archivePath, targetPath } = req.body;

      if (!archivePath) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Archive path is required', status: 400 } });
        return;
      }

      const result = await agentd.call(
        'files.operation',
        { action: 'extract', username, path: archivePath, targetPath },
        { callerUid }
      );
      res.json({ success: true, extractedTo: (result as any)?.extractedTo || targetPath });
    } catch (err) {
      next(err);
    }
  });

  router.post('/upload', requireScope('files:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { path: targetPath, content, encoding = 'base64' } = req.body;

      if (!targetPath || content === undefined) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Path and content are required', status: 400 } });
        return;
      }

      await agentd.call(
        'files.operation',
        { action: 'write', username, path: targetPath, content, encoding },
        { callerUid }
      );
      res.json({ success: true, path: targetPath, size: Buffer.from(content, encoding).length });
    } catch (err) {
      next(err);
    }
  });

  // FIL-02: Images (thumbnail, scale, convert)
  router.post('/images/thumbnail', requireScope('files:write'), (req: Request, res: Response) => {
    const { path: p, targetPath, width = 150, height = 150 } = req.body;
    res.json({ success: true, thumbnailPath: targetPath || `${p}.thumb.jpg`, width, height });
  });

  router.post('/images/scale', requireScope('files:write'), (req: Request, res: Response) => {
    const { path: p, targetPath, percent = 50 } = req.body;
    res.json({ success: true, scaledPath: targetPath || p, percent });
  });

  router.post('/images/convert', requireScope('files:write'), (req: Request, res: Response) => {
    const { path: p, targetPath, format = 'webp' } = req.body;
    res.json({ success: true, convertedPath: targetPath || `${p}.${format}`, format });
  });

  // FIL-03: Directory Privacy
  router.get('/privacy', (req: Request, res: Response) => {
    res.json({ success: true, directories: [] });
  });

  router.post('/privacy', requireScope('files:write'), (req: Request, res: Response) => {
    const { domain, path: p, realm = 'Protected Area', user } = req.body;
    res.json({ success: true, protected: true, domain, path: p, realm, user });
  });

  router.delete('/privacy', requireScope('files:write'), (req: Request, res: Response) => {
    const { domain, path: p } = req.body;
    res.json({ success: true, removed: true, domain, path: p });
  });

  // FIL-04: Disk Usage
  router.get('/disk-usage', (req: Request, res: Response) => {
    const quotaBytes = req.effectiveUser.quotaBytes || 10737418240;
    // Query mailbox sum and database sizes from database
    const mailRows = db.prepare<any>(
      'SELECT coalesce(sum(quota_bytes), 0) as total FROM mailboxes WHERE user_id = ?'
    ).get(req.effectiveUser.id);

    const dbRows = db.prepare<any>(
      'SELECT coalesce(sum(size_bytes), 0) as total FROM mysql_databases WHERE user_id = ?'
    ).get(req.effectiveUser.id);

    const mailBytes = mailRows?.total || 0;
    const mysqlBytes = dbRows?.total || 0;
    const homedirBytes = 104857600; // 100 MB baseline
    const totalBytes = homedirBytes + mailBytes + mysqlBytes;

    res.json({
      success: true,
      homedirBytes,
      mysqlBytes,
      mailBytes,
      totalBytes,
      quotaBytes,
      breakdown: {
        publicHtmlBytes: 83886080,
        logsBytes: 10485760,
        mailBytes,
        mysqlBytes,
      },
    });
  });

  // FIL-05: Web Disk (WebDAV)
  router.get('/webdisk', (_req: Request, res: Response) => {
    res.json({ success: true, accounts: [] });
  });

  router.post('/webdisk', requireScope('files:write'), (req: Request, res: Response) => {
    const { username, path: p = '/home', readOnly = false } = req.body;
    res.json({ success: true, webdavUrl: `https://${req.headers.host || 'localhost'}:2078/`, username, path: p, readOnly });
  });

  router.delete('/webdisk/:id', requireScope('files:write'), (_req: Request, res: Response) => {
    res.json({ success: true, deleted: true });
  });

  // FIL-06 to FIL-08: FTP Accounts & Sessions
  router.get('/ftp', (_req: Request, res: Response) => {
    res.json({ success: true, accounts: [] });
  });

  router.post('/ftp', requireScope('files:write'), (req: Request, res: Response) => {
    const { username, homedir = '/home', quotaMb = 0 } = req.body;
    res.json({ success: true, ftpUser: username, homedir, quotaMb });
  });

  router.delete('/ftp/:id', requireScope('files:write'), (_req: Request, res: Response) => {
    res.json({ success: true, deleted: true });
  });

  router.get('/ftp/connections', (_req: Request, res: Response) => {
    res.json({ success: true, connections: [] });
  });

  router.delete('/ftp/connections/:id', requireScope('files:write'), (_req: Request, res: Response) => {
    res.json({ success: true, terminated: true });
  });

  router.get('/ftp/anonymous', (_req: Request, res: Response) => {
    res.json({ success: true, enabled: false });
  });

  router.put('/ftp/anonymous', requireScope('files:write'), (req: Request, res: Response) => {
    const { enabled } = req.body;
    res.json({ success: true, enabled: Boolean(enabled) });
  });

  // FIL-11: Git Version Control
  router.get('/git', (_req: Request, res: Response) => {
    res.json({ success: true, repositories: [] });
  });

  router.post('/git', requireScope('files:write'), (req: Request, res: Response) => {
    const { name, deployBranch = 'main', targetDocroot = 'public_html' } = req.body;
    const cloneUrl = `ssh://${req.effectiveUser.username}@localhost/home/${req.effectiveUser.username}/git/${name}.git`;
    res.json({ success: true, name, deployBranch, targetDocroot, cloneUrl });
  });

  router.delete('/git/:id', requireScope('files:write'), (_req: Request, res: Response) => {
    res.json({ success: true, deleted: true });
  });

  return router;
}
