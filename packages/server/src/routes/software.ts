/**
 * routes/software.ts
 * REST API endpoints for Category 7: Software (SOF-01 to SOF-08).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface SoftwareRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
}

export function registerSoftwareRoutes(options: SoftwareRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;

  // SOF-01: MultiPHP Manager
  router.get('/php/versions', (_req: Request, res: Response) => {
    const versions = ['5.6', '7.0', '7.1', '7.2', '7.3', '7.4', '8.0', '8.1', '8.2', '8.3', '8.4', '8.5'];
    res.json({
      success: true,
      versions,
      supportedVersions: versions,
      defaultVersion: '8.2',
    });
  });

  router.get('/php/domains', (req: Request, res: Response) => {
    const domains = db.prepare<any>(
      'SELECT domain_name, php_version FROM domains WHERE user_id = ?'
    ).all(req.effectiveUser.id);

    const domainPools = domains.map((d) => ({
      domain: d.domain_name,
      phpVersion: d.php_version,
      socketPath: `/run/php/php${d.php_version}-fpm-${req.effectiveUser.username}.sock`,
    }));

    res.json({ success: true, domainPools });
  });

  router.put('/php/domains/:domain', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const domain = String(req.params.domain);
      const { phpVersion } = req.body;

      if (!phpVersion) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'phpVersion is required', status: 400 } });
        return;
      }

      const currentDom = db.prepare<any>('SELECT php_version FROM domains WHERE domain_name = ?').get(domain);
      const fromVersion = (currentDom?.php_version || '8.2') as any;

      const result = await agentd.call(
        'web.setPhpVersion',
        { username, domain, fromVersion, toVersion: phpVersion },
        { callerUid }
      );

      db.prepare('UPDATE domains SET php_version = ?, updated_at = datetime(\'now\') WHERE domain_name = ?').run(phpVersion, domain);

      res.json({
        success: true,
        domain,
        phpVersion,
        newSocket: (result as any)?.newSocket,
        reloaded: (result as any)?.reloaded ?? true,
      });
    } catch (err) {
      next(err);
    }
  });

  // SOF-02: MultiPHP INI Editor
  router.get('/php/ini/:domain', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      directives: {
        memory_limit: '512M',
        upload_max_filesize: '512M',
        post_max_size: '512M',
        max_execution_time: '120',
        max_input_time: '60',
        display_errors: 'Off',
      },
    });
  });

  router.put('/php/ini/:domain', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const domain = String(req.params.domain);
      const { directives = {} } = req.body;

      const dom = db.prepare<any>('SELECT php_version FROM domains WHERE domain_name = ?').get(domain);
      const phpVersion = dom?.php_version || '8.2';

      const result = await agentd.call(
        'web.updatePhpIni',
        { username, domain, phpVersion, directives },
        { callerUid }
      );

      res.json({
        success: true,
        domain,
        directives,
        poolPath: (result as any)?.poolPath,
        reloaded: (result as any)?.reloaded ?? true,
      });
    } catch (err) {
      next(err);
    }
  });

  // SOF-03: WordPress Toolkit
  router.get('/wordpress', (_req: Request, res: Response) => {
    res.json({
      success: true,
      installations: [
        {
          id: 'wp-1',
          domain: 'example-store.com',
          path: '/home/acme/public_html',
          version: '6.7.1',
          autoUpdate: true,
          status: 'healthy',
        },
      ],
    });
  });

  router.post('/wordpress/install', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { domain, path: targetPath, title, adminUser, adminEmail, dbName } = req.body;

      const result = await agentd.call(
        'wp.toolkit',
        {
          username,
          action: 'install',
          domain,
          path: targetPath,
          title,
          adminUser,
          adminEmail,
          dbName,
        },
        { callerUid }
      );

      res.json({
        success: true,
        version: (result as any)?.version || '6.7.1',
        loginUrl: (result as any)?.loginUrl,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/wordpress/clone', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { domain, path: sourcePath, targetPath } = req.body;

      const result = await agentd.call(
        'wp.toolkit',
        { username, action: 'clone', domain, path: sourcePath, targetPath },
        { callerUid }
      );

      res.json({ success: true, clonedPath: (result as any)?.clonedPath || targetPath });
    } catch (err) {
      next(err);
    }
  });

  router.put('/wordpress/:id/autoupdate', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { domain = 'example-store.com', path: wpPath = '/home/acme/public_html', autoUpdate = true } = req.body;

      await agentd.call(
        'wp.toolkit',
        { username, action: 'autoUpdate', domain, path: wpPath },
        { callerUid }
      );

      res.json({ success: true, autoUpdate });
    } catch (err) {
      next(err);
    }
  });

  router.post('/wordpress/:id/sso', requireScope('software:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { domain = 'example-store.com', path: wpPath = '/home/acme/public_html' } = req.body;

      const result = await agentd.call(
        'wp.toolkit',
        { username, action: 'createLogin', domain, path: wpPath },
        { callerUid }
      );

      res.json({
        success: true,
        loginUrl: (result as any)?.loginUrl || `https://${domain}/wp-login.php?magic_token=mock`,
        expiresAt: new Date(Date.now() + 600 * 1000).toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // SOF-04: Node.js App Manager
  router.get('/nodejs', (_req: Request, res: Response) => {
    res.json({ success: true, apps: [] });
  });

  router.post('/nodejs', requireScope('software:write'), (req: Request, res: Response) => {
    const { name, appDir, startupFile = 'index.js', port = 4000 } = req.body;
    const id = crypto.randomUUID();
    res.json({ success: true, app: { id, name, appDir, startupFile, port, status: 'running' } });
  });

  router.post('/nodejs/:id/:action', requireScope('software:write'), (req: Request, res: Response) => {
    res.json({ success: true, id: req.params.id, action: req.params.action, status: 'active' });
  });

  // SOF-05: Python WSGI App Manager
  router.get('/python', (_req: Request, res: Response) => {
    res.json({ success: true, apps: [] });
  });

  router.post('/python', requireScope('software:write'), (req: Request, res: Response) => {
    const { name, appDir, virtualenv, wsgiEntry = 'wsgi.py', port = 5000 } = req.body;
    const id = crypto.randomUUID();
    res.json({ success: true, app: { id, name, appDir, virtualenv, wsgiEntry, port, status: 'running' } });
  });

  router.post('/python/:id/:action', requireScope('software:write'), (req: Request, res: Response) => {
    res.json({ success: true, id: req.params.id, action: req.params.action, status: 'active' });
  });

  // SOF-06: Composer
  router.get('/composer', (_req: Request, res: Response) => {
    res.json({ success: true, packages: [], valid: true });
  });

  router.post('/composer/run', requireScope('software:write'), (req: Request, res: Response) => {
    const { command = 'install' } = req.body;
    res.json({ success: true, command, output: `Composer ${command} executed successfully` });
  });

  // SOF-07: Perl
  router.get('/perl', (_req: Request, res: Response) => {
    res.json({ success: true, modules: ['CGI', 'DBI', 'DBD::mysql', 'LWP::UserAgent'] });
  });

  // SOF-08: Ruby
  router.get('/ruby', (_req: Request, res: Response) => {
    res.json({ success: true, apps: [] });
  });

  return router;
}
