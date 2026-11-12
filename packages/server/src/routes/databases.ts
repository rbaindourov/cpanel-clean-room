/**
 * routes/databases.ts
 * REST API endpoints for Category 2: Databases (DB-01 to DB-06).
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { AgentdClient } from '../agentd-client.ts';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { createPmaSignonSession } from '../sso/pma.ts';
import { requireScope } from '../middlewares/auth.ts';

export interface DatabasesRouteOptions {
  db: DatabaseConnection;
  agentd: AgentdClient;
  ssoSecret?: string;
  sysrootPath?: string;
}

export function registerDatabasesRoutes(options: DatabasesRouteOptions): Router {
  const router = Router();
  const agentd = options.agentd;
  const db = options.db;

  // DB-01: phpMyAdmin 1-Click Passwordless SSO (ADR-08 / DB-01)
  router.all('/pma/sso', async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const targetDb = (req.body?.targetDatabase || req.query.db || '') as string;
      const dbUser = (req.body?.databaseUser || req.query.user || username) as string;

      const session = createPmaSignonSession({
        username,
        databaseUser: dbUser,
        targetDatabase: targetDb,
        ssoSecret: options.ssoSecret,
        sysrootPath: options.sysrootPath,
      });

      res.cookie('SignonSession', session.signonToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 3600 * 1000,
      });

      if (req.method === 'GET' && !req.accepts('json') && req.accepts('html')) {
        res.redirect(302, session.redirectUrl);
        return;
      }

      res.json({
        success: true,
        signonToken: session.signonToken,
        redirectUrl: session.redirectUrl,
        cookieName: session.cookieName,
        expiresAt: session.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  });

  // DB-02: MySQL Databases & Users Overview
  router.get(['/mysql', '/mysql/databases'], (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const databases = db.prepare<any>(
      'SELECT id, db_name, charset, collation, size_bytes, created_at FROM mysql_databases WHERE user_id = ? ORDER BY db_name ASC'
    ).all(userId);

    const users = db.prepare<any>(
      'SELECT id, db_user, remote_host, created_at FROM mysql_users WHERE user_id = ? ORDER BY db_user ASC'
    ).all(userId);

    const grants = db.prepare<any>(
      `SELECT g.id, d.db_name, u.db_user, g.privileges
       FROM mysql_database_grants g
       JOIN mysql_databases d ON d.id = g.database_id
       JOIN mysql_users u ON u.id = g.database_user_id
       WHERE d.user_id = ?`
    ).all(userId);

    res.json({
      success: true,
      databases,
      users,
      grants,
    });
  });

  // Create MySQL database
  router.post('/mysql/databases', requireScope('mysql:create', 'mysql:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const { databaseName, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci' } = req.body;

      if (!databaseName) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'databaseName is required', status: 400 } });
        return;
      }

      const fullDbName = databaseName.startsWith(`${username}_`) ? databaseName : `${username}_${databaseName}`;

      // Call agentd
      const result = await agentd.call(
        'mysql.createDatabase',
        { username, databaseName },
        { callerUid }
      );

      // Record in SQLite
      const existing = db.prepare<any>('SELECT id FROM mysql_databases WHERE db_name = ?').get(fullDbName);
      if (!existing) {
        db.prepare(
          `INSERT INTO mysql_databases (id, user_id, db_name, charset, collation, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`
        ).run(crypto.randomUUID(), userId, fullDbName, charset, collation);
      }

      res.json({
        success: true,
        fullDatabaseName: (result as any)?.fullDatabaseName || fullDbName,
        created: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // Drop MySQL database
  router.delete('/mysql/databases/:dbname', requireScope('mysql:drop', 'mysql:delete', 'mysql:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const dbname = String(req.params.dbname);

      const fullDbName = dbname.startsWith(`${username}_`) ? dbname : `${username}_${dbname}`;

      await agentd.call(
        'mysql.dropDatabase',
        { username, fullDatabaseName: fullDbName },
        { callerUid }
      );

      db.prepare('DELETE FROM mysql_databases WHERE db_name = ? AND user_id = ?').run(fullDbName, userId);

      res.json({ success: true, dropped: true, databaseName: fullDbName });
    } catch (err) {
      next(err);
    }
  });

  // Create MySQL User
  router.post('/mysql/users', requireScope('mysql:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const { dbUserSuffix, password, host = 'localhost' } = req.body;

      if (!dbUserSuffix || !password) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'dbUserSuffix and password are required', status: 400 } });
        return;
      }

      const fullDbUser = dbUserSuffix.startsWith(`${username}_`) ? dbUserSuffix : `${username}_${dbUserSuffix}`;

      const existing = db.prepare<any>('SELECT id FROM mysql_users WHERE db_user = ?').get(fullDbUser);
      let uId: string;
      if (!existing) {
        uId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO mysql_users (id, user_id, db_user, remote_host, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        ).run(uId, userId, fullDbUser, host);
      } else {
        uId = existing.id;
      }

      res.json({ success: true, fullDbUser, id: uId, created: true });
    } catch (err) {
      next(err);
    }
  });

  // Delete MySQL User
  router.delete('/mysql/users/:dbuser', requireScope('mysql:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const dbuser = req.params.dbuser;
    db.prepare('DELETE FROM mysql_users WHERE db_user = ? AND user_id = ?').run(dbuser, userId);
    res.json({ success: true, dropped: true, dbUser: dbuser });
  });

  // Upsert Grant
  router.post('/mysql/grants', requireScope('mysql:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const { dbUserSuffix, password = 'MockPassword!', databaseName, privileges = ['ALL PRIVILEGES'], host = 'localhost' } = req.body;

      const fullDbName = databaseName.startsWith(`${username}_`) ? databaseName : `${username}_${databaseName}`;
      const fullDbUser = dbUserSuffix.startsWith(`${username}_`) ? dbUserSuffix : `${username}_${dbUserSuffix}`;

      // Call agentd
      await agentd.call(
        'mysql.upsertUserGrant',
        { username, databaseName: fullDbName, dbUserSuffix, password, host, privileges },
        { callerUid }
      );

      // Record in SQLite
      let dbRow = db.prepare<any>('SELECT id FROM mysql_databases WHERE db_name = ? AND user_id = ?').get(fullDbName, userId);
      if (!dbRow) {
        const newDbId = crypto.randomUUID();
        db.prepare('INSERT INTO mysql_databases (id, user_id, db_name) VALUES (?, ?, ?)').run(newDbId, userId, fullDbName);
        dbRow = { id: newDbId };
      }

      let userRow = db.prepare<any>('SELECT id FROM mysql_users WHERE db_user = ? AND user_id = ?').get(fullDbUser, userId);
      if (!userRow) {
        const newUserId = crypto.randomUUID();
        db.prepare('INSERT INTO mysql_users (id, user_id, db_user, remote_host) VALUES (?, ?, ?, ?)').run(newUserId, userId, fullDbUser, host);
        userRow = { id: newUserId };
      }

      const existingGrant = db.prepare<any>(
        'SELECT id FROM mysql_database_grants WHERE database_id = ? AND database_user_id = ?'
      ).get(dbRow.id, userRow.id);

      if (!existingGrant) {
        db.prepare(
          `INSERT INTO mysql_database_grants (id, database_id, database_user_id, privileges, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        ).run(crypto.randomUUID(), dbRow.id, userRow.id, privileges.join(', '));
      }

      res.json({ success: true, fullDbUser, fullDatabaseName: fullDbName, granted: true });
    } catch (err) {
      next(err);
    }
  });

  // DB-03: MySQL Database Wizard (Atomic DB + User + Grant)
  router.post('/mysql/wizard', requireScope('mysql:write'), async (req: Request, res: Response, next) => {
    try {
      const username = req.effectiveUser.username;
      const userId = req.effectiveUser.id;
      const callerUid = req.effectiveUser.uid;
      const { databaseName, dbUserSuffix, password, privileges = ['ALL PRIVILEGES'] } = req.body;

      if (!databaseName || !dbUserSuffix || !password) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'databaseName, dbUserSuffix, and password are required', status: 400 } });
        return;
      }

      const fullDbName = databaseName.startsWith(`${username}_`) ? databaseName : `${username}_${databaseName}`;
      const fullDbUser = dbUserSuffix.startsWith(`${username}_`) ? dbUserSuffix : `${username}_${dbUserSuffix}`;

      // 1. Create DB
      await agentd.call('mysql.createDatabase', { username, databaseName }, { callerUid });
      const dbId = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO mysql_databases (id, user_id, db_name) VALUES (?, ?, ?)').run(dbId, userId, fullDbName);

      // 2. Grant & User
      await agentd.call('mysql.upsertUserGrant', { username, databaseName: fullDbName, dbUserSuffix, password, host: 'localhost', privileges }, { callerUid });
      const uId = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO mysql_users (id, user_id, db_user) VALUES (?, ?, ?)').run(uId, userId, fullDbUser);

      const targetDb = db.prepare<any>('SELECT id FROM mysql_databases WHERE db_name = ?').get(fullDbName);
      const targetUser = db.prepare<any>('SELECT id FROM mysql_users WHERE db_user = ?').get(fullDbUser);

      if (targetDb && targetUser) {
        db.prepare(
          'INSERT OR IGNORE INTO mysql_database_grants (id, database_id, database_user_id, privileges) VALUES (?, ?, ?, ?)'
        ).run(crypto.randomUUID(), targetDb.id, targetUser.id, privileges.join(', '));
      }

      res.json({
        success: true,
        fullDatabaseName: fullDbName,
        fullDbUser,
        connectionSnippets: {
          pdo: `new PDO("mysql:host=localhost;dbname=${fullDbName}", "${fullDbUser}", "${password}");`,
          wpConfig: `define('DB_NAME', '${fullDbName}');\ndefine('DB_USER', '${fullDbUser}');\ndefine('DB_PASSWORD', '${password}');`,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // DB-04: Remote MySQL IP Access
  router.get('/mysql/remote-ips', (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const ips = db.prepare<any>(
      'SELECT id, ip_or_cidr, comment, created_at FROM remote_mysql_ips WHERE user_id = ?'
    ).all(userId);
    res.json({ success: true, remoteIps: ips });
  });

  router.post('/mysql/remote-ips', requireScope('mysql:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const { ipOrCidr, comment } = req.body;
    if (!ipOrCidr) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PARAMS', message: 'ipOrCidr required', status: 400 } });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT OR IGNORE INTO remote_mysql_ips (id, user_id, ip_or_cidr, comment) VALUES (?, ?, ?, ?)'
    ).run(id, userId, ipOrCidr, comment || null);

    res.json({ success: true, id, ipOrCidr, added: true });
  });

  router.delete('/mysql/remote-ips/:id', requireScope('mysql:write'), (req: Request, res: Response) => {
    const userId = req.effectiveUser.id;
    const id = req.params.id;
    db.prepare('DELETE FROM remote_mysql_ips WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true, deleted: true });
  });

  // DB-05: PostgreSQL Databases & Roles
  router.get('/postgres', (_req: Request, res: Response) => {
    res.json({ success: true, databases: [], roles: [] });
  });

  router.post('/postgres/databases', requireScope('postgres:write', 'databases:write'), (req: Request, res: Response) => {
    const { databaseName } = req.body;
    res.json({ success: true, databaseName, created: true });
  });

  router.delete('/postgres/databases/:name', requireScope('postgres:write', 'databases:write'), (req: Request, res: Response) => {
    res.json({ success: true, dropped: true, databaseName: req.params.name });
  });

  // DB-06: phpPgAdmin SSO
  router.post('/phppgadmin/sso', (req: Request, res: Response) => {
    const { roleName, targetDatabase } = req.body;
    res.json({
      success: true,
      redirectUrl: `/phppgadmin/index.php?db=${encodeURIComponent(targetDatabase || '')}`,
      token: crypto.randomBytes(16).toString('hex'),
      roleName,
    });
  });

  return router;
}
