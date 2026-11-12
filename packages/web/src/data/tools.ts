export interface ToolItem {
  code: string;
  name: string;
  description: string;
  category: 'files' | 'databases' | 'domains' | 'email' | 'metrics' | 'security' | 'software' | 'advanced' | 'preferences';
  path: string;
  iconName: string;
  keywords: string[];
}

export interface CategoryInfo {
  id: ToolItem['category'];
  title: string;
  description: string;
  iconName: string;
}

export const CPANEL_CATEGORIES: CategoryInfo[] = [
  { id: 'files', title: 'Files', description: 'Web root explorer, Monaco editor, disk usage & archives', iconName: 'Folder' },
  { id: 'databases', title: 'Databases', description: 'MySQL/MariaDB, user grants & phpMyAdmin SSO', iconName: 'Database' },
  { id: 'domains', title: 'Domains', description: 'Virtual hosts, BIND9 RFC 1035 zone editor & redirects', iconName: 'Globe' },
  { id: 'email', title: 'Email', description: 'Mailboxes, forwarders, autoresponders & DKIM deliverability', iconName: 'Mail' },
  { id: 'metrics', title: 'Metrics', description: 'Visitors, error logs, bandwidth & real-time GoAccess', iconName: 'Activity' },
  { id: 'security', title: 'Security', description: 'SSH keys, IP blocker, Let\'s Encrypt AutoSSL & API tokens', iconName: 'ShieldCheck' },
  { id: 'software', title: 'Software', description: 'Multi-PHP 5.6–8.5, WP-CLI toolkit & Node/Python apps', iconName: 'Cpu' },
  { id: 'advanced', title: 'Advanced', description: 'Embedded xterm.js shell, cron jobs & DNS diagnostics', iconName: 'Terminal' },
  { id: 'preferences', title: 'Preferences', description: '2FA TOTP setup, password rotation & impersonation', iconName: 'Settings' },
];

/**
 * Baseline 68 cPanel tools directly mapped to empirical HostGator cPanel manifest.
 * Exactly 68 tools spanning all 9 categories.
 */
