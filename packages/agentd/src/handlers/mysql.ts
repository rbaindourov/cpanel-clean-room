import crypto from 'node:crypto';
import { SysrootEngine } from '../sysroot.ts';
import type { AgentServer } from '../index.ts';
import {
  MysqlCreateDatabaseParamsSchema,
  MysqlDropDatabaseParamsSchema,
  MysqlUpsertUserGrantParamsSchema,
  MysqlCreateSignonSessionParamsSchema,
  type MysqlCreateDatabaseParams,
  type MysqlCreateDatabaseResult,
  type MysqlDropDatabaseParams,
  type MysqlDropDatabaseResult,
  type MysqlUpsertUserGrantParams,
  type MysqlUpsertUserGrantResult,
  type MysqlCreateSignonSessionParams,
  type MysqlCreateSignonSessionResult,
} from '@cpanel-clean-room/shared';

/**
 * Whitelist of permissible SQL privilege tokens for MariaDB/MySQL GRANT statements.
 */
const ALLOWED_SQL_PRIVILEGES = new Set([
  'ALL',
  'ALL PRIVILEGES',
  'ALTER',
  'ALTER ROUTINE',
  'CREATE',
  'CREATE ROUTINE',
  'CREATE TABLESPACE',
  'CREATE TEMPORARY TABLES',
  'CREATE USER',
  'CREATE VIEW',
  'DELETE',
  'DROP',
  'EVENT',
  'EXECUTE',
  'FILE',
  'GRANT OPTION',
  'INDEX',
  'INSERT',
  'LOCK TABLES',
  'PROCESS',
  'PROXY',
  'REFERENCES',
  'RELOAD',
  'REPLICATION CLIENT',
  'REPLICATION SLAVE',
  'SELECT',
  'SHOW DATABASES',
  'SHOW VIEW',
  'SHUTDOWN',
  'SUPER',
  'TRIGGER',
  'UPDATE',
  'USAGE',
]);

/**
 * Escapes standard string literals for single-quoted MariaDB SQL values.
 * In MariaDB, backslashes escape characters unless NO_BACKSLASH_ESCAPES is on.
 * We escape backslashes first, then escape single quotes by doubling them (' -> '').
 */
function escapeSqlString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Escapes SQL identifiers enclosed in backticks (`identifier`).
 * Backticks are escaped by doubling them (`` ` `` -> `` `` ``).
 */
function escapeSqlIdentifier(val: string): string {
  return val.replace(/`/g, '``');
}

export class MysqlHandler {
  sysroot: SysrootEngine;
  private ssoSecret?: string;

  constructor(sysroot: SysrootEngine, ssoSecret?: string) {
    this.sysroot = sysroot;
    this.ssoSecret = ssoSecret;
  }

  /**
   * Returns the configured HMAC secret for phpMyAdmin SSO tokens.
   * Priority: constructor-injected ssoSecret -> PANEL_SSO_SECRET -> PANEL_PMA_SSO_SECRET -> default.
   */
  private getSsoSecret(): string {
    return (
      this.ssoSecret ||
      process.env.PANEL_SSO_SECRET ||
      process.env.PANEL_PMA_SSO_SECRET ||
      'panel-pma-sso-secret-key-32bytes!'
    );
  }

  public async createDatabase(params: MysqlCreateDatabaseParams): Promise<MysqlCreateDatabaseResult> {
    const { username, databaseName, charset = 'utf8mb4', collation = 'utf8mb4_unicode_ci' } = params;

    const fullDatabaseName = databaseName.startsWith(`${username}_`)
      ? databaseName
      : `${username}_${databaseName}`;

    // Validate and escape identifiers
    const safeDbName = escapeSqlIdentifier(fullDatabaseName);
    const safeCharset = /^[a-zA-Z0-9_]+$/.test(charset) ? charset : 'utf8mb4';
    const safeCollation = /^[a-zA-Z0-9_]+$/.test(collation) ? collation : 'utf8mb4_unicode_ci';

    const sql = `CREATE DATABASE IF NOT EXISTS \`${safeDbName}\` CHARACTER SET ${safeCharset} COLLATE ${safeCollation};`;

    if (!this.sysroot.isSandbox()) {
      await this.sysroot.execCommand('mariadb', ['-e', sql]);
    } else {
      await this.sysroot.execCommand('mariadb', ['-e', sql]);
      const dbDir = `/var/lib/mysql/${fullDatabaseName}`;
      this.sysroot.ensureDir(dbDir);
    }

    return {
      fullDatabaseName,
      created: true,
    };
  }

