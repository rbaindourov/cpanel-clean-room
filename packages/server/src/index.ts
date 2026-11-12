/**
 * index.ts
 * Main entry point for @cpanel-clean-room/server.
 */

import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { SQLiteAdapter } from './db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from './db/migrations.ts';
import { seedVahagData } from './seed-vahag.ts';
import { createServer } from './server.ts';
import { AgentdClient } from './agentd-client.ts';

export * from './server.ts';
export * from './agentd-client.ts';
export * from './db/sqlite-adapter.ts';
export * from './db/migrations.ts';
export * from './auth/password.ts';
export * from './auth/totp.ts';
export * from './auth/jwt.ts';
export * from './auth/rbac.ts';
export * from './auth/api-tokens.ts';
export * from './auth/session-revocation.ts';
export * from './ws/index.ts';
export * from './ws/terminal.ts';
export * from './ws/logs.ts';
export * from './sso/pma.ts';
export * from './sso/roundcube.ts';
export * from './seed-vahag.ts';

export function createSqliteAdapter(options: { dbPath?: string } = {}): SQLiteAdapter {
  return new SQLiteAdapter(options.dbPath || ':memory:');
}

// Standalone execution entrypoint
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const sysroot = process.env.PANEL_SYSROOT || './scratch/sysroot';
  const defaultDbPath = sysroot === '/' ? '/var/lib/panel/panel.db' : path.resolve(sysroot, 'var/lib/panel/panel.db');
  const dbPath = process.env.PANEL_DB_PATH || defaultDbPath;

  if (dbPath !== ':memory:') {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    } catch {
      // Ignore if directory exists or permissions handled by systemd StateDirectory
    }
  }

  const db = new SQLiteAdapter(dbPath);
  const migrationRunner = createStandardMigrationRunner(db);
  migrationRunner.runPendingMigrations();

  // Pre-seed authentic Vahag account if newly initialized
  seedVahagData({ db, sysrootPath: sysroot });

  const defaultSockPath = sysroot === '/' ? '/run/panel/agent.sock' : path.resolve(sysroot, 'run/panel/agent.sock');
  const sockPath = process.env.PANEL_SOCK_PATH || process.env.PANEL_AGENTD_SOCK || defaultSockPath;
  const agentd = new AgentdClient({ socketPath: sockPath });

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const staticDir = process.env.PANEL_SPA_STATIC_DIR || path.resolve('./packages/web/dist');

  const server = createServer({
    port,
    host,
    db,
    agentd,
    spaStaticDir: staticDir,
    jwtSecret: process.env.PANEL_JWT_SECRET || 'dev-secret-change-in-production',
    ssoSecret: process.env.PANEL_SSO_SECRET,
    sysrootPath: sysroot,
  });

  server.start().then(({ port: actualPort, host: actualHost }) => {
    console.log(`[panel-server] Clean-room cPanel web & API server listening on http://${actualHost}:${actualPort}`);
  }).catch((err) => {
    console.error('[panel-server] Fatal error during startup:', err);
    process.exit(1);
  });

  const handleShutdown = async (sig: string) => {
    console.log(`[panel-server] Received ${sig}, shutting down...`);
    await server.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
