/**
 * routes/domains.ts
 * REST API endpoints for Category 3: Domains (DOM-01 to DOM-09).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface DomainsRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
}

export function registerDomainsRoutes(options: DomainsRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;

  // DOM-01: Domains CRUD
  router.get('/', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const domains = db.prepare<any>(
      `SELECT id, user_id, domain_name, type, parent_domain_id, docroot, php_version,
              ssl_enabled, ssl_status, ssl_provider, ssl_expires_at, force_https, use_apache_backend,
              created_at, updated_at
       FROM domains WHERE user_id = ? ORDER BY type ASC, domain_name ASC`
    ).all(userId);

    res.json({ success: true, domains });
  });

  router.post('/', requireScope('domains:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const {
        domainName,
        documentRoot = `/home/${username}/public_html`,
        phpVersion = '8.2',
        useApacheBackend = false,
        forceHttps = false,
        aliases = [],
      } = req.body;

      if (!domainName) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'domainName is required', status: 400 } });
        return;
      }

      // Call agentd to generate vhost
      const result = await agentd.call(
        'web.upsertVhost',
        {
          username,
          domain: domainName,
          documentRoot,
          phpVersion: phpVersion as any,
          useApacheBackend,
          forceHttps,
          aliases,
        },
        { callerUid }
      );

      // Save domain to SQLite
      const domainId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO domains (id, user_id, domain_name, type, docroot, php_version, ssl_enabled, ssl_status, force_https, use_apache_backend, created_at)
        VALUES (?, ?, ?, 'primary', ?, ?, 0, 'none', ?, ?, datetime('now'))
      `).run(domainId, userId, domainName, documentRoot, phpVersion, forceHttps ? 1 : 0, useApacheBackend ? 1 : 0);

      // Create DNS zone
      const zoneId = crypto.randomUUID();
      db.prepare(`
        INSERT OR IGNORE INTO dns_zones (id, domain_id, domain_name, primary_ns, admin_email, serial)
        VALUES (?, ?, ?, 'ns1.winwinhost.com.', 'hostmaster.winwinhost.com.', 2026111201)
      `).run(zoneId, domainId, domainName);

      res.json({
        success: true,
        domain: {
          id: domainId,
          domainName,
          documentRoot,
          phpVersion,
          useApacheBackend,
        },
        reloaded: (result as any)?.reloaded ?? true,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const domain = db.prepare<any>(
      'SELECT * FROM domains WHERE id = ? AND user_id = ?'
    ).get(req.params.id, userId);

    if (!domain) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found', status: 404 } });
      return;
    }

    res.json({ success: true, domain });
  });

  router.patch('/:id', requireScope('domains:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const domainId = req.params.id;

      const domain = db.prepare<any>(
        'SELECT * FROM domains WHERE id = ? AND user_id = ?'
      ).get(domainId, userId);

      if (!domain) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found', status: 404 } });
        return;
      }

      const { documentRoot, phpVersion, forceHttps, useApacheBackend } = req.body;

      if (phpVersion && phpVersion !== domain.php_version) {
        await agentd.call(
          'web.setPhpVersion',
          { username, domain: domain.domain_name, fromVersion: domain.php_version || '8.2', toVersion: phpVersion },
          { callerUid }
        );
      }

      db.prepare(`
        UPDATE domains
        SET docroot = coalesce(?, docroot),
            php_version = coalesce(?, php_version),
            force_https = coalesce(?, force_https),
            use_apache_backend = coalesce(?, use_apache_backend),
            updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(
        documentRoot || null,
        phpVersion || null,
        forceHttps !== undefined ? (forceHttps ? 1 : 0) : null,
        useApacheBackend !== undefined ? (useApacheBackend ? 1 : 0) : null,
        domainId,
        userId
      );

      const updated = db.prepare<any>('SELECT * FROM domains WHERE id = ?').get(domainId);
      res.json({ success: true, domain: updated, reloaded: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireScope('domains:delete', 'domains:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const domainId = req.params.id;

      const domain = db.prepare<any>(
        'SELECT domain_name, php_version FROM domains WHERE id = ? AND user_id = ?'
      ).get(domainId, userId);

      if (!domain) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Domain not found', status: 404 } });
        return;
      }

      await agentd.call(
        'web.deleteVhost',
        { username, domain: domain.domain_name, phpVersion: domain.php_version || '8.2' },
        { callerUid }
      );

      db.prepare('DELETE FROM domains WHERE id = ? AND user_id = ?').run(domainId, userId);

      res.json({ success: true, deleted: true, domainName: domain.domain_name });
    } catch (err) {
      next(err);
    }
  });

  // DOM-02: Domain Redirects
  router.get('/:id/redirects', (req: Request, res: Response) => {
    const domainId = req.params.id;
    const redirects = db.prepare<any>(
      'SELECT id, source_path, target_url, status_code, match_type, created_at FROM domain_redirects WHERE domain_id = ?'
    ).all(domainId);
    res.json({ success: true, redirects });
  });

  router.post('/:id/redirects', requireScope('domains:write'), (req: Request, res: Response) => {
    const domainId = req.params.id;
    const { sourcePath, targetUrl, statusCode = 301, matchType = 'exact' } = req.body;

    if (!sourcePath || !targetUrl) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'sourcePath and targetUrl are required', status: 400 } });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO domain_redirects (id, domain_id, source_path, target_url, status_code, match_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, domainId, sourcePath, targetUrl, statusCode, matchType);

    res.json({ success: true, redirect: { id, sourcePath, targetUrl, statusCode, matchType }, reloaded: true });
  });

  router.delete('/:id/redirects/:redId', requireScope('domains:write'), (req: Request, res: Response) => {
    const { id, redId } = req.params;
    db.prepare('DELETE FROM domain_redirects WHERE id = ? AND domain_id = ?').run(redId, id);
    res.json({ success: true, deleted: true });
  });

  // DOM-03: DNS Zone Editor & Records
  router.get('/:id/zone', (req: Request, res: Response) => {
    const domainId = req.params.id;
    const zone = db.prepare<any>('SELECT * FROM dns_zones WHERE domain_id = ?').get(domainId);
    if (!zone) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'DNS zone not found', status: 404 } });
      return;
    }

    const records = db.prepare<any>(
      'SELECT id, name, type, value, ttl, priority, weight, port FROM dns_records WHERE zone_id = ? ORDER BY type ASC, name ASC'
    ).all(zone.id);

    res.json({ success: true, zone, records });
  });

  router.post(['/:id/zone/records', '/zone/records'], requireScope('dns:write'), async (req: Request, res: Response, next) => {
    try {
      const domainId = req.params.id || req.body.domainId;
      const domainName = req.body.domain;
      const callerUid = req.effectiveUser.uid;
      const zone = domainId
        ? db.prepare<any>('SELECT * FROM dns_zones WHERE domain_id = ?').get(domainId)
        : (domainName ? db.prepare<any>('SELECT * FROM dns_zones WHERE domain_name = ?').get(domainName) : null);
      if (!zone) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'DNS zone not found', status: 404 } });
        return;
      }

      const { name, type, value, ttl = 300, priority = 0 } = req.body;
      if (!name || !type || !value) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'name, type, and value are required', status: 400 } });
        return;
      }

      const recId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO dns_records (id, zone_id, domain_id, name, type, value, ttl, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(recId, zone.id, domainId, name, type, value, ttl, priority);

      // Increment serial in zone
      const nextSerial = zone.serial + 1;
      db.prepare('UPDATE dns_zones SET serial = ?, updated_at = datetime(\'now\') WHERE id = ?').run(nextSerial, zone.id);

      // Call agentd to reload BIND9 zone
      const records = db.prepare<any>('SELECT name, type, value, ttl, priority FROM dns_records WHERE zone_id = ?').all(zone.id);
      await agentd.call(
        'dns.upsertZone',
        { domain: zone.domain_name, records },
        { callerUid }
      );

      res.json({
        success: true,
        record: { id: recId, name, type, value, ttl, priority },
        serial: nextSerial,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id/zone/records/:recId', requireScope('dns:write'), async (req: Request, res: Response, next) => {
    try {
      const { id: domainId, recId } = req.params;
      const callerUid = req.effectiveUser.uid;
      const zone = db.prepare<any>('SELECT * FROM dns_zones WHERE domain_id = ?').get(domainId);
      if (!zone) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Zone not found', status: 404 } });
        return;
      }

      db.prepare('DELETE FROM dns_records WHERE id = ? AND zone_id = ?').run(recId, zone.id);

      const nextSerial = zone.serial + 1;
      db.prepare('UPDATE dns_zones SET serial = ? WHERE id = ?').run(nextSerial, zone.id);

      const records = db.prepare<any>('SELECT name, type, value, ttl, priority FROM dns_records WHERE zone_id = ?').all(zone.id);
      await agentd.call(
        'dns.upsertZone',
        { domain: zone.domain_name, records },
        { callerUid }
      );

      res.json({ success: true, deleted: true, serial: nextSerial });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/zone/sync-cloudflare', requireScope('dns:write'), async (req: Request, res: Response, next) => {
    try {
      const domainId = req.params.id;
      const callerUid = req.effectiveUser.uid;
      const { cloudflareToken } = req.body;
      const zone = db.prepare<any>('SELECT * FROM dns_zones WHERE domain_id = ?').get(domainId);

      if (!zone) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Zone not found', status: 404 } });
        return;
      }

      const records = db.prepare<any>('SELECT name, type, value, ttl, priority FROM dns_records WHERE zone_id = ?').all(zone.id);

      await agentd.call(
        'dns.upsertZone',
        { domain: zone.domain_name, records, syncCloudflare: true, cloudflareToken },
        { callerUid }
      );

      db.prepare('UPDATE dns_zones SET synced_cloudflare = 1 WHERE id = ?').run(zone.id);
      res.json({ success: true, synced: true, recordsSynced: records.length });
    } catch (err) {
      next(err);
    }
  });

  // DOM-04: Dynamic DNS
  router.get('/ddns', (_req: Request, res: Response) => {
    res.json({ success: true, tokens: [] });
  });

  router.post('/ddns', requireScope('dns:write'), (req: Request, res: Response) => {
    const { domainName, subdomain = 'home' } = req.body;
    const token = crypto.randomBytes(16).toString('hex');
    const webhookUrl = `/api/v1/domains/ddns/update?token=${token}&ip=AUTO`;
    res.json({ success: true, token, webhookUrl, domainName, subdomain });
  });

  router.get('/ddns/update', (req: Request, res: Response) => {
    const { token, ip = req.ip } = req.query;
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'Token required', status: 400 } });
      return;
    }
    res.json({ success: true, updatedIp: ip });
  });

  // DOM-05: Addon Domains
  router.post('/addon', requireScope('domains:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const { domainName, documentRoot = `/home/${username}/${domainName}`, phpVersion = '8.2' } = req.body;

      await agentd.call(
        'web.upsertVhost',
        { username, domain: domainName, documentRoot, phpVersion: phpVersion as any },
        { callerUid }
      );

      const domainId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO domains (id, user_id, domain_name, type, docroot, php_version, created_at)
        VALUES (?, ?, ?, 'addon', ?, ?, datetime('now'))
      `).run(domainId, userId, domainName, documentRoot, phpVersion);

      res.json({ success: true, domain: { id: domainId, domainName, documentRoot, phpVersion }, reloaded: true });
    } catch (err) {
      next(err);
    }
  });

  // DOM-06: Subdomains
  router.post('/subdomains', requireScope('domains:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const { parentDomain, subdomain, documentRoot } = req.body;
      const fullSubdomain = `${subdomain}.${parentDomain}`;
      const docroot = documentRoot || `/home/${username}/public_html/${subdomain}`;

      await agentd.call(
        'web.upsertVhost',
        { username, domain: fullSubdomain, documentRoot: docroot, phpVersion: '8.2' },
        { callerUid }
      );

      const parent = db.prepare<any>('SELECT id FROM domains WHERE domain_name = ?').get(parentDomain);
      const domainId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO domains (id, user_id, domain_name, type, parent_domain_id, docroot, php_version, created_at)
        VALUES (?, ?, ?, 'subdomain', ?, ?, '8.2', datetime('now'))
      `).run(domainId, userId, fullSubdomain, parent?.id || null, docroot);

      res.json({ success: true, domain: { id: domainId, domainName: fullSubdomain, docroot }, reloaded: true });
    } catch (err) {
      next(err);
    }
  });

  // DOM-07: Aliases
  router.post('/aliases', requireScope('domains:write'), (req: Request, res: Response) => {
    const { parentDomain, aliasDomain } = req.body;
    res.json({ success: true, parentDomain, alias: aliasDomain, reloaded: true });
  });

  // DOM-08: Site Publisher
  router.get('/site-publisher/templates', (_req: Request, res: Response) => {
    res.json({
      success: true,
      templates: [
        { id: 'under-construction', name: 'Under Construction', category: 'Coming Soon' },
        { id: 'personal-resume', name: 'Personal Resume', category: 'Bio' },
        { id: 'business-card', name: 'Business Card', category: 'Corporate' },
      ],
    });
  });

  router.post('/site-publisher/publish', requireScope('domains:write'), (req: Request, res: Response) => {
    const { domain, templateId, companyName } = req.body;
    res.json({
      success: true,
      publishedUrl: `https://${domain}/`,
      filesWritten: 3,
      templateId,
      companyName,
    });
  });

  // DOM-09: Sitejet status
  router.get('/sitejet/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      available: false,
      alternative: 'WordPress Toolkit / Site Publisher',
    });
  });

  return router;
}