export const ALL_68_TOOLS: ToolItem[] = [
  // 1. Files (FIL-01 to FIL-11) - 11 tools
  { code: 'FIL-01', name: 'File Manager', description: 'Full filesystem browser, Monaco code editor, zip/tar, chmod', category: 'files', path: '/files', iconName: 'Folder', keywords: ['file', 'directory', 'editor', 'monaco', 'upload', 'unzip', 'tar'] },
  { code: 'FIL-02', name: 'Images', description: 'Image thumbnailer, scaler, PNG/JPEG/WEBP converter', category: 'files', path: '/files?tab=images', iconName: 'Image', keywords: ['image', 'photo', 'resize', 'scale', 'convert'] },
  { code: 'FIL-03', name: 'Directory Privacy', description: 'Protect directories via HTTP Basic Auth (.htpasswd)', category: 'files', path: '/files?tab=privacy', iconName: 'Lock', keywords: ['password', 'protect', 'htpasswd', 'auth'] },
  { code: 'FIL-04', name: 'Disk Usage', description: 'Storage visualizer across directories, DBs, mail', category: 'files', path: '/files?tab=disk-usage', iconName: 'PieChart', keywords: ['disk', 'storage', 'quota', 'usage', 'space'] },
  { code: 'FIL-05', name: 'Web Disk', description: 'WebDAV endpoint provisioning for remote mounting', category: 'files', path: '/files?tab=webdisk', iconName: 'HardDrive', keywords: ['webdav', 'mount', 'remote'] },
  { code: 'FIL-06', name: 'FTP Accounts', description: 'Virtual FTP/SFTP accounts with directory chroot', category: 'files', path: '/files?tab=ftp', iconName: 'Server', keywords: ['ftp', 'sftp', 'chroot', 'upload'] },
  { code: 'FIL-07', name: 'FTP Connections', description: 'Active FTP/SFTP session monitor and kick', category: 'files', path: '/files?tab=ftp-conn', iconName: 'Radio', keywords: ['ftp', 'session', 'connection'] },
  { code: 'FIL-08', name: 'Anonymous FTP', description: 'Public anonymous FTP toggle', category: 'files', path: '/files?tab=anon-ftp', iconName: 'ShieldAlert', keywords: ['anonymous', 'public', 'ftp'] },
  { code: 'FIL-09', name: 'Backup', description: 'Full account cpmove tar.gz and partial SQL/homedir dumps', category: 'files', path: '/backup', iconName: 'Archive', keywords: ['backup', 'cpmove', 'export', 'tar.gz', 'dump'] },
  { code: 'FIL-10', name: 'Backup Wizard', description: '3-step wizard for backup generation and restoration', category: 'files', path: '/backup?wizard=1', iconName: 'Wand2', keywords: ['backup', 'wizard', 'restore', 'migrate'] },
  { code: 'FIL-11', name: 'Git Version Control', description: 'Bare git repository manager with deployment hooks', category: 'files', path: '/files?tab=git', iconName: 'GitBranch', keywords: ['git', 'repo', 'version', 'branch', 'deploy'] },

  // 2. Databases (DB-01 to DB-04) - 4 tools
  { code: 'DB-01', name: 'phpMyAdmin', description: '1-Click passwordless SSO bridge via SignonSession', category: 'databases', path: '/databases?action=pma', iconName: 'Database', keywords: ['pma', 'phpmyadmin', 'sql', 'gui', 'sso'] },
  { code: 'DB-02', name: 'MySQL Databases', description: 'Database creation, user management, grant assignment', category: 'databases', path: '/databases', iconName: 'Layers', keywords: ['mysql', 'mariadb', 'db', 'tables', 'schema'] },
  { code: 'DB-03', name: 'MySQL Database Wizard', description: 'Guided 4-step wizard (DB -> User -> Grants -> Summary)', category: 'databases', path: '/databases?wizard=1', iconName: 'Wand', keywords: ['wizard', 'create', 'setup', 'mysql'] },
  { code: 'DB-04', name: 'Remote MySQL', description: 'External client IP whitelist for port 3306 MySQL access', category: 'databases', path: '/databases?tab=remote', iconName: 'Network', keywords: ['remote', 'ip', 'whitelist', '3306', 'dbeaver'] },

  // 3. Domains (DOM-01 to DOM-04) - 4 tools
  { code: 'DOM-01', name: 'Domains Manager', description: 'Apex, addon, subdomain, and docroot management', category: 'domains', path: '/domains', iconName: 'Globe', keywords: ['domain', 'vhost', 'docroot', 'web'] },
  { code: 'DOM-02', name: 'Redirects', description: 'HTTP 301/302 domain and URL path redirection in Nginx', category: 'domains', path: '/domains?tab=redirects', iconName: 'CornerUpRight', keywords: ['redirect', '301', '302', 'rewrite'] },
  { code: 'DOM-03', name: 'Zone Editor', description: 'RFC 1035 BIND9 DNS zone editor + Cloudflare sync', category: 'domains', path: '/domains?tab=dns', iconName: 'Compass', keywords: ['dns', 'bind', 'zone', 'a', 'cname', 'mx', 'txt', 'cloudflare'] },
  { code: 'DOM-04', name: 'Dynamic DNS', description: 'DDNS webhook allowing remote devices to update A records', category: 'domains', path: '/domains?tab=ddns', iconName: 'RefreshCw', keywords: ['ddns', 'dynamic', 'ip', 'webhook'] },

  // 4. Email (EML-01 to EML-16) - 16 tools
  { code: 'EML-01', name: 'Email Accounts', description: 'IMAP/POP3/SMTP mailbox CRUD, storage quotas, Dovecot', category: 'email', path: '/email', iconName: 'Mail', keywords: ['mailbox', 'email', 'dovecot', 'imap', 'pop3', 'quota'] },
  { code: 'EML-02', name: 'Forwarders', description: 'Postfix alias forwarding rules (/etc/postfix/virtual)', category: 'email', path: '/email?tab=forwarders', iconName: 'Forward', keywords: ['forwarder', 'alias', 'redirect', 'postfix'] },
  { code: 'EML-03', name: 'Email Routing', description: 'Local, Backup, or Remote Mail Exchanger (Google/M365)', category: 'email', path: '/email?tab=routing', iconName: 'Milestone', keywords: ['mx', 'routing', 'google', 'm365', 'remote'] },
  { code: 'EML-04', name: 'Autoresponders', description: 'Vacation replies with Sieve script rate-limiting', category: 'email', path: '/email?tab=autoresponders', iconName: 'Clock', keywords: ['vacation', 'autoresponder', 'sieve', 'reply'] },
  { code: 'EML-05', name: 'Default Address', description: 'Domain catch-all mailbox or bounce handler (:fail:)', category: 'email', path: '/email?tab=catchall', iconName: 'Inbox', keywords: ['catchall', 'default', 'bounce', 'fail'] },
  { code: 'EML-06', name: 'Mailing Lists', description: 'Newsletter and group discussion list management', category: 'email', path: '/email?tab=lists', iconName: 'Users', keywords: ['mailman', 'newsletter', 'list'] },
  { code: 'EML-07', name: 'Track Delivery', description: 'Mail delivery trace searching Postfix/Rspamd logs', category: 'email', path: '/email?tab=track', iconName: 'SearchCheck', keywords: ['trace', 'log', 'delivery', 'bounce', 'status'] },
  { code: 'EML-08', name: 'Global Email Filters', description: 'Account-wide Sieve rules evaluated for incoming mail', category: 'email', path: '/email?tab=global-filters', iconName: 'Filter', keywords: ['sieve', 'global', 'rule', 'spam'] },
  { code: 'EML-09', name: 'User Email Filters', description: 'Per-mailbox Sieve rules for folder filing/discard', category: 'email', path: '/email?tab=user-filters', iconName: 'SlidersHorizontal', keywords: ['mailbox', 'filter', 'folder', 'organize'] },
  { code: 'EML-10', name: 'Email Deliverability', description: 'SPF, DKIM (RSA/Ed25519), DMARC validation & key installer', category: 'email', path: '/email?tab=deliverability', iconName: 'CheckCircle2', keywords: ['spf', 'dkim', 'dmarc', 'deliverability', 'rspamd', 'keys'] },
  { code: 'EML-11', name: 'Address Importer', description: 'Batch CSV/Excel import for mailboxes and forwarders', category: 'email', path: '/email?tab=importer', iconName: 'FileSpreadsheet', keywords: ['csv', 'import', 'batch', 'users'] },
  { code: 'EML-12', name: 'Spam Filters', description: 'Rspamd scoring threshold, auto-delete, whitelist/blacklist', category: 'email', path: '/email?tab=spam', iconName: 'ShieldAlert', keywords: ['spam', 'rspamd', 'score', 'threshold'] },
  { code: 'EML-13', name: 'Email Encryption', description: 'GnuPG / PGP public and private key management', category: 'email', path: '/email?tab=gpg', iconName: 'KeyRound', keywords: ['gpg', 'pgp', 'crypto', 'encrypt'] },
  { code: 'EML-14', name: 'BoxTrapper', description: 'Challenge-response verification toggle', category: 'email', path: '/email?tab=boxtrapper', iconName: 'HelpCircle', keywords: ['boxtrapper', 'challenge', 'verify'] },
  { code: 'EML-15', name: 'Calendars & Contacts', description: 'CalDAV / CardDAV synchronization endpoint details', category: 'email', path: '/email?tab=caldav', iconName: 'Calendar', keywords: ['caldav', 'carddav', 'contacts', 'calendar'] },
  { code: 'EML-16', name: 'Email Disk Usage', description: 'Per-folder mail disk breakdown with expunge action', category: 'email', path: '/email?tab=disk', iconName: 'HardDrive', keywords: ['mail', 'disk', 'expunge', 'clean'] },

  // 5. Metrics (MET-01 to MET-09) - 9 tools
  { code: 'MET-01', name: 'Visitors', description: 'Last 1,000 HTTP requests log inspector', category: 'metrics', path: '/metrics?tab=visitors', iconName: 'Eye', keywords: ['visitor', 'access', 'traffic', 'http'] },
  { code: 'MET-02', name: 'Errors Log', description: 'Live tail and viewer of web server and PHP error logs', category: 'metrics', path: '/metrics?tab=errors', iconName: 'AlertOctagon', keywords: ['error', 'log', 'tail', 'php', 'nginx'] },
  { code: 'MET-03', name: 'Bandwidth', description: 'Transfer accounting per domain (HTTP, FTP, Mail)', category: 'metrics', path: '/metrics?tab=bandwidth', iconName: 'BarChart3', keywords: ['bandwidth', 'transfer', 'gigabytes', 'quota'] },
  { code: 'MET-04', name: 'Raw Access Logs', description: 'Download compressed historical web access logs (.log.gz)', category: 'metrics', path: '/metrics?tab=raw-logs', iconName: 'FileArchive', keywords: ['logs', 'download', 'gz', 'access'] },
  { code: 'MET-05', name: 'Awstats / GoAccess', description: 'High-performance real-time GoAccess web analytics', category: 'metrics', path: '/metrics?tab=goaccess', iconName: 'TrendingUp', keywords: ['goaccess', 'awstats', 'analytics', 'charts'] },
  { code: 'MET-06', name: 'Webalizer', description: 'Legacy traffic stats view / placeholder', category: 'metrics', path: '/metrics?tab=webalizer', iconName: 'PieChart', keywords: ['webalizer', 'legacy'] },
  { code: 'MET-07', name: 'Analog Stats', description: 'Legacy text-based stats view / placeholder', category: 'metrics', path: '/metrics?tab=analog', iconName: 'FileText', keywords: ['analog', 'legacy'] },
  { code: 'MET-08', name: 'Metrics Editor', description: 'Enable/disable stats generators per domain', category: 'metrics', path: '/metrics?tab=config', iconName: 'ToggleLeft', keywords: ['config', 'stats', 'engine'] },
  { code: 'MET-09', name: 'Resource Usage', description: 'CPU, Memory, I/O cgroup limits & historical telemetry', category: 'metrics', path: '/metrics?tab=resources', iconName: 'Cpu', keywords: ['cpu', 'memory', 'cgroup', 'limits', 'throttle'] },

  // 6. Security (SEC-01 to SEC-05) - 5 tools
  { code: 'SEC-01', name: 'SSH Access', description: 'SSH public/private key generation, authorization, import', category: 'security', path: '/security?tab=ssh', iconName: 'Key', keywords: ['ssh', 'keys', 'authorized_keys', 'terminal'] },
  { code: 'SEC-02', name: 'IP Blocker', description: 'Deny visitor IP addresses / subnets via Nginx deny rules', category: 'security', path: '/security?tab=ip-blocker', iconName: 'ShieldAlert', keywords: ['ip', 'ban', 'block', 'deny', 'firewall'] },
  { code: 'SEC-03', name: 'SSL/TLS Status & AutoSSL', description: 'Let\'s Encrypt ACME automated issuance & SAN viewer', category: 'security', path: '/security?tab=ssl', iconName: 'ShieldCheck', keywords: ['ssl', 'tls', 'https', 'autossl', 'letsencrypt', 'cert'] },
  { code: 'SEC-04', name: 'Manage API Tokens', description: 'Scoped API token generation with expiration', category: 'security', path: '/security?tab=tokens', iconName: 'Fingerprint', keywords: ['api', 'token', 'bearer', 'auth'] },
  { code: 'SEC-05', name: 'Hotlink Protection', description: 'Prevent direct image/asset linking via Nginx referrers', category: 'security', path: '/security?tab=hotlink', iconName: 'Link2Off', keywords: ['hotlink', 'bandwidth', 'referrer'] },

  // 7. Software (SOF-01 to SOF-08) - 8 tools
  { code: 'SOF-01', name: 'MultiPHP Manager', description: 'Per-domain PHP version switcher (5.6, 7.x, 8.1–8.5)', category: 'software', path: '/software?tab=php', iconName: 'FileCode2', keywords: ['php', 'fpm', 'version', 'switch', '8.3', '7.4'] },
  { code: 'SOF-02', name: 'MultiPHP INI Editor', description: 'Per-pool php_admin_value directive editor', category: 'software', path: '/software?tab=ini', iconName: 'Settings2', keywords: ['ini', 'php.ini', 'memory_limit', 'max_execution_time'] },
  { code: 'SOF-03', name: 'WP-CLI WordPress Toolkit', description: 'Install, clone, staging, auto-update, wp-admin SSO', category: 'software', path: '/software?tab=wordpress', iconName: 'Boxes', keywords: ['wordpress', 'wp-cli', 'wp', 'clone', 'staging', 'plugins'] },
  { code: 'SOF-04', name: 'Node.js App Manager', description: 'Systemd user service runner with Nginx reverse proxy', category: 'software', path: '/software?tab=nodejs', iconName: 'FileJson', keywords: ['nodejs', 'node', 'express', 'systemd', 'npm'] },
  { code: 'SOF-05', name: 'Python App Manager', description: 'WSGI/Gunicorn systemd runner behind Nginx', category: 'software', path: '/software?tab=python', iconName: 'TerminalSquare', keywords: ['python', 'gunicorn', 'wsgi', 'django', 'flask'] },
  { code: 'SOF-06', name: 'Composer / Packages', description: 'PHP Composer package dependency viewer', category: 'software', path: '/software?tab=composer', iconName: 'Package', keywords: ['composer', 'packages', 'vendor'] },
  { code: 'SOF-07', name: 'Perl Modules', description: 'Perl module list and CPAN viewer', category: 'software', path: '/software?tab=perl', iconName: 'Code', keywords: ['perl', 'cpan', 'modules'] },
  { code: 'SOF-08', name: 'Ruby on Rails', description: 'Passenger / systemd Ruby app runner', category: 'software', path: '/software?tab=ruby', iconName: 'Gem', keywords: ['ruby', 'rails', 'passenger'] },

  // 8. Advanced (ADV-01 to ADV-06) - 6 tools
  { code: 'ADV-01', name: 'Terminal', description: 'Embedded @xterm/xterm + node-pty WebSocket shell', category: 'advanced', path: '/terminal', iconName: 'Terminal', keywords: ['terminal', 'bash', 'shell', 'cli', 'pty', 'ssh'] },
  { code: 'ADV-02', name: 'Cron Jobs', description: 'System cron manager with cPanel PHP CLI path mapping', category: 'advanced', path: '/advanced?tab=cron', iconName: 'Clock8', keywords: ['cron', 'schedule', 'crontab', 'job'] },
  { code: 'ADV-03', name: 'Track DNS', description: 'DNS lookup, dig, and reverse PTR diagnostic utility', category: 'advanced', path: '/advanced?tab=dns-lookup', iconName: 'Network', keywords: ['dig', 'dns', 'lookup', 'ptr', 'resolve'] },
  { code: 'ADV-04', name: 'Indexes', description: 'Directory browsing toggle (autoindex on/off)', category: 'advanced', path: '/advanced?tab=indexes', iconName: 'ListOrdered', keywords: ['index', 'autoindex', 'directory'] },
  { code: 'ADV-05', name: 'Error Pages', description: 'Custom HTTP 400, 401, 403, 404, 500 HTML error pages', category: 'advanced', path: '/advanced?tab=error-pages', iconName: 'FileWarning', keywords: ['404', '500', 'error', 'page', 'custom'] },
  { code: 'ADV-06', name: 'MIME Types', description: 'Custom MIME type handler mapping', category: 'advanced', path: '/advanced?tab=mime', iconName: 'Tag', keywords: ['mime', 'content-type', 'extension'] },

  // 9. Preferences (PRE-01 to PRE-05) - 5 tools
  { code: 'PRE-01', name: 'User Manager', description: 'Unified user, FTP, and mail sub-account manager', category: 'preferences', path: '/preferences?tab=subusers', iconName: 'Users', keywords: ['subusers', 'accounts', 'permissions'] },
  { code: 'PRE-02', name: 'Password & Security', description: 'Password rotation, Argon2id hashing, and session logout', category: 'preferences', path: '/preferences?tab=password', iconName: 'Key', keywords: ['password', 'security', 'argon2id', 'credentials'] },
  { code: 'PRE-03', name: 'Two-Factor Auth (2FA)', description: 'RFC 6238 TOTP authenticator setup and verification', category: 'preferences', path: '/preferences?tab=2fa', iconName: 'ShieldCheck', keywords: ['2fa', 'totp', 'authenticator', 'google', 'qr'] },
  { code: 'PRE-04', name: '1-Click Impersonation', description: 'Admin/Reseller support impersonation into any tenant', category: 'preferences', path: '/admin/accounts', iconName: 'UserCheck', keywords: ['impersonate', 'whm', 'support', 'tenant'] },
  { code: 'PRE-05', name: 'Contact Information', description: 'Notification email and quota alert thresholds', category: 'preferences', path: '/preferences?tab=contact', iconName: 'Bell', keywords: ['contact', 'email', 'notifications', 'alerts'] },
];

