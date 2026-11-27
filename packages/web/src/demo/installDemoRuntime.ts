/**
 * packages/web/src/demo/installDemoRuntime.ts
 * Interactive in-browser Linux Appliance Sandbox for CleanPanel (`VITE_DEMO_MODE=true`).
 *
 * Allows visitors on portfolio showcases (e.g. https://robertscreations.com/cleanpanel/)
 * or static GitHub Pages deployments to interactively explore all 77 hosting tools,
 * 3-tier RBAC + 1-click user impersonation, Native File Manager + Monaco Editor,
 * @xterm/xterm interactive shell, RFC 1035 BIND9 Zone Editor, MultiPHP (5.6-8.5) &
 * WP-CLI Toolkit, Postfix/Dovecot/Rspamd Deliverability, MariaDB Grants, and 1-click
 * cpmove / restic migrations — 100% client-side with zero backend privilege exposure.
 */

import type { AccountRecord, UserEntity } from '../types/api.ts';
import type { FileEntry } from '../types/files.ts';

interface VirtualFile extends FileEntry {
  content?: string;
}

const DEMO_USERS: Record<string, UserEntity> = {
  admin: {
    id: 'usr_admin_01',
    username: 'admin',
    email: 'ops@example-panel.org',
    role: 'admin',
    status: 'active',
    quotaBytes: 107374182400,
    uid: 1000,
    gid: 1000,
    homeDir: '/home/admin',
  },
  reseller_west: {
    id: 'usr_reseller_01',
    username: 'reseller_west',
    email: 'noc@agency-cloud.net',
    role: 'reseller',
    status: 'active',
    quotaBytes: 53687091200,
    uid: 1001,
    gid: 1001,
    homeDir: '/home/reseller_west',
  },
  acme: {
    id: 'usr_acme_01',
    username: 'acme',
    email: 'devops@example-store.com',
    role: 'customer',
    resellerId: 'usr_reseller_01',
    status: 'active',
    quotaBytes: 10737418240,
    uid: 1042,
    gid: 1042,
    homeDir: '/home/acme',
  },
  studio_dev: {
    id: 'usr_studio_02',
    username: 'studio_dev',
    email: 'hello@studio-letters.com',
    role: 'customer',
    resellerId: 'usr_reseller_01',
    status: 'active',
    quotaBytes: 10737418240,
    uid: 1043,
    gid: 1043,
    homeDir: '/home/studio_dev',
  },
};

function createInitialAccounts(): AccountRecord[] {
  return [
    {
      id: 'usr_admin_01',
      username: 'admin',
      email: 'ops@example-panel.org',
      role: 'admin',
      reseller_id: null,
      quota_bytes: 107374182400,
      bandwidth_limit_bytes: 1099511627776,
      plan_name: 'Appliance Root',
      status: 'active',
      created_at: '2026-10-01T08:00:00Z',
    },
    {
      id: 'usr_reseller_01',
      username: 'reseller_west',
      email: 'noc@agency-cloud.net',
      role: 'reseller',
      reseller_id: null,
      quota_bytes: 53687091200,
      bandwidth_limit_bytes: 549755813888,
      plan_name: 'Agency Reseller Pro',
      status: 'active',
      created_at: '2026-10-04T11:30:00Z',
    },
    {
      id: 'usr_acme_01',
      username: 'acme',
      email: 'devops@example-store.com',
      role: 'customer',
      reseller_id: 'usr_reseller_01',
      quota_bytes: 10737418240,
      bandwidth_limit_bytes: 107374182400,
      plan_name: 'NVMe Business 10G',
      status: 'active',
      created_at: '2026-10-12T15:20:00Z',
    },
    {
      id: 'usr_studio_02',
      username: 'studio_dev',
      email: 'hello@studio-letters.com',
      role: 'customer',
      reseller_id: 'usr_reseller_01',
      quota_bytes: 10737418240,
      bandwidth_limit_bytes: 107374182400,
      plan_name: 'NVMe Creator 10G',
      status: 'active',
      created_at: '2026-10-18T19:45:00Z',
    },
  ];
}

