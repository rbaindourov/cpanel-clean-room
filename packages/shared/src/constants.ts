/**
 * constants.ts
 * Appliance system constants, default limits, network ports, and PHP runtime lists.
 */

import type { PlanLimits, PhpVersion } from './models.ts';

// ---------------------------------------------------------------------------
// 1. Network & Appliance Ports
// ---------------------------------------------------------------------------

export const APPLIANCE_PORTS = {
  // Web Management
  PANEL_DEFAULT_HTTPS: 8443,
  PANEL_HTTP_REDIRECT: 8080,
  PANEL_DEV: 3000,

  // cPanel Port Compatibility Aliases (ADR-03)
  CPANEL_HTTP: 2082,
  CPANEL_HTTPS: 2083,
  WHM_HTTP: 2086,
  WHM_HTTPS: 2087,
  WEBMAIL_HTTP: 2095,
  WEBMAIL_HTTPS: 2096,

  // Backend Proxies
  APACHE_BACKEND_PORT: 8080,
  APACHE_BACKEND_HOST: '127.0.0.1',

  // System Services
  DNS_PORT: 53,
  HTTP_PORT: 80,
  HTTPS_PORT: 443,
  MYSQL_PORT: 3306,

  // Mail Suite
  SMTP_PORT: 25,
  SMTPS_PORT: 465,
  SUBMISSION_PORT: 587,
  POP3_PORT: 110,
  POP3S_PORT: 995,
  IMAP_PORT: 143,
  IMAPS_PORT: 993,
  MANAGESIEVE_PORT: 4190,

  // Rspamd
  RSPAMD_PROXY_PORT: 11332,
  RSPAMD_NORMAL_PORT: 11333,
  RSPAMD_CONTROLLER_PORT: 11334,

  // FTP
  FTP_CONTROL_PORT: 21,
  FTP_PASV_MIN_PORT: 30000,
  FTP_PASV_MAX_PORT: 30500,
} as const;

// ---------------------------------------------------------------------------
// 2. Supported PHP Runtimes
// ---------------------------------------------------------------------------

export const SUPPORTED_PHP_VERSIONS: readonly PhpVersion[] = [
  '5.6',
  '7.0',
  '7.1',
  '7.2',
  '7.3',
  '7.4',
  '8.0',
  '8.1',
  '8.2',
  '8.3',
  '8.4',
  '8.5',
] as const;

export const DEFAULT_PHP_VERSION: PhpVersion = '8.3';

export const EOL_PHP_VERSIONS: readonly PhpVersion[] = [
  '5.6',
  '7.0',
  '7.1',
  '7.2',
  '7.3',
  '7.4',
  '8.0',
] as const;

// ---------------------------------------------------------------------------
// 3. Default Hosting Plan Limits
// ---------------------------------------------------------------------------

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  diskQuotaBytes: 10 * 1024 * 1024 * 1024,      // 10 GB
  bandwidthLimitBytes: 100 * 1024 * 1024 * 1024, // 100 GB
  maxDomains: 10,
  maxSubdomains: 50,
  maxDatabases: 10,
  maxMailboxes: 50,
  maxFtpAccounts: 10,
  cpuQuotaPercent: 200,                         // 200% = 2 cores
  memoryMaxBytes: 2 * 1024 * 1024 * 1024,       // 2 GB
  tasksMax: 150,                                // 150 tasks
};

export const UNLIMITED_PLAN_LIMITS: PlanLimits = {
  diskQuotaBytes: 0,                            // 0 = unlimited
  bandwidthLimitBytes: 0,
  maxDomains: 9999,
  maxSubdomains: 9999,
  maxDatabases: 9999,
  maxMailboxes: 9999,
  maxFtpAccounts: 9999,
  cpuQuotaPercent: 400,
  memoryMaxBytes: 8 * 1024 * 1024 * 1024,       // 8 GB
  tasksMax: 500,
};

// ---------------------------------------------------------------------------
// 4. Default System & Sysroot Paths
// ---------------------------------------------------------------------------

export const SYSTEM_PATHS = {
  // IPC Socket
  AGENT_SOCKET_DEFAULT: '/run/panel/agent.sock',
  AGENT_SOCKET_SANDBOX: './scratch/sysroot/run/panel/agent.sock',

  // Sysroots
  PRODUCTION_SYSROOT: '/',
  SANDBOX_SYSROOT: './scratch/sysroot',

  // Config Directories (Relative to Sysroot)
  NGINX_SITES_AVAILABLE: '/etc/nginx/sites-available',
  NGINX_SITES_ENABLED: '/etc/nginx/sites-enabled',
  PHP_FPM_POOL_BASE: '/etc/php',                // e.g. /etc/php/{ver}/fpm/pool.d
  BIND_ZONES_DIR: '/etc/bind/zones',
  BIND_NAMED_CONF_LOCAL: '/etc/bind/named.conf.local',
  POSTFIX_VIRTUAL: '/etc/postfix/virtual',
  DOVECOT_PASSWD: '/etc/dovecot/passwd',
  RSPAMD_DKIM_DIR: '/var/lib/rspamd/dkim',
  SYSTEMD_SYSTEM_DIR: '/etc/systemd/system',
  CRON_D_DIR: '/etc/cron.d',

  // User Home & Mail Templates
  USER_HOME_BASE: '/home',
  USER_PUBLIC_HTML: 'public_html',
  USER_MAIL_BASE: 'mail',
  USER_BACKUPS_BASE: 'backups',

  // Database
  SQLITE_DB_PRODUCTION: '/var/lib/panel/panel.db',
  SQLITE_DB_SANDBOX: './scratch/sysroot/var/lib/panel/panel.db',
} as const;

// ---------------------------------------------------------------------------
// 5. Default DNS Configurations
// ---------------------------------------------------------------------------

export const DEFAULT_DNS_SETTINGS = {
  DEFAULT_TTL: 300,
  DEFAULT_PRIMARY_NS: 'ns1.winwinhost.com.',
  DEFAULT_ADMIN_EMAIL: 'hostmaster.winwinhost.com.',
  DEFAULT_NAMESERVERS: ['ns1.winwinhost.com.', 'ns2.winwinhost.com.'],
  DEFAULT_SOA_REFRESH: 10800,                   // 3 hours
  DEFAULT_SOA_RETRY: 3600,                      // 1 hour
  DEFAULT_SOA_EXPIRE: 604800,                   // 7 days
  DEFAULT_SOA_MINIMUM: 300,                     // 5 minutes
} as const;