/**
 * Extended features from the clean-room specification (Addons, Subdomains, Aliases, Sitejet, Postgres, etc.)
 */
export const EXTENDED_TOOLS: ToolItem[] = [
  { code: 'DOM-05', name: 'Addon Domains', description: 'Secondary domain mapping to subdirectories', category: 'domains', path: '/domains?tab=addon', iconName: 'PlusCircle', keywords: ['addon', 'secondary', 'multi-site'] },
  { code: 'DOM-06', name: 'Subdomains', description: 'Subdomain creation (*.domain.com) with isolated docroot', category: 'domains', path: '/domains?tab=subdomains', iconName: 'FolderTree', keywords: ['subdomain', 'docroot', 'dev'] },
  { code: 'DOM-07', name: 'Parked Domains (Aliases)', description: 'Domain aliases sharing primary document root', category: 'domains', path: '/domains?tab=aliases', iconName: 'Copy', keywords: ['parked', 'alias', 'cname'] },
  { code: 'DOM-08', name: 'Site Publisher', description: 'Static website placeholder builder', category: 'domains', path: '/domains?tab=publisher', iconName: 'Layout', keywords: ['publisher', 'landing', 'coming-soon'] },
  { code: 'DOM-09', name: 'Sitejet Builder', description: 'Visual drag-and-drop website builder integration', category: 'domains', path: '/domains?tab=sitejet', iconName: 'PanelsTopLeft', keywords: ['sitejet', 'builder', 'cms'] },
  { code: 'DB-05', name: 'PostgreSQL Databases', description: 'PostgreSQL database and role provisioning', category: 'databases', path: '/databases?tab=postgres', iconName: 'Boxes', keywords: ['postgres', 'psql', 'postgresql'] },
  { code: 'DB-06', name: 'phpPgAdmin', description: 'Web interface for PostgreSQL administration with SSO', category: 'databases', path: '/databases?action=phppgadmin', iconName: 'ExternalLink', keywords: ['phppgadmin', 'postgres', 'gui'] },
  { code: 'SEC-06', name: 'Leech Protection', description: 'Limit concurrent downloads and redirect abusers', category: 'security', path: '/security?tab=leech', iconName: 'Shield', keywords: ['leech', 'concurrency', 'limit'] },
  { code: 'SEC-07', name: 'ModSecurity / Coraza', description: 'WAF rule engine toggle and anomaly thresholds', category: 'security', path: '/security?tab=waf', iconName: 'ShieldAlert', keywords: ['waf', 'modsecurity', 'coraza', 'owasp'] },
];

export const ALL_TOOLS: ToolItem[] = [...ALL_68_TOOLS, ...EXTENDED_TOOLS];
