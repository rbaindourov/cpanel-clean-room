/**
 * routes/security.ts
 * REST API endpoints for Category 6: Security (SEC-01 to SEC-07).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { ApiTokenService } from '../auth/api-tokens.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface SecurityRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
}

export function registerSecurityRoutes(options: SecurityRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;
  const apiTokens = new ApiTokenService(db);

  // SEC-01: SSH Keys
  router.get('/ssh', (_req: Request, res: Response) => {
    res.json({ success: true, keys: [] });
  });

  router.post('/ssh/generate', requireScope('security:write'), (req: Request, res: Response) => {
    const { keyName, type = 'ed25519' } = req.body;
    let publicKey: string;
    let privateKey: string;
    if (type === 'rsa') {
      const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    } else {
      const keys = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
    }

    res.json({ success: true, keyName, publicKey, privateKey, type });
  });

  router.post('/ssh/import', requireScope('security:write'), (req: Request, res: Response) => {
    const { keyName, publicKey } = req.body;
    res.json({
      success: true,
      keyName,
      fingerprint: crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 32),
      imported: true,
    });
  });

  router.delete('/ssh/:id', requireScope('security:write'), (_req: Request, res: Response) => {
    res.json({ success: true, deleted: true });
  });

  // SEC-02: IP Blocker
  router.get('/ip-blocker', (_req: Request, res: Response) => {
    res.json({ success: true, blockedIps: [] });
  });

  router.post('/ip-blocker', requireScope('security:write'), (req: Request, res: Response) => {
    const { ipOrCidr, note } = req.body;
    if (!ipOrCidr) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'ipOrCidr required', status: 400 } });
      return;
    }
    const id = crypto.randomUUID();
    res.json({ success: true, id, ipOrCidr, note, blocked: true });
  });

  router.delete('/ip-blocker/:id', requireScope('security:write'), (_req: Request, res: Response) => {
    res.json({ success: true, unblocked: true });
  });

  // SEC-03: SSL / TLS Status & AutoSSL
  router.get('/ssl', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const domains = db.prepare<any>(
      'SELECT id, domain_name, ssl_enabled, ssl_status, ssl_provider, ssl_expires_at FROM domains WHERE user_id = ?'
    ).all(userId);

    const certificates = domains.map((d) => ({
      domain: d.domain_name,
      status: d.ssl_status,
      provider: d.ssl_provider,
      expiresAt: d.ssl_expires_at || new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
      sanDomains: [d.domain_name, `www.${d.domain_name}`],
    }));

    res.json({ success: true, certificates });
  });

  router.post('/ssl/autossl', requireScope('security:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const callerUid = req.effectiveUser.uid;
      const { domain, sanDomains = [], email } = req.body;

      if (!domain) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'domain is required', status: 400 } });
        return;
      }

      const result = await agentd.call(
        'web.issueSsl',
        { domain, sanDomains: sanDomains || [], email: email || `admin@${domain}` },
        { callerUid }
      );

      db.prepare(`
        UPDATE domains
        SET ssl_enabled = 1,
            ssl_status = 'active',
            ssl_provider = 'letsencrypt',
            ssl_expires_at = ?,
            updated_at = datetime('now')
        WHERE domain_name = ?
      `).run((result as any)?.expiresAt, domain);

      res.json({
        success: true,
        domain,
        certPath: (result as any)?.certPath,
        keyPath: (result as any)?.keyPath,
        expiresAt: (result as any)?.expiresAt,
        sanDomains: (result as any)?.sanDomains,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ssl/install', requireScope('security:write'), (req: Request, res: Response) => {
    const { domain } = req.body;
    db.prepare(`
      UPDATE domains SET ssl_enabled = 1, ssl_status = 'active', ssl_provider = 'custom', updated_at = datetime('now')
      WHERE domain_name = ?
    `).run(domain);

    res.json({ success: true, installed: true, expiresAt: new Date(Date.now() + 365 * 86400 * 1000).toISOString() });
  });

  // SEC-04: API Tokens
  router.get('/tokens', (req: Request, res: Response) => {
    const tokens = apiTokens.listTokens(req.effectiveUser.id);
    res.json({ success: true, tokens });
  });

  router.post('/tokens', requireScope('security:write'), (req: Request, res: Response) => {
    const { name = 'API Token', scopes = ['*'], expiresInDays } = req.body;
    const { plaintextToken, record } = apiTokens.createToken(
      req.effectiveUser.id,
      name,
      scopes,
      expiresInDays ? Number(expiresInDays) : undefined
    );

    res.status(201).json({
      success: true,
      token: plaintextToken,
      id: record.id,
      tokenPrefix: record.tokenPrefix,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
    });
  });

  router.delete('/tokens/:id', requireScope('security:write'), (req: Request, res: Response) => {
    const revoked = apiTokens.revokeToken(req.effectiveUser.id, String(req.params.id));
    res.json({ success: true, revoked });
  });

  // SEC-05: Hotlink Protection
  router.get('/hotlink/:domain', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      enabled: false,
      allowedDomains: [req.params.domain],
      extensions: ['jpg', 'jpeg', 'png', 'gif'],
    });
  });

  router.put('/hotlink/:domain', requireScope('security:write'), (req: Request, res: Response) => {
    const { enabled = false, allowedDomains = [] } = req.body;
    res.json({ success: true, domain: req.params.domain, enabled, allowedDomains, updated: true });
  });

  // SEC-06: Leech Protection
  router.get('/leech/:domain', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      enabled: false,
      maxConcurrentDownloads: 10,
    });
  });

  router.put('/leech/:domain', requireScope('security:write'), (req: Request, res: Response) => {
    const { enabled = false, maxConcurrentDownloads = 10 } = req.body;
    res.json({ success: true, domain: req.params.domain, enabled, maxConcurrentDownloads, updated: true });
  });

  // SEC-07: WAF (ModSecurity / Coraza)
  router.get('/waf/:domain', (req: Request, res: Response) => {
    res.json({
      success: true,
      domain: req.params.domain,
      enabled: true,
      anomalyThreshold: 5,
      whitelistedRules: [],
    });
  });

  router.put('/waf/:domain', requireScope('security:write'), (req: Request, res: Response) => {
    const { enabled = true, anomalyThreshold = 5, whitelistedRules = [] } = req.body;
    res.json({ success: true, domain: req.params.domain, enabled, anomalyThreshold, whitelistedRules, updated: true });
  });

  return router;
}
