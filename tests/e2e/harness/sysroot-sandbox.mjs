import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const SYSROOT_ROOT = path.resolve(REPO_ROOT, 'scratch/sysroot');

/**
 * Resolves a target system path (e.g. /etc/nginx/sites-available/foo.conf)
 * into the isolated PANEL_SYSROOT sandbox directory.
 */
export function resolveSysroot(targetPath) {
  if (process.env.PANEL_SYSROOT && process.env.PANEL_SYSROOT === '/') {
    return targetPath;
  }
  const cleanPath = targetPath.startsWith('/') ? targetPath.slice(1) : targetPath;
  return path.resolve(SYSROOT_ROOT, cleanPath);
}

/**
 * Initializes required sysroot sandbox directories
 */
export function initSysroot() {
  const dirs = [
    'etc/nginx/sites-available',
    'etc/nginx/sites-enabled',
    'etc/php/5.6/fpm/pool.d',
    'etc/php/7.2/fpm/pool.d',
    'etc/php/8.1/fpm/pool.d',
    'etc/php/8.2/fpm/pool.d',
    'etc/php/8.3/fpm/pool.d',
    'etc/php/8.4/fpm/pool.d',
    'etc/php/8.5/fpm/pool.d',
    'etc/bind/zones',
    'etc/postfix',
    'etc/dovecot',
    'etc/systemd/system',
    'etc/cron.d',
    'var/lib/rspamd/dkim',
    'var/log',
    'home/acme/public_html',
    'home/acme/legacy-crm.org',
    'home/acme/mail',
    'run/panel'
  ];

  for (const rel of dirs) {
    const full = path.resolve(SYSROOT_ROOT, rel);
    fs.mkdirSync(full, { recursive: true });
  }

  // Ensure mock execution log exists
  const logFile = path.resolve(SYSROOT_ROOT, 'var/log/mock_executions.log');
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '', 'utf8');
  }
}

/**
 * Intercepts privileged system commands in sandbox mode and logs them
 */
export function logMockExecution(cmd, args = []) {
  initSysroot();
  const logFile = path.resolve(SYSROOT_ROOT, 'var/log/mock_executions.log');
  const entry = `[${new Date().toISOString()}] CMD: ${cmd} ARGS: ${JSON.stringify(args)}\n`;
  fs.appendFileSync(logFile, entry, 'utf8');
  return { success: true, mocked: true, cmd, args };
}

/**
 * Reads all entries from mock execution log
 */
export function readMockExecutions() {
  const logFile = path.resolve(SYSROOT_ROOT, 'var/log/mock_executions.log');
  if (!fs.existsSync(logFile)) return [];
  return fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
}

/**
 * Clears mock execution log
 */
export function clearMockExecutions() {
  const logFile = path.resolve(SYSROOT_ROOT, 'var/log/mock_executions.log');
  if (fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '', 'utf8');
  }
}

/**
 * Safely writes a file to sysroot, creating parent directories
 */
export function writeSysrootFile(targetPath, content, mode = 0o644) {
  initSysroot();
  const resolved = resolveSysroot(targetPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, { encoding: 'utf8', mode });
  return resolved;
}

/**
 * Reads a file from sysroot
 */
export function readSysrootFile(targetPath) {
  const resolved = resolveSysroot(targetPath);
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved, 'utf8');
}

/**
 * Checks if a file exists in sysroot
 */
export function existsSysrootFile(targetPath) {
  return fs.existsSync(resolveSysroot(targetPath));
}