function createInitialFiles(): VirtualFile[] {
  const now = '2026-11-26T16:30:00Z';
  return [
    {
      name: 'public_html',
      path: 'public_html',
      isDir: true,
      isSymlink: false,
      sizeBytes: 4096,
      mode: 0o755,
      owner: 'acme',
      group: 'acme',
      mtime: now,
    },
    {
      name: 'etc',
      path: 'etc',
      isDir: true,
      isSymlink: false,
      sizeBytes: 4096,
      mode: 0o750,
      owner: 'acme',
      group: 'acme',
      mtime: now,
    },
    {
      name: 'logs',
      path: 'logs',
      isDir: true,
      isSymlink: false,
      sizeBytes: 4096,
      mode: 0o750,
      owner: 'acme',
      group: 'acme',
      mtime: now,
    },
    {
      name: 'backups',
      path: 'backups',
      isDir: true,
      isSymlink: false,
      sizeBytes: 4096,
      mode: 0o700,
      owner: 'acme',
      group: 'acme',
      mtime: now,
    },
    {
      name: '.bashrc',
      path: '.bashrc',
      isDir: false,
      isSymlink: false,
      sizeBytes: 412,
      mode: 0o644,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `# ~/.bashrc — CleanPanel isolated tenant shell (uid=1042)\nexport PATH="/usr/local/bin:/usr/bin:/bin"\nexport HISTCONTROL=ignoreboth\nalias ll='ls -alF --color=auto'\nalias wp='/usr/local/bin/wp --path=/home/acme/public_html'\n`,
    },
    {
      name: 'README-CLEANPANEL.md',
      path: 'README-CLEANPANEL.md',
      isDir: false,
      isSymlink: false,
      sizeBytes: 768,
      mode: 0o644,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `# CleanPanel Tenant Sandbox (/home/acme)\n\nWelcome to the interactive CleanPanel File Manager + Monaco Editor!\n\nTry the following right here in your browser:\n1. Double-click \`public_html\` and select \`index.php\` or \`.htaccess\`.\n2. Click **Edit in Monaco** in the top toolbar to edit with full syntax highlighting and Ctrl+S / Save.\n3. Select any file and click **Permissions** to test the live octal/symbolic \`chmod\` calculator.\n4. Switch to **Terminal** in the left sidebar to run interactive commands (\`help\`, \`ls -la\`, \`panel-agentd --status\`, \`wp plugin list\`).\n`,
    },
    {
      name: 'index.php',
      path: 'public_html/index.php',
      isDir: false,
      isSymlink: false,
      sizeBytes: 942,
      mode: 0o644,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `<?php\ndeclare(strict_types=1);\n\n/**\n * example-store.com — Isolated PHP-FPM 8.3 Pool (/run/php/php8.3-fpm-acme.sock)\n * Managed by CleanPanel panel-agentd (zero shell interpolation)\n */\n\n$diagnostics = [\n    'tenant' => get_current_user(),\n    'php_version' => PHP_VERSION,\n    'sapi' => PHP_SAPI,\n    'opcache_enabled' => function_exists('opcache_get_status'),\n    'https_enforced' => ($_SERVER['HTTPS'] ?? 'on') === 'on',\n];\n\nheader('Content-Type: application/json; charset=utf-8');\necho json_encode(['status' => 'ok', 'diagnostics' => $diagnostics], JSON_PRETTY_PRINT);\n`,
    },
    {
      name: '.htaccess',
      path: 'public_html/.htaccess',
      isDir: false,
      isSymlink: false,
      sizeBytes: 518,
      mode: 0o644,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `# CleanPanel Deterministic .htaccess -> Nginx Compiler Input\n# Unsupported directives automatically switch vhost to Apache fallback port\n\nRewriteEngine On\nRewriteCond %{HTTPS} !=on\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.php [L]\n\nHeader set X-Frame-Options "SAMEORIGIN"\nHeader set X-Content-Type-Options "nosniff"\n`,
    },
    {
      name: 'wp-config.php',
      path: 'public_html/wp-config.php',
      isDir: false,
      isSymlink: false,
      sizeBytes: 648,
      mode: 0o600,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `<?php\n/** CleanPanel WP-CLI Provisioned Configuration (chmod 0600) */\ndefine('DB_NAME', 'acme_store');\ndefine('DB_USER', 'acme_wp');\ndefine('DB_PASSWORD', 'demo-vault-rotated-secret');\ndefine('DB_HOST', 'localhost');\ndefine('DB_CHARSET', 'utf8mb4');\ndefine('DISALLOW_FILE_EDIT', true);\ndefine('WP_AUTO_UPDATE_CORE', 'minor');\n\n$table_prefix = 'wp_';\nrequire_once ABSPATH . 'wp-settings.php';\n`,
    },
    {
      name: 'nginx-compiled.conf',
      path: 'etc/nginx-compiled.conf',
      isDir: false,
      isSymlink: false,
      sizeBytes: 580,
      mode: 0o640,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `# Auto-generated by @cpanel-clean-room/agentd htaccessCompiler.ts\nserver {\n    listen 443 ssl http2;\n    server_name example-store.com www.example-store.com;\n    root /home/acme/public_html;\n\n    add_header X-Frame-Options "SAMEORIGIN" always;\n    add_header X-Content-Type-Options "nosniff" always;\n\n    location / {\n        try_files $uri $uri/ /index.php?$args;\n    }\n\n    location ~ \\.php$ {\n        fastcgi_pass unix:/run/php/php8.3-fpm-acme.sock;\n        include fastcgi_params;\n    }\n}\n`,
    },
    {
      name: 'access.log',
      path: 'logs/access.log',
      isDir: false,
      isSymlink: false,
      sizeBytes: 430,
      mode: 0o640,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: `203.0.113.45 - - [26/Nov/2026:16:28:11 +0000] "GET / HTTP/2.0" 200 1842 "-" "Mozilla/5.0"\n203.0.113.88 - - [26/Nov/2026:16:29:04 +0000] "GET /products/nvme-appliance HTTP/2.0" 200 6412 "-" "Mozilla/5.0"\n198.51.100.19 - - [26/Nov/2026:16:29:52 +0000] "POST /wp-json/wc/v3/orders HTTP/2.0" 201 934 "-" "CleanPanelHealthProbe/1.0"\n`,
    },
    {
      name: 'cpmove-acme-20261126.tar.gz',
      path: 'backups/cpmove-acme-20261126.tar.gz',
      isDir: false,
      isSymlink: false,
      sizeBytes: 48234496,
      mode: 0o600,
      owner: 'acme',
      group: 'acme',
      mtime: now,
      content: 'BINARY_ARCHIVE_PLACEHOLDER',
    },
  ];
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * Lightweight EventTarget-compatible WebSocket simulator for @xterm/xterm in Demo Mode.
 */
class DemoTerminalWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readyState = DemoTerminalWebSocket.CONNECTING;
  public url: string;
  public onopen: ((ev: any) => void) | null = null;
  public onmessage: ((ev: { data: string }) => void) | null = null;
  public onclose: ((ev: any) => void) | null = null;
  public onerror: ((ev: any) => void) | null = null;

  private buffer = '';
  private cwd = '/home/acme';
  private history: string[] = [
    'panel-agentd --status',
    'wp plugin list',
    'named-checkzone example-store.com /etc/bind/zones/db.example-store.com',
    'ls -la public_html',
  ];
  private historyIdx = -1;
  private getFiles: () => VirtualFile[];
  private getEffectiveUsername: () => string;

  constructor(url: string, getFiles: () => VirtualFile[], getEffectiveUsername: () => string) {
    this.url = url;
    this.getFiles = getFiles;
    this.getEffectiveUsername = getEffectiveUsername;

    setTimeout(() => {
      if (this.readyState !== DemoTerminalWebSocket.CONNECTING) return;
      this.readyState = DemoTerminalWebSocket.OPEN;
      this.onopen?.({});
      this.emit(
        '\x1b[90mInteractive Browser Demo Shell — Type \x1b[1;33mhelp\x1b[0m\x1b[90m for available CleanPanel appliance commands.\x1b[0m\r\n'
      );
      this.prompt();
    }, 80);
  }

  private emit(data: string) {
    if (this.readyState === DemoTerminalWebSocket.OPEN) {
      this.onmessage?.({ data });
    }
  }

  private prompt() {
    const user = this.getEffectiveUsername();
    const homePrefix = `/home/${user}`;
    const displayDir = this.cwd.startsWith(homePrefix)
      ? '~' + this.cwd.slice(homePrefix.length)
      : this.cwd;
    this.emit(`\x1b[1;32m${user}@cleanpanel\x1b[0m:\x1b[1;34m${displayDir}\x1b[0m$ `);
  }

  public send(raw: string) {
    if (this.readyState !== DemoTerminalWebSocket.OPEN) return;
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'resize' || parsed.type === 'ping') return;
      } catch {
        // Not control JSON
      }
    }

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '\x1b') {
        const seq = raw.slice(i, i + 3);
        if (seq === '\x1b[A') {
          // Up arrow
          if (this.history.length > 0) {
            this.historyIdx =
              this.historyIdx < 0 ? this.history.length - 1 : Math.max(0, this.historyIdx - 1);
            this.replaceLine(this.history[this.historyIdx]);
          }
          i += 2;
          continue;
        }
        if (seq === '\x1b[B') {
          // Down arrow
          if (this.historyIdx >= 0) {
            this.historyIdx++;
            if (this.historyIdx >= this.history.length) {
              this.historyIdx = -1;
              this.replaceLine('');
            } else {
              this.replaceLine(this.history[this.historyIdx]);
            }
          }
          i += 2;
          continue;
        }
        continue;
      }

      if (ch === '\r' || ch === '\n') {
        this.emit('\r\n');
        const cmd = this.buffer.trim();
        this.buffer = '';
        this.historyIdx = -1;
        if (cmd) {
          this.history.push(cmd);
          this.executeCommand(cmd);
        }
        if (this.readyState === DemoTerminalWebSocket.OPEN) {
          this.prompt();
        }
      } else if (ch === '\x7f' || ch === '\b') {
        if (this.buffer.length > 0) {
          this.buffer = this.buffer.slice(0, -1);
          this.emit('\b \b');
        }
      } else if (ch === '\x03') {
        // Ctrl+C
        this.buffer = '';
        this.emit('^C\r\n');
        this.prompt();
      } else if (ch === '\x0c') {
        // Ctrl+L
        this.emit('\x1b[2J\x1b[H');
        this.prompt();
        this.emit(this.buffer);
      } else if (ch >= ' ') {
        this.buffer += ch;
        this.emit(ch);
      }
    }
  }

  private replaceLine(next: string) {
    while (this.buffer.length > 0) {
      this.buffer = this.buffer.slice(0, -1);
      this.emit('\b \b');
    }
    this.buffer = next;
    this.emit(next);
  }

  private executeCommand(line: string) {
    const parts = line.split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1] || '';
    const user = this.getEffectiveUsername();

    switch (cmd) {
      case 'help':
        this.emit(
          [
            '\x1b[1;36mCleanPanel Interactive Demo Commands:\x1b[0m',
            '  \x1b[1;33mpanel-agentd --status\x1b[0m   Inspect least-privilege NDJSON Unix-socket root daemon',
            '  \x1b[1;33mls [-la] [dir]\x1b[0m          List isolated tenant filesystem entries',
            '  \x1b[1;33mcat <file>\x1b[0m              Print file contents (synced live with Monaco Editor!)',
            '  \x1b[1;33mphp -v\x1b[0m                  Show active per-domain PHP-FPM runtime',
            '  \x1b[1;33mwp plugin list\x1b[0m          Query WordPress Toolkit via WP-CLI',
            '  \x1b[1;33mnamed-checkzone\x1b[0m         Validate RFC 1035 BIND9 zone serial & records',
            '  \x1b[1;33mrestic snapshots\x1b[0m        List deduplicated encrypted tenant backups',
            '  \x1b[1;33mwhoami / id / uname -a / df -h / free -m / clear\x1b[0m',
          ].join('\r\n') + '\r\n'
        );
        break;
      case 'clear':
        this.emit('\x1b[2J\x1b[H');
        break;
      case 'whoami':
        this.emit(`${user}\r\n`);
        break;
      case 'id':
        this.emit(
          user === 'admin'
            ? 'uid=1000(admin) gid=1000(admin) groups=1000(admin),994(panel-sock)\r\n'
            : `uid=1042(${user}) gid=1042(${user}) groups=1042(${user})\r\n`
        );
        break;
      case 'pwd':
        this.emit(`${this.cwd}\r\n`);
        break;
      case 'uname':
        this.emit(
          'Linux cleanpanel.example-panel.org 6.8.0-51-generic #52-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\n'
        );
        break;
      case 'cd': {
        if (!arg || arg === '~') {
          this.cwd = `/home/${user}`;
        } else if (arg === '..') {
          const segs = this.cwd.split('/').filter(Boolean);
          if (segs.length > 2) segs.pop();
          this.cwd = '/' + segs.join('/');
        } else {
          const clean = arg.replace(/^\/+|\/+$/g, '');
          const exists = this.getFiles().some((f) => f.isDir && f.path === clean);
          if (exists) {
            this.cwd = `/home/${user}/${clean}`;
          } else {
            this.emit(`bash: cd: ${arg}: No such directory\r\n`);
          }
        }
        break;
      }
      case 'ls': {
        const targetArg = parts.find((p) => !p.startsWith('-') && p !== 'ls') || '';
        const relDir =
          targetArg.replace(/^\/+|\/+$/g, '') ||
          this.cwd.replace(new RegExp(`^/home/${user}/?`), '');
        const items = this.getFiles().filter((f) => {
          const idx = f.path.lastIndexOf('/');
          const parent = idx === -1 ? '' : f.path.slice(0, idx);
          return parent === relDir;
        });
        if (parts.some((p) => p.includes('l'))) {
          for (const it of items) {
            const perm = (it.isDir ? 'd' : '-') + it.mode.toString(8).padStart(3, '0');
            const color = it.isDir ? '\x1b[1;34m' : '\x1b[0m';
            this.emit(
              `${perm} 1 ${it.owner.padEnd(6)} ${it.group.padEnd(6)} ${String(it.sizeBytes).padStart(8)} Nov 26 16:30 ${color}${it.name}\x1b[0m\r\n`
            );
          }
        } else {
          this.emit(
            items
              .map((it) => (it.isDir ? `\x1b[1;34m${it.name}/\x1b[0m` : it.name))
              .join('  ') + '\r\n'
          );
        }
        break;
      }
      case 'cat': {
        if (!arg) {
          this.emit('usage: cat <filepath>\r\n');
          break;
        }
        const relPrefix = this.cwd.replace(new RegExp(`^/home/${user}/?`), '');
        const lookup = arg.startsWith('/')
          ? arg.replace(new RegExp(`^/home/${user}/?`), '')
          : relPrefix
            ? `${relPrefix}/${arg}`
            : arg;
        const found = this.getFiles().find((f) => !f.isDir && f.path === lookup);
        if (!found) {
          this.emit(`cat: ${arg}: No such file\r\n`);
        } else {
          this.emit((found.content || '').replace(/\r?\n/g, '\r\n') + '\r\n');
        }
        break;
      }
      case 'php':
        this.emit(
          'PHP 8.3.14 (cli) (built: Nov 20 2026 14:12:09) (NTS)\r\nCopyright (c) The PHP Group\r\nZend Engine v4.3.14, with Zend OPcache v8.3.14\r\n'
        );
        break;
      case 'wp':
        this.emit(
          [
            '+-----------------------+----------+--------+---------+',
            '| name                  | status   | update | version |',
            '+-----------------------+----------+--------+---------+',
            '| redis-cache           | active   | none   | 2.5.4   |',
            '| woocommerce           | active   | none   | 9.4.2   |',
            '| wordfence             | active   | none   | 8.0.1   |',
            '+-----------------------+----------+--------+---------+',
          ].join('\r\n') + '\r\n'
        );
        break;
      case 'panel-agentd':
        this.emit(
          [
            '\x1b[1;32m● panel-agentd.service\x1b[0m - CleanPanel Least-Privilege Root Mutation Daemon',
            '     Loaded: loaded (/etc/systemd/system/panel-agentd.service; enabled)',
            '     Active: \x1b[1;32mactive (running)\x1b[0m — Socket: /run/panel-agentd.sock (0660 root:panel)',
            '   Security: Zero shell interpolation (execFile argv arrays) | Zod RPC Schemas: 39 active',
            '    Sysroot: PANEL_SYSROOT=/ (Production Linux Mode) | Audit Log: SQLite WAL verified',
          ].join('\r\n') + '\r\n'
        );
        break;
      case 'named-checkzone':
        this.emit(
          'zone example-store.com/IN: loaded serial 2026112604 (DNSSEC +CAA +SPF +DKIM +DMARC verified)\r\nOK\r\n'
        );
        break;
      case 'restic':
        this.emit(
          [
            'ID        Time                 Host        Tags        Paths',
            '-------------------------------------------------------------------------',
            'a94f21c0  2026-11-26 04:00:02  cleanpanel  daily,auto  /home/acme',
            '7bc180e4  2026-11-25 04:00:01  cleanpanel  daily,auto  /home/acme',
            '31d90ef2  2026-11-24 18:15:44  cleanpanel  pre-deploy  /home/acme',
          ].join('\r\n') + '\r\n'
        );
        break;
      case 'df':
        this.emit(
          [
            'Filesystem      Size  Used Avail Use% Mounted on',
            '/dev/nvme0n1p2  480G   62G  394G  14% /',
            'quota:/home/acme 10G  2.4G  7.6G  24% /home/acme',
          ].join('\r\n') + '\r\n'
        );
        break;
      case 'free':
        this.emit(
          [
            '               total        used        free      shared  buff/cache   available',
            'Mem:           16384        1890       10420          84        4074       14120',
            'Rspamd+Clam:      62 MB resident (vs 1,240 MB SpamAssassin+Amavis baseline)',
          ].join('\r\n') + '\r\n'
        );
        break;
      default:
        this.emit(
          `bash: ${cmd}: command not simulated in browser sandbox (type 'help' for supported demo commands)\r\n`
        );
    }
  }

  public close() {
    this.readyState = DemoTerminalWebSocket.CLOSED;
    this.onclose?.({ code: 1000 });
  }
}