  public async dropDatabase(params: MysqlDropDatabaseParams): Promise<MysqlDropDatabaseResult> {
    const { username, fullDatabaseName } = params;

    if (!fullDatabaseName.startsWith(`${username}_`)) {
      const err: any = new Error(
        `PERMISSION_DENIED: Cannot drop database '${fullDatabaseName}' not owned by user '${username}'`
      );
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    const safeDbName = escapeSqlIdentifier(fullDatabaseName);
    const sql = `DROP DATABASE IF EXISTS \`${safeDbName}\`;`;

    if (!this.sysroot.isSandbox()) {
      await this.sysroot.execCommand('mariadb', ['-e', sql]);
    } else {
      await this.sysroot.execCommand('mariadb', ['-e', sql]);
      const dbDir = `/var/lib/mysql/${fullDatabaseName}`;
      this.sysroot.removeFile(dbDir);
    }

    return { dropped: true };
  }

  public async upsertUserGrant(params: MysqlUpsertUserGrantParams): Promise<MysqlUpsertUserGrantResult> {
    const {
      username,
      dbUserSuffix,
      password,
      host = 'localhost',
      databaseName,
      privileges = ['ALL PRIVILEGES'],
    } = params;

    const fullDbUser = dbUserSuffix.startsWith(`${username}_`)
      ? dbUserSuffix
      : `${username}_${dbUserSuffix}`;

    // 1. Sanitize user, host, password using MariaDB string literal escaping
    const safeDbUser = escapeSqlString(fullDbUser);
    const safeHost = escapeSqlString(host);
    const safePassword = escapeSqlString(password);

    // 2. Sanitize database identifier
    const safeDatabaseName = escapeSqlIdentifier(databaseName);

    // 3. Whitelist validate privileges to prevent stacked injection via privilege string
    const validatedPrivs = privileges
      .map((p) => p.trim().toUpperCase())
      .filter((p) => ALLOWED_SQL_PRIVILEGES.has(p));

    const safePrivileges = validatedPrivs.length > 0 ? validatedPrivs : ['ALL PRIVILEGES'];
    const privStr = safePrivileges.join(', ');

    const sql = `CREATE USER IF NOT EXISTS '${safeDbUser}'@'${safeHost}' IDENTIFIED BY '${safePassword}';
ALTER USER '${safeDbUser}'@'${safeHost}' IDENTIFIED BY '${safePassword}';
GRANT ${privStr} ON \`${safeDatabaseName}\`.* TO '${safeDbUser}'@'${safeHost}';
FLUSH PRIVILEGES;`;

    await this.sysroot.execCommand('mariadb', ['-e', sql]);

    return {
      fullDbUser,
      host,
      granted: true,
    };
  }

  public async createSignonSession(
    params: MysqlCreateSignonSessionParams
  ): Promise<MysqlCreateSignonSessionResult> {
    const { username, databaseUser, databasePassword = '' } = params;

    const fullDbUser = databaseUser.startsWith(`${username}_`)
      ? databaseUser
      : `${username}_${databaseUser}`;

    // 16-byte random session ID
    const signonToken = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const hmacSecret = this.getSsoSecret();
    const hmac = crypto
      .createHmac('sha256', hmacSecret)
      .update(`${fullDbUser}:${databasePassword}:${timestamp}`)
      .digest('hex');

    // Standard PHP serialized session format for phpMyAdmin SignonSession
    const sessionData = `PMA_single_signon_user|s:${fullDbUser.length}:"${fullDbUser}";PMA_single_signon_password|s:${databasePassword.length}:"${databasePassword}";PMA_single_signon_host|s:9:"localhost";PMA_single_signon_HMAC|s:64:"${hmac}";`;

    const sessionFilePath = `/tmp/sess_${signonToken}`;
    this.sysroot.atomicWriteFile(sessionFilePath, sessionData, { mode: 0o600 });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return {
      signonToken,
      redirectUrl: '/phpmyadmin/index.php',
      expiresAt,
    };
  }
}

export function registerMysqlHandlers(server: AgentServer, ssoSecret?: string): void {
  const handler = new MysqlHandler(server.getSysroot(), ssoSecret);

  server.registerHandler('mysql.createDatabase', (p) => handler.createDatabase(p), MysqlCreateDatabaseParamsSchema);
  server.registerHandler('mysql.dropDatabase', (p) => handler.dropDatabase(p), MysqlDropDatabaseParamsSchema);
  server.registerHandler('mysql.upsertUserGrant', (p) => handler.upsertUserGrant(p), MysqlUpsertUserGrantParamsSchema);
  server.registerHandler('mysql.createSignonSession', (p) => handler.createSignonSession(p), MysqlCreateSignonSessionParamsSchema);
}
