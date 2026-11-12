/**
 * pma.ts
 * 1-Click phpMyAdmin Passwordless SSO bridge (ADR-08 / DB-01).
 * Compatible with packages/agentd/src/handlers/mysql.ts SignonSession format.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface PmaSsoOptions {
  username: string;
  databaseUser?: string;
  databasePassword?: string;
  targetDatabase?: string;
  ssoSecret?: string;
  sysrootPath?: string;
}

export interface PmaSsoResult {
  signonToken: string;
  redirectUrl: string;
  cookieName: 'SignonSession';
  expiresAt: string;
}

export function createPmaSignonSession(options: PmaSsoOptions): PmaSsoResult {
  const {
    username,
    databaseUser = username,
    databasePassword = '',
    targetDatabase = '',
    ssoSecret = process.env.PANEL_SSO_SECRET ||
      process.env.PANEL_PMA_SSO_SECRET ||
      'panel-pma-sso-secret-key-32bytes!',
    sysrootPath = process.env.PANEL_SYSROOT || './scratch/sysroot',
  } = options;

  const fullDbUser = databaseUser.startsWith(`${username}_`)
    ? databaseUser
    : `${username}_${databaseUser}`;

  const signonToken = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();

  const hmac = crypto
    .createHmac('sha256', ssoSecret)
    .update(`${fullDbUser}:${databasePassword}:${timestamp}`)
    .digest('hex');

  const sessionData =
    `PMA_single_signon_user|s:${fullDbUser.length}:"${fullDbUser}";` +
    `PMA_single_signon_password|s:${databasePassword.length}:"${databasePassword}";` +
    `PMA_single_signon_host|s:9:"localhost";` +
    `PMA_single_signon_HMAC|s:64:"${hmac}";`;

  const isSandbox = sysrootPath !== '/' && sysrootPath !== '';
  const tmpDir = isSandbox ? path.resolve(sysrootPath, 'tmp') : '/tmp';

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const sessionFilePath = path.join(tmpDir, `sess_${signonToken}`);
  fs.writeFileSync(sessionFilePath, sessionData, { mode: 0o600 });

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const redirectUrl = targetDatabase
    ? `/pma/index.php?route=/database/structure&db=${encodeURIComponent(targetDatabase)}`
    : '/pma/index.php';

  return {
    signonToken,
    redirectUrl,
    cookieName: 'SignonSession',
    expiresAt,
  };
}