export function installDemoRuntime(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__CLEANPANEL_DEMO_INSTALLED__) return;
  (window as any).__CLEANPANEL_DEMO_INSTALLED__ = true;

  // Auto-seed initial demo session token so visitors land straight on the dashboard
  if (!localStorage.getItem('panel_access_token') && !sessionStorage.getItem('panel_demo_logged_out')) {
    localStorage.setItem('panel_access_token', 'demo-jwt-root-admin');
    localStorage.setItem('panel_token', 'demo-jwt-root-admin');
  }

  let loggedInUsername = localStorage.getItem('panel_demo_username') || 'admin';
  let accounts = createInitialAccounts();
  let files = createInitialFiles();

  let domains = [
    {
      id: 'dom_01',
      user_id: 'usr_acme_01',
      domain_name: 'example-store.com',
      type: 'primary' as const,
      docroot: '/home/acme/public_html',
      php_version: '8.3',
      ssl_enabled: 1,
      ssl_status: 'active' as const,
      force_https: 1,
      use_apache_backend: 0,
    },
    {
      id: 'dom_02',
      user_id: 'usr_acme_01',
      domain_name: 'legacy-crm.org',
      type: 'addon' as const,
      docroot: '/home/acme/legacy-crm.org',
      php_version: '7.4',
      ssl_enabled: 1,
      ssl_status: 'active' as const,
      force_https: 1,
      use_apache_backend: 1,
    },
    {
      id: 'dom_03',
      user_id: 'usr_acme_01',
      domain_name: 'staging.example-store.com',
      type: 'subdomain' as const,
      docroot: '/home/acme/staging',
      php_version: '8.4',
      ssl_enabled: 1,
      ssl_status: 'active' as const,
      force_https: 1,
      use_apache_backend: 0,
    },
  ];

  const zones: Record<string, any[]> = {
    dom_01: [
      { id: 'rec_1', name: '@', type: 'A', value: '203.0.113.10', ttl: 300 },
      { id: 'rec_2', name: 'www', type: 'CNAME', value: 'example-store.com.', ttl: 300 },
      { id: 'rec_3', name: '@', type: 'MX', value: 'mail.example-store.com.', ttl: 3600, priority: 10 },
      { id: 'rec_4', name: 'mail', type: 'A', value: '203.0.113.10', ttl: 3600 },
      { id: 'rec_5', name: '@', type: 'TXT', value: '"v=spf1 ip4:203.0.113.10 ~all"', ttl: 3600 },
      {
        id: 'rec_6',
        name: 'default._domainkey',
        type: 'TXT',
        value: '"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."',
        ttl: 3600,
      },
      { id: 'rec_7', name: '_dmarc', type: 'TXT', value: '"v=DMARC1; p=quarantine; rua=mailto:postmaster@example-store.com"', ttl: 3600 },
    ],
    dom_02: [
      { id: 'rec_21', name: '@', type: 'A', value: '203.0.113.10', ttl: 300 },
      { id: 'rec_22', name: '@', type: 'MX', value: 'mail.legacy-crm.org.', ttl: 3600, priority: 10 },
    ],
    dom_03: [{ id: 'rec_31', name: 'staging', type: 'A', value: '203.0.113.10', ttl: 300 }],
  };

  const redirects: Record<string, any[]> = {
    dom_01: [
      {
        id: 'red_1',
        source_path: '/old-catalog',
        target_url: 'https://example-store.com/shop',
        status_code: 301,
        match_type: 'exact',
      },
    ],
    dom_02: [],
    dom_03: [],
  };

  let wpSites = [
    {
      id: 'wp_01',
      domain: 'example-store.com',
      path: '/home/acme/public_html',
      version: '6.7.1',
      autoUpdate: true,
      status: 'healthy',
    },
    {
      id: 'wp_02',
      domain: 'staging.example-store.com',
      path: '/home/acme/staging',
      version: '6.7.1',
      autoUpdate: false,
      status: 'staging',
    },
  ];

  const phpDirectives: Record<string, any> = {
    'example-store.com': {
      memory_limit: '512M',
      upload_max_filesize: '256M',
      post_max_size: '256M',
      max_execution_time: '120',
      max_input_time: '60',
      display_errors: 'Off',
    },
  };

  let databases = [
    {
      id: 'db_01',
      db_name: 'acme_store',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      size_bytes: 48653926,
    },
    {
      id: 'db_02',
      db_name: 'acme_crm',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      size_bytes: 19421088,
    },
  ];

  let dbUsers = [
    { id: 'dbu_01', db_user: 'acme_wp', remote_host: 'localhost' },
    { id: 'dbu_02', db_user: 'acme_readonly', remote_host: '10.0.0.%' },
  ];

  let dbGrants = [
    { id: 'gr_01', db_name: 'acme_store', db_user: 'acme_wp', privileges: 'ALL PRIVILEGES' },
    { id: 'gr_02', db_name: 'acme_crm', db_user: 'acme_readonly', privileges: 'SELECT, SHOW VIEW' },
  ];

  let remoteIps = [
    { id: 'rip_01', ip_or_cidr: '198.51.100.24/32', comment: 'Analytics BI Worker' },
  ];

  let mailboxes = [
    {
      id: 'mb_01',
      email: 'devops@example-store.com',
      local_part: 'devops',
      domain_name: 'example-store.com',
      quota_bytes: 2147483648,
      used_bytes: 348127232,
      suspended_login: 0,
      suspended_incoming: 0,
    },
    {
      id: 'mb_02',
      email: 'support@example-store.com',
      local_part: 'support',
      domain_name: 'example-store.com',
      quota_bytes: 5368709120,
      used_bytes: 1184890880,
      suspended_login: 0,
      suspended_incoming: 0,
    },
  ];

  let forwarders = [
    {
      id: 'fwd_01',
      source_address: 'sales@example-store.com',
      destination_address: 'support@example-store.com',
      is_catch_all: 0,
    },
  ];

  let autoresponders = [
    {
      id: 'ar_01',
      email: 'support@example-store.com',
      local_part: 'support',
      subject: 'Ticket Received — Example Store Support',
      body: 'We have logged your support request and an engineer will respond within 2 business hours.',
      interval_hours: 24,
      enabled: 1,
    },
  ];

  let snapshots = [
    {
      id: 'a94f21c0',
      time: '2026-11-26T04:00:02Z',
      paths: ['/home/acme', '/var/lib/mysql/acme_store'],
      hostname: 'cleanpanel.example-panel.org',
      tags: ['daily', 'automated'],
    },
    {
      id: '7bc180e4',
      time: '2026-11-25T04:00:01Z',
      paths: ['/home/acme', '/var/lib/mysql/acme_store'],
      hostname: 'cleanpanel.example-panel.org',
      tags: ['daily', 'automated'],
    },
    {
      id: '31d90ef2',
      time: '2026-11-24T18:15:44Z',
      paths: ['/home/acme'],
      hostname: 'cleanpanel.example-panel.org',
      tags: ['pre-release'],
    },
  ];

  const getEffectiveUsername = (headers?: Headers): string => {
    const imp =
      headers?.get('X-Impersonate-User') || localStorage.getItem('panel_impersonate_user') || '';
    if (imp && DEMO_USERS[imp]) return imp;
    return loggedInUsername;
  };

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsed = new URL(rawUrl, window.location.origin);
    if (!parsed.pathname.startsWith('/api/v1/')) {
      return nativeFetch(input, init);
    }

    const method = (init?.method || 'GET').toUpperCase();
    const headers = new Headers(init?.headers || {});
    const subPath = parsed.pathname.slice('/api/v1'.length);
    let body: any = {};
    if (typeof init?.body === 'string' && init.body.trim()) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = {};
      }
    }

    // 1. Auth & Impersonation
    if (subPath === '/auth/login' && method === 'POST') {
      const requested = String(body.username || 'admin').trim();
      loggedInUsername = DEMO_USERS[requested] ? requested : 'admin';
      localStorage.setItem('panel_demo_username', loggedInUsername);
      sessionStorage.removeItem('panel_demo_logged_out');
      const user = DEMO_USERS[loggedInUsername];
      return jsonResponse({
        success: true,
        accessToken: `demo-jwt-${loggedInUsername}`,
        refreshToken: `demo-refresh-${loggedInUsername}`,
        user,
        effectiveUser: user,
        isImpersonating: false,
      });
    }

    if (subPath === '/auth/logout' && method === 'POST') {
      sessionStorage.setItem('panel_demo_logged_out', '1');
      return jsonResponse({ success: true });
    }

    if (subPath === '/auth/me') {
      const baseUser = DEMO_USERS[loggedInUsername] || DEMO_USERS.admin;
      const impName = headers.get('X-Impersonate-User') || localStorage.getItem('panel_impersonate_user');
      if (impName && DEMO_USERS[impName] && impName !== baseUser.username) {
        return jsonResponse({
          success: true,
          user: baseUser,
          effectiveUser: DEMO_USERS[impName],
          isImpersonating: true,
          impersonator: baseUser,
        });
      }
      return jsonResponse({
        success: true,
        user: baseUser,
        effectiveUser: baseUser,
        isImpersonating: false,
        impersonator: null,
      });
    }

    if (subPath === '/preferences/impersonate/exit' || subPath === '/preferences/impersonate') {
      return jsonResponse({ success: true });
    }

    // 2. Admin Accounts & Telemetry
    if (subPath === '/admin/accounts' && method === 'GET') {
      return jsonResponse({ success: true, accounts });
    }
    if (subPath === '/admin/accounts' && method === 'POST') {
      const uname = String(body.username || `tenant_${accounts.length + 1}`).toLowerCase();
      const created: AccountRecord = {
        id: `usr_${Date.now()}`,
        username: uname,
        email: body.email || `admin@${uname}.org`,
        role: body.role || 'customer',
        reseller_id: 'usr_reseller_01',
        quota_bytes: Number(body.quotaBytes) || 10737418240,
        bandwidth_limit_bytes: 107374182400,
        plan_name: body.planName || 'NVMe Business 10G',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      accounts = [...accounts, created];
      DEMO_USERS[uname] = {
        id: created.id,
        username: uname,
        email: created.email,
        role: created.role,
        status: 'active',
        quotaBytes: created.quota_bytes,
        uid: 1050 + accounts.length,
        gid: 1050 + accounts.length,
        homeDir: `/home/${uname}`,
      };
      return jsonResponse({ success: true, account: created });
    }
    const suspendMatch = subPath.match(/^\/admin\/accounts\/([^/]+)\/(suspend|resume)$/);
    if (suspendMatch && method === 'POST') {
      const [, uname, action] = suspendMatch;
      accounts = accounts.map((a) =>
        a.username === uname ? { ...a, status: action === 'suspend' ? 'suspended' : 'active' } : a
      );
      return jsonResponse({ success: true });
    }
    const deleteAccMatch = subPath.match(/^\/admin\/accounts\/([^/]+)$/);
    if (deleteAccMatch && method === 'DELETE') {
      accounts = accounts.filter((a) => a.username !== deleteAccMatch[1]);
      return jsonResponse({ success: true });
    }

    if (subPath === '/metrics/resources' || subPath === '/admin/telemetry') {
      return jsonResponse({
        success: true,
        cpu: { loadAvg: [0.14, 0.19, 0.16] },
        loadAverage: [0.14, 0.19, 0.16],
        memoryUsedBytes: 257698037,
        memory: {
          totalBytes: 17179869184,
          usedBytes: 1981808640,
          freeBytes: 15198060544,
          usagePercent: 11.5,
        },
        disk: {
          totalBytes: 10737418240,
          usedBytes: 2576980377,
          freeBytes: 8160437863,
          usagePercent: 24,
        },
        uptimeSeconds: 1284920,
      });
    }

    // 3. File Manager & Monaco Editor
    if (subPath === '/files/list' && method === 'GET') {
      const reqPath = (parsed.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
      const entries = files.filter((f) => {
        const slash = f.path.lastIndexOf('/');
        const parent = slash === -1 ? '' : f.path.slice(0, slash);
        return parent === reqPath;
      });
      return jsonResponse({ success: true, entries });
    }

    if (subPath === '/files/content' && method === 'GET') {
      const reqPath = (parsed.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
      const encoding = parsed.searchParams.get('encoding') || 'utf-8';
      const file = files.find((f) => f.path === reqPath);
      if (!file) return jsonResponse({ success: false, error: { message: 'File not found' } }, 404);
      const raw = file.content || '';
      const content = encoding === 'base64' ? btoa(unescape(encodeURIComponent(raw))) : raw;
      return jsonResponse({ success: true, content, encoding });
    }

    if (subPath === '/files/content' && method === 'PUT') {
      const targetPath = String(body.path || '').replace(/^\/+|\/+$/g, '');
      const text = String(body.content ?? '');
      const existing = files.find((f) => f.path === targetPath);
      if (existing) {
        existing.content = text;
        existing.sizeBytes = new Blob([text]).size;
        existing.mtime = new Date().toISOString();
      } else {
        const name = targetPath.split('/').pop() || 'untitled.txt';
        files.push({
          name,
          path: targetPath,
          isDir: false,
          isSymlink: false,
          sizeBytes: new Blob([text]).size,
          mode: 0o644,
          owner: getEffectiveUsername(headers),
          group: getEffectiveUsername(headers),
          mtime: new Date().toISOString(),
          content: text,
        });
      }
      return jsonResponse({ success: true });
    }

    if (subPath === '/files/mkdir' && method === 'POST') {
      const targetPath = String(body.path || '').replace(/^\/+|\/+$/g, '');
      const name = targetPath.split('/').pop() || 'new-folder';
      files.push({
        name,
        path: targetPath,
        isDir: true,
        isSymlink: false,
        sizeBytes: 4096,
        mode: Number(body.mode) || 0o755,
        owner: getEffectiveUsername(headers),
        group: getEffectiveUsername(headers),
        mtime: new Date().toISOString(),
      });
      return jsonResponse({ success: true });
    }

    if (subPath === '/files/rename' && method === 'POST') {
      const src = String(body.path || '').replace(/^\/+|\/+$/g, '');
      const dst = String(body.targetPath || '').replace(/^\/+|\/+$/g, '');
      const dstName = dst.split('/').pop() || dst;
      files = files.map((f) => {
        if (f.path === src) return { ...f, path: dst, name: dstName };
        if (f.path.startsWith(`${src}/`)) {
          return { ...f, path: dst + f.path.slice(src.length) };
        }
        return f;
      });
      return jsonResponse({ success: true });
    }

    if (subPath === '/files/chmod' && method === 'PATCH') {
      const targetPath = String(body.path || '').replace(/^\/+|\/+$/g, '');
      const mode = Number(body.mode) || 0o644;
      files = files.map((f) => (f.path === targetPath ? { ...f, mode } : f));
      return jsonResponse({ success: true });
    }

    if ((subPath === '/files/' || subPath === '/files') && method === 'DELETE') {
      const targetPath = String(body.path || '').replace(/^\/+|\/+$/g, '');
      files = files.filter((f) => f.path !== targetPath && !f.path.startsWith(`${targetPath}/`));
      return jsonResponse({ success: true });
    }

    if (subPath === '/files/archive' && method === 'POST') {
      const dst = String(body.targetPath || 'archive.tar.gz').replace(/^\/+|\/+$/g, '');
      files.push({
        name: dst.split('/').pop() || 'archive.tar.gz',
        path: dst,
        isDir: false,
        isSymlink: false,
        sizeBytes: 18432,
        mode: 0o644,
        owner: getEffectiveUsername(headers),
        group: getEffectiveUsername(headers),
        mtime: new Date().toISOString(),
        content: 'ARCHIVE_DATA',
      });
      return jsonResponse({ success: true });
    }

    if (subPath === '/files/extract' || subPath === '/files/upload') {
      if (subPath === '/files/upload') {
        const targetPath = String(body.path || 'uploaded.txt').replace(/^\/+|\/+$/g, '');
        files.push({
          name: targetPath.split('/').pop() || 'uploaded.txt',
          path: targetPath,
          isDir: false,
          isSymlink: false,
          sizeBytes: 2048,
          mode: 0o644,
          owner: getEffectiveUsername(headers),
          group: getEffectiveUsername(headers),
          mtime: new Date().toISOString(),
          content: '# Uploaded in browser sandbox\n',
        });
      }
      return jsonResponse({ success: true });
    }

    // 4. Domains, BIND9 Zone Editor & Redirects
    if (subPath === '/domains' && method === 'GET') {
      return jsonResponse({ success: true, domains });
    }
    const domPatch = subPath.match(/^\/domains\/([^/]+)$/);
    if (domPatch && method === 'PATCH') {
      domains = domains.map((d) =>
        d.id === domPatch[1] ? { ...d, force_https: body.forceHttps ? 1 : 0 } : d
      );
      return jsonResponse({ success: true });
    }
    const zoneGet = subPath.match(/^\/domains\/([^/]+)\/zone$/);
    if (zoneGet && method === 'GET') {
      return jsonResponse({ success: true, records: zones[zoneGet[1]] || [] });
    }
    const zoneAdd = subPath.match(/^\/domains\/([^/]+)\/zone\/records$/);
    if (zoneAdd && method === 'POST') {
      const list = zones[zoneAdd[1]] || [];
      const rec = {
        id: `rec_${Date.now()}`,
        name: body.name || '@',
        type: body.type || 'A',
        value: body.value || '203.0.113.10',
        ttl: Number(body.ttl) || 300,
        priority: body.priority,
      };
      zones[zoneAdd[1]] = [...list, rec];
      return jsonResponse({ success: true, record: rec });
    }
    const zoneDel = subPath.match(/^\/domains\/([^/]+)\/zone\/records\/([^/]+)$/);
    if (zoneDel && method === 'DELETE') {
      zones[zoneDel[1]] = (zones[zoneDel[1]] || []).filter((r) => r.id !== zoneDel[2]);
      return jsonResponse({ success: true });
    }
    if (subPath.endsWith('/sync-cloudflare') || subPath === '/security/ssl/autossl') {
      return jsonResponse({
        success: true,
        message: 'Provisioned & synchronized cleanly via panel-agentd.',
      });
    }
    const redirGet = subPath.match(/^\/domains\/([^/]+)\/redirects$/);
    if (redirGet && method === 'GET') {
      return jsonResponse({ success: true, redirects: redirects[redirGet[1]] || [] });
    }
    if (redirGet && method === 'POST') {
      const list = redirects[redirGet[1]] || [];
      const item = {
        id: `red_${Date.now()}`,
        source_path: body.sourcePath || '/legacy',
        target_url: body.targetUrl || 'https://example-store.com/',
        status_code: Number(body.statusCode) || 301,
        match_type: body.matchType || 'exact',
      };
      redirects[redirGet[1]] = [...list, item];
      return jsonResponse({ success: true, redirect: item });
    }
    const redirDel = subPath.match(/^\/domains\/([^/]+)\/redirects\/([^/]+)$/);
    if (redirDel && method === 'DELETE') {
      redirects[redirDel[1]] = (redirects[redirDel[1]] || []).filter((r) => r.id !== redirDel[2]);
      return jsonResponse({ success: true });
    }

    // 5. MultiPHP & WordPress Toolkit
    if (subPath === '/software/php/domains' && method === 'GET') {
      return jsonResponse({
        success: true,
        domainPools: domains.map((d) => ({
          domain: d.domain_name,
          phpVersion: d.php_version,
          socketPath: `/run/php/php${d.php_version}-fpm-acme.sock`,
        })),
      });
    }
    const phpSwitch = subPath.match(/^\/software\/php\/domains\/(.+)$/);
    if (phpSwitch && method === 'PUT') {
      const domName = decodeURIComponent(phpSwitch[1]);
      domains = domains.map((d) =>
        d.domain_name === domName ? { ...d, php_version: String(body.phpVersion || '8.3') } : d
      );
      return jsonResponse({ success: true });
    }
    const phpIni = subPath.match(/^\/software\/php\/ini\/(.+)$/);
    if (phpIni && method === 'GET') {
      const domName = decodeURIComponent(phpIni[1]);
      return jsonResponse({
        success: true,
        directives: phpDirectives[domName] || phpDirectives['example-store.com'],
      });
    }
    if (phpIni && method === 'PUT') {
      const domName = decodeURIComponent(phpIni[1]);
      phpDirectives[domName] = body.directives;
      return jsonResponse({ success: true });
    }
    if (subPath === '/software/wordpress' && method === 'GET') {
      return jsonResponse({ success: true, installations: wpSites });
    }
    if (subPath === '/software/wordpress/install' && method === 'POST') {
      const created = {
        id: `wp_${Date.now()}`,
        domain: body.domain || 'blog.example-store.com',
        path: body.path || '/home/acme/blog',
        version: '6.7.1',
        autoUpdate: true,
        status: 'healthy',
      };
      wpSites = [...wpSites, created];
      return jsonResponse({ success: true, installation: created });
    }
    if (subPath === '/software/wordpress/clone' && method === 'POST') {
      const cloned = {
        id: `wp_${Date.now()}`,
        domain: 'clone.example-store.com',
        path: body.targetPath || '/home/acme/clone',
        version: '6.7.1',
        autoUpdate: false,
        status: 'staging',
      };
      wpSites = [...wpSites, cloned];
      return jsonResponse({ success: true, installation: cloned });
    }
    const wpAuto = subPath.match(/^\/software\/wordpress\/([^/]+)\/autoupdate$/);
    if (wpAuto && method === 'PUT') {
      wpSites = wpSites.map((s) =>
        s.id === wpAuto[1] ? { ...s, autoUpdate: Boolean(body.autoUpdate) } : s
      );
      return jsonResponse({ success: true });
    }
    if (subPath.endsWith('/sso') && method === 'POST') {
      return jsonResponse({
        success: true,
        loginUrl: 'https://github.com/rbaindourov/cpanel-clean-room',
        redirectUrl: 'https://github.com/rbaindourov/cpanel-clean-room',
      });
    }

    // 6. Databases (MariaDB)
    if (subPath === '/databases/mysql' && method === 'GET') {
      return jsonResponse({ success: true, databases, users: dbUsers, grants: dbGrants });
    }
    if (subPath === '/databases/mysql/remote-ips' && method === 'GET') {
      return jsonResponse({ success: true, remoteIps });
    }
    if (subPath === '/databases/mysql/databases' && method === 'POST') {
      const suffix = String(body.databaseName || 'app').replace(/^acme_/, '');
      databases = [
        ...databases,
        {
          id: `db_${Date.now()}`,
          db_name: `acme_${suffix}`,
          charset: 'utf8mb4',
          collation: 'utf8mb4_unicode_ci',
          size_bytes: 16384,
        },
      ];
      return jsonResponse({ success: true });
    }
    const dbDel = subPath.match(/^\/databases\/mysql\/databases\/(.+)$/);
    if (dbDel && method === 'DELETE') {
      const name = decodeURIComponent(dbDel[1]);
      databases = databases.filter((d) => d.db_name !== name);
      return jsonResponse({ success: true });
    }
    if (subPath === '/databases/mysql/users' && method === 'POST') {
      const suffix = String(body.dbUserSuffix || 'user').replace(/^acme_/, '');
      dbUsers = [
        ...dbUsers,
        { id: `dbu_${Date.now()}`, db_user: `acme_${suffix}`, remote_host: 'localhost' },
      ];
      return jsonResponse({ success: true });
    }
    const dbUserDel = subPath.match(/^\/databases\/mysql\/users\/(.+)$/);
    if (dbUserDel && method === 'DELETE') {
      const name = decodeURIComponent(dbUserDel[1]);
      dbUsers = dbUsers.filter((u) => u.db_user !== name);
      return jsonResponse({ success: true });
    }
    if (subPath === '/databases/mysql/grants' && method === 'POST') {
      dbGrants = [
        ...dbGrants,
        {
          id: `gr_${Date.now()}`,
          db_name: body.databaseName || 'acme_store',
          db_user: body.dbUser || 'acme_wp',
          privileges: Array.isArray(body.privileges)
            ? body.privileges.join(', ')
            : String(body.privileges || 'ALL PRIVILEGES'),
        },
      ];
      return jsonResponse({ success: true });
    }
    if (subPath === '/databases/mysql/remote-ips' && method === 'POST') {
      remoteIps = [
        ...remoteIps,
        {
          id: `rip_${Date.now()}`,
          ip_or_cidr: body.ipOrCidr || '203.0.113.99/32',
          comment: body.comment || 'Demo remote host',
        },
      ];
      return jsonResponse({ success: true });
    }
    const ripDel = subPath.match(/^\/databases\/mysql\/remote-ips\/(.+)$/);
    if (ripDel && method === 'DELETE') {
      remoteIps = remoteIps.filter((r) => r.id !== ripDel[1]);
      return jsonResponse({ success: true });
    }

    // 7. Email Suite & Deliverability
    if (subPath === '/email/mailboxes' && method === 'GET') {
      return jsonResponse({ success: true, mailboxes });
    }
    if (subPath === '/email/mailboxes' && method === 'POST') {
      const dom = body.domain || 'example-store.com';
      const local = body.localPart || 'hello';
      mailboxes = [
        ...mailboxes,
        {
          id: `mb_${Date.now()}`,
          email: `${local}@${dom}`,
          local_part: local,
          domain_name: dom,
          quota_bytes: (Number(body.quotaMb) || 1024) * 1048576,
          used_bytes: 0,
          suspended_login: 0,
          suspended_incoming: 0,
        },
      ];
      return jsonResponse({ success: true });
    }
    const mbPatch = subPath.match(/^\/email\/mailboxes\/([^/]+)$/);
    if (mbPatch && method === 'PATCH') {
      mailboxes = mailboxes.map((m) =>
        m.id === mbPatch[1] && body.quotaBytes ? { ...m, quota_bytes: Number(body.quotaBytes) } : m
      );
      return jsonResponse({ success: true });
    }
    if (mbPatch && method === 'DELETE') {
      mailboxes = mailboxes.filter((m) => m.id !== mbPatch[1]);
      return jsonResponse({ success: true });
    }
    if (subPath === '/email/forwarders' && method === 'GET') {
      return jsonResponse({ success: true, forwarders });
    }
    if (subPath === '/email/forwarders' && method === 'POST') {
      forwarders = [
        ...forwarders,
        {
          id: `fwd_${Date.now()}`,
          source_address: `${body.source || 'info'}@${body.domain || 'example-store.com'}`,
          destination_address: body.destination || 'support@example-store.com',
          is_catch_all: 0,
        },
      ];
      return jsonResponse({ success: true });
    }
    const fwdDel = subPath.match(/^\/email\/forwarders\/([^/]+)$/);
    if (fwdDel && method === 'DELETE') {
      forwarders = forwarders.filter((f) => f.id !== fwdDel[1]);
      return jsonResponse({ success: true });
    }
    if (subPath === '/email/autoresponders' && method === 'GET') {
      return jsonResponse({ success: true, autoresponders });
    }
    if (subPath === '/email/autoresponders' && method === 'POST') {
      autoresponders = [
        ...autoresponders,
        {
          id: `ar_${Date.now()}`,
          email: `${body.localPart || 'hello'}@example-store.com`,
          local_part: body.localPart || 'hello',
          subject: body.subject || 'Out of Office',
          body: body.body || 'Thank you for your message.',
          interval_hours: Number(body.intervalHours) || 24,
          enabled: 1,
        },
      ];
      return jsonResponse({ success: true });
    }
    const delivMatch = subPath.match(/^\/email\/deliverability\/([^/]+)$/);
    if (delivMatch && method === 'GET') {
      const dom = decodeURIComponent(delivMatch[1]);
      return jsonResponse({
        success: true,
        domain: dom,
        spf: { status: 'valid', record: 'v=spf1 ip4:203.0.113.10 ~all' },
        dkim: {
          status: 'valid',
          selector: 'default',
          record: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7V...',
        },
        dmarc: {
          status: 'valid',
          record: `v=DMARC1; p=quarantine; rua=mailto:postmaster@${dom}`,
        },
      });
    }
    if (subPath.endsWith('/install') && method === 'POST') {
      return jsonResponse({ success: true });
    }
    if (subPath.startsWith('/email/default-address/')) {
      return jsonResponse({ success: true, action: 'fail', forwardTo: '' });
    }

    // 8. Backups (Restic & cpmove)
    if (subPath === '/backup/restic/snapshots' && method === 'GET') {
      return jsonResponse({ success: true, snapshots });
    }
    if (subPath === '/backup/restic/backup' && method === 'POST') {
      const snapId = Math.random().toString(16).slice(2, 10);
      snapshots = [
        {
          id: snapId,
          time: new Date().toISOString(),
          paths: ['/home/acme', '/var/lib/mysql/acme_store'],
          hostname: 'cleanpanel.example-panel.org',
          tags: ['manual-demo'],
        },
        ...snapshots,
      ];
      return jsonResponse({ success: true, snapshotId: snapId });
    }
    if (subPath === '/backup/restic/restore' && method === 'POST') {
      return jsonResponse({ success: true });
    }
    if (subPath === '/backup/cpmove/export' && method === 'POST') {
      return jsonResponse({
        success: true,
        archivePath: '/home/acme/backups/cpmove-acme-20261126.tar.gz',
      });
    }
    if (subPath === '/backup/cpmove/import' && method === 'POST') {
      return jsonResponse({
        success: true,
        summary:
          'Imported cpmove archive cleanly: 3 domains, 7 BIND9 DNS records, 2 MariaDB databases, 2 Maildir mailboxes, and Let’s Encrypt SSL certificates restored.',
      });
    }

    return jsonResponse({ success: true });
  };

  // Intercept WebSocket only for /ws/terminal so xterm.js runs interactively in-browser
  const NativeWebSocket = window.WebSocket;
  const PatchedWebSocket = function (this: any, url: string | URL, protocols?: string | string[]) {
    const str = String(url);
    if (str.includes('/ws/terminal')) {
      return new DemoTerminalWebSocket(
        str,
        () => files,
        () => getEffectiveUsername()
      ) as unknown as WebSocket;
    }
    return new NativeWebSocket(url, protocols);
  } as unknown as typeof WebSocket;

  Object.assign(PatchedWebSocket, {
    CONNECTING: NativeWebSocket.CONNECTING,
    OPEN: NativeWebSocket.OPEN,
    CLOSING: NativeWebSocket.CLOSING,
    CLOSED: NativeWebSocket.CLOSED,
    prototype: NativeWebSocket.prototype,
  });
  window.WebSocket = PatchedWebSocket;
}
