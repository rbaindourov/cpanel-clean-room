/**
 * models.ts
 * Clean-room entity models for cPanel parity appliance.
 */

// ---------------------------------------------------------------------------
// 1. Roles & Multi-Tenancy
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'reseller' | 'customer';

export interface PlanLimits {
  diskQuotaBytes: number;       // e.g. 10737418240 (10 GB)
  bandwidthLimitBytes: number;  // e.g. 107374182400 (100 GB)
  maxDomains: number;           // e.g. 10
  maxSubdomains: number;        // e.g. 50
  maxDatabases: number;         // e.g. 10
  maxMailboxes: number;         // e.g. 50
  maxFtpAccounts: number;       // e.g. 10
  cpuQuotaPercent: number;      // e.g. 200 = 200% (2 cores in cgroups v2)
  memoryMaxBytes: number;       // e.g. 2147483648 (2 GB)
  tasksMax: number;             // e.g. 150 (pids.max in cgroups v2)
}

export interface Account {
  id: string;                   // UUID v4
  username: string;             // Linux tenant user (e.g. 'vahag')
  email: string;
  role: UserRole;
  resellerId?: string;          // If owned by a reseller
  packageName: string;          // Hosting package name (e.g. 'Standard', 'Unlimited')
  planLimits: PlanLimits;
  uid?: number;                 // POSIX UID (e.g. 1005)
  gid?: number;                 // POSIX GID (e.g. 1005)
  homeDir: string;              // e.g. '/home/vahag'
  shell: string;                // e.g. '/bin/bash' or '/usr/bin/jailshell'
  suspended: boolean;
  suspendReason?: string;
  suspendedAt?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

// ---------------------------------------------------------------------------
// 2. Domains & Web Runtimes
// ---------------------------------------------------------------------------

export type DomainType = 'primary' | 'addon' | 'subdomain' | 'alias';

export type SslStatus = 'none' | 'pending' | 'active' | 'expired' | 'error';
export type SslProvider = 'letsencrypt' | 'zerossl' | 'custom' | 'self-signed';

export type PhpVersion =
  | '5.6'
  | '7.0'
  | '7.1'
  | '7.2'
  | '7.3'
  | '7.4'
  | '8.0'
  | '8.1'
  | '8.2'
  | '8.3'
  | '8.4'
  | '8.5';

export interface Domain {
  id: string;
  accountId: string;
  domainName: string;           // FQDN e.g. 'architecturalnumbers.com'
  type: DomainType;
  parentDomainId?: string;      // If subdomain or alias
  documentRoot: string;         // e.g. '/home/vahag/public_html'
  phpVersion: PhpVersion;       // e.g. '8.3'
  useApacheBackend: boolean;    // ADR-04: true if proxying to 127.0.0.1:8080
  sslStatus: SslStatus;
  sslProvider?: SslProvider;
  sslExpiresAt?: string;        // ISO 8601
  sslCertificatePath?: string;
  sslPrivateKeyPath?: string;
  forceHttps: boolean;          // Emit HTTP 301 to HTTPS
  ipAddress: string;            // Server IP e.g. '192.168.11.32'
  aliases: string[];            // Parked aliases e.g. ['www.architecturalnumbers.com']
  customNginxDirectives?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DomainRedirect {
  id: string;
  domainId: string;
  sourcePath: string;           // e.g. '/catalog.html'
  targetUrl: string;            // e.g. '/products/' or 'https://external.com'
  statusCode: 301 | 302;
  matchType: 'exact' | 'regex' | 'wildcard';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 3. DNS (RFC 1035 & BIND9)
// ---------------------------------------------------------------------------

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'MX'
  | 'TXT'
  | 'SRV'
  | 'CAA'
  | 'NS'
  | 'SOA'
  | 'PTR';

export interface DnsRecord {
  id: string;
  domainId: string;
  name: string;                 // Relative or absolute e.g. '@', 'www', 'mail', '_dmarc'
  type: DnsRecordType;
  value: string;                // Target IP, hostname, or quoted TXT string
  ttl: number;                  // Default: 300
  priority?: number;            // For MX, SRV
  weight?: number;              // For SRV
  port?: number;                // For SRV
  flags?: number;               // For CAA
  tag?: string;                 // For CAA ('issue', 'issuewild', 'iodef')
  createdAt?: string;
  updatedAt?: string;
}

export interface DnsZone {
  id: string;
  domainId: string;
  domainName: string;
  primaryNs: string;            // e.g. 'ns1.winwinhost.com.'
  adminEmail: string;           // e.g. 'hostmaster.winwinhost.com.'
  serial: number;               // YYYYMMDDNN e.g. 2026111201
  refresh: number;              // e.g. 10800 (3h)
  retry: number;                // e.g. 3600 (1h)
  expire: number;               // e.g. 604800 (7d)
  minimumTtl: number;           // e.g. 300 (5m)
  records: DnsRecord[];
  syncedCloudflare: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 4. Email Suite (Postfix, Dovecot, Rspamd)
// ---------------------------------------------------------------------------

export interface Mailbox {
  id: string;
  accountId: string;
  domainId: string;
  email: string;                // Full address e.g. 'sales@architecturalnumbers.com'
  localPart: string;            // e.g. 'sales'
  domain: string;               // e.g. 'architecturalnumbers.com'
  passwordHash: string;         // {ARGON2ID}$... or {SHA512-CRYPT}$...
  quotaBytes: number;           // e.g. 4194304000 (4 GB)
  usedBytes: number;            // e.g. 2469941036
  suspendedLogin: boolean;
  suspendedIncoming: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailForwarder {
  id: string;
  accountId: string;
  domainId: string;
  source: string;               // 'info@architecturalnumbers.com' or '@architecturalnumbers.com'
  destinations: string[];       // Target email addresses
  isCatchAll: boolean;
  createdAt: string;
}

export interface EmailAutoresponder {
  id: string;
  accountId: string;
  domainId: string;
  mailboxId?: string;
  email: string;
  subject: string;
  body: string;
  intervalHours: number;        // Rate limiting interval per sender
  startTime?: string;           // ISO 8601
  endTime?: string;             // ISO 8601
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailFilterCriteria {
  field: 'from' | 'to' | 'subject' | 'body' | 'header';
  headerName?: string;
  comparator: 'contains' | 'matches' | 'equals' | 'begins_with' | 'ends_with';
  value: string;
}

export interface EmailFilterAction {
  action: 'deliver' | 'redirect' | 'discard' | 'pipe';
  target?: string;
}

export interface EmailFilter {
  id: string;
  accountId: string;
  mailboxId?: string;           // undefined implies account-wide global filter
  name: string;
  criteria: EmailFilterCriteria[];
  actions: EmailFilterAction[];
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface DeliverabilityRecordStatus {
  status: 'valid' | 'invalid' | 'missing' | 'unknown';
  expectedRecord: string;
  actualRecord?: string;
  message?: string;
}

export interface EmailDeliverability {
  domain: string;
  spf: DeliverabilityRecordStatus;
  dkim: DeliverabilityRecordStatus & { selector: string };
  dmarc: DeliverabilityRecordStatus;
  mx: DeliverabilityRecordStatus & { records: string[] };
  reverseDns: DeliverabilityRecordStatus & { ip: string; ptr?: string };
}

// ---------------------------------------------------------------------------
// 5. Databases (MariaDB / MySQL)
// ---------------------------------------------------------------------------

export interface DatabaseUserGrant {
  username: string;             // <user>_<dbuser> e.g. 'vahag_k'
  remoteHost: string;           // 'localhost' or '192.168.1.100' or '%'
  privileges: string[];         // ['ALL PRIVILEGES'] or ['SELECT', 'INSERT', ...]
}

export interface Database {
  id: string;
  accountId: string;
  databaseName: string;         // <user>_<dbname> e.g. 'vahag_architecturalnumbers'
  charset: string;              // e.g. 'utf8mb4'
  collation: string;            // e.g. 'utf8mb4_unicode_ci'
  users: DatabaseUserGrant[];
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseUser {
  id: string;
  accountId: string;
  username: string;             // Full username e.g. 'vahag_k'
  remoteHost: string;           // 'localhost' or '%'
  databases: string[];          // Associated database names
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 6. File Management & FTP
// ---------------------------------------------------------------------------

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  mode: number;                 // e.g. 0o755, 0o644
  owner: string;
  group: string;
  mtime: string;                // ISO 8601
  mimeType?: string;
}

export interface FtpAccount {
  id: string;
  accountId: string;
  username: string;             // e.g. 'vahag_deploy'
  homedir: string;              // e.g. '/home/vahag/public_html'
  quotaBytes: number;           // 0 = unlimited
  usedBytes: number;
  suspended: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 7. Backups (cpmove & Restic)
// ---------------------------------------------------------------------------

export type BackupType = 'cpmove' | 'restic_snapshot' | 'mysql' | 'homedir';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type BackupDestination = 'local' | 's3' | 'b2' | 'sftp';

export interface Backup {
  id: string;
  accountId: string;
  type: BackupType;
  status: BackupStatus;
  fileName?: string;            // e.g. 'cpmove-vahag.tar.gz'
  filePath?: string;
  sizeBytes?: number;
  resticSnapshotId?: string;
  destination: BackupDestination;
  progressPercent?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// 8. Security & Automation (Cron, SSH, API Tokens)
// ---------------------------------------------------------------------------

export interface CronJob {
  id: string;
  accountId: string;
  minute: string;               // e.g. '0' or '*/15'
  hour: string;                 // e.g. '2' or '*'
  day: string;                  // e.g. '*'
  month: string;                // e.g. '*'
  weekday: string;              // e.g. '*'
  command: string;              // e.g. '/usr/bin/php8.3 /home/vahag/public_html/cron.php'
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SshKey {
  id: string;
  accountId: string;
  name: string;
  publicKey: string;
  fingerprint: string;          // e.g. 'SHA256:...'
  keyType: 'rsa' | 'ed25519' | 'ecdsa';
  authorized: boolean;          // Present in ~/.ssh/authorized_keys
  createdAt: string;
}

export interface ApiToken {
  id: string;
  accountId: string;
  name: string;
  tokenPrefix: string;          // First 8 characters for identification
  tokenHash: string;            // SHA-256 hash of the bearer token
  scopes: string[];             // Allowed RPC operations or '*'
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 9. Telemetry, System Health & Runtimes
// ---------------------------------------------------------------------------

export interface ServiceStatus {
  name: string;                 // 'nginx', 'bind9', 'postfix', 'dovecot', 'rspamd', 'mariadb'
  displayName: string;
  status: 'active' | 'inactive' | 'failed';
  port?: number;
  memoryBytes?: number;
  uptimeSeconds?: number;
}

export interface SystemStats {
  hostname: string;
  os: string;
  kernel: string;
  uptimeSeconds: number;
  loadAverage: [number, number, number];
  cpuCount: number;
  cpuModel: string;
  cpuUsagePercent: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskFreeBytes: number;
  services: ServiceStatus[];
}

export interface TenantResourceUsage {
  username: string;
  cpuUsagePercent: number;
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  ioReadBytes: number;
  ioWriteBytes: number;
  processCount: number;
  maxProcesses: number;
}

export interface WordPressSite {
  id: string;
  accountId: string;
  domainId: string;
  domainName: string;
  path: string;                 // e.g. '/home/vahag/public_html'
  url: string;                  // e.g. 'https://architecturalnumbers.com'
  version: string;              // e.g. '6.7.1'
  title: string;
  adminEmail: string;
  dbName: string;
  dbUser: string;
  autoUpdate: boolean;
  status: 'active' | 'updating' | 'error';
  pluginsCount: number;
  themesCount: number;
  createdAt: string;
}
