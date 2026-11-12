# Project: cPanel Clean-Room Modern Appliance

## Architecture
The system is built as a standalone, single-server appliance running a 100% TypeScript/Node.js stack with strict privilege separation:
- **Privileged Root Daemon (`packages/agentd`)**:
  - Runs as `root` (in production) or unprivileged with `PANEL_SYSROOT=./scratch/sysroot` (in sandbox/test mode).
  - Exposes an NDJSON Unix domain socket (`/run/panel/agent.sock` or `./scratch/sysroot/run/panel/agent.sock`).
  - Zero shell string interpolation; strict Zod schema validation; atomic file writes.
  - Implements 8 handler modules (tenant, web-php, dns-bind, mail-rspamd, mysql, files, wp-toolkit, cpmove) executing all 24 privileged operations.
- **Unprivileged Web & API Server (`packages/server`)**:
  - Runs unprivileged as `panelweb` (or local user in dev/sandbox).
  - Hosts REST APIs for all 9 cPanel categories and WebSocket terminal/log endpoints on a unified single port (default `:8443` or `:3000`).
  - SQLite database (`better-sqlite3` with `node:sqlite` fallback) for users, domains, DNS zones, mailboxes, and audit logs.
  - 3-tier RBAC (`admin`, `reseller`, `customer`), 1-click user impersonation, Argon2id/TOTP/JWT auth, phpMyAdmin SignonSession and Roundcube SSO token minting.
- **Modernized Control Panel SPA (`packages/web`)**:
  - Single Page Application built with React, Vite, TypeScript, and Tailwind CSS.
  - Jupiter-inspired layout with search-first instant navigation (`/` hotkey), right telemetry rail, 1-click user impersonation banner.
  - Native File Manager + Monaco Code Editor modal, `@xterm/xterm` WebSocket terminal, RFC 1035 Zone Editor, Email Deliverability Suite, phpMyAdmin SSO, MultiPHP Manager, WP-CLI Toolkit, and cpmove Importer/Exporter.
- **Shared Contracts (`packages/shared`)**:
  - Pure TypeScript models, Zod RPC schemas, deterministic `.htaccess`-to-Nginx rule converter, and system constants shared across UI, server, and daemon.
- **Dual-Mode `PANEL_SYSROOT` Engine**:
  - When `PANEL_SYSROOT=/` (production), config files write to `/etc/...` and `systemctl`/`rndc` are executed directly.
  - When `PANEL_SYSROOT=./scratch/sysroot` (sandbox mode), all paths resolve within `./scratch/sysroot/...`, and system service commands are recorded in `./scratch/sysroot/var/log/mock_executions.log`.

---

## Feature Inventory (68 Features Across 9 Categories)
Every feature from the HostGator empirical manifest is enumerated and assigned to a specific Milestone:

| # | Code | Feature Name | Description | Milestone | Source |
|---|------|--------------|-------------|-----------|--------|
| 1 | `FIL-01` | File Manager | Web filesystem navigator, Monaco editor, zip/tar, chmod | M1/M3 | Manifest / ADR-07 |
| 2 | `FIL-02` | Images | Image thumbnailer, scaler, PNG/JPEG/WEBP converter | M1/M3 | Manifest |
| 3 | `FIL-03` | Directory Privacy | Protect directories via HTTP Basic Auth (`.htpasswd` + Nginx) | M1/M2/M3 | Manifest |
| 4 | `FIL-04` | Disk Usage | Storage visualizer across directories, DBs, mail | M1/M2/M3 | Manifest |
| 5 | `FIL-05` | Web Disk | WebDAV endpoint provisioning for remote mounting | M1/M2/M3 | Manifest |
| 6 | `FIL-06` | FTP Accounts | Virtual FTP/SFTP accounts with directory chroot | M1/M2/M3 | Manifest |
| 7 | `FIL-07` | FTP Connections | Active FTP/SFTP session monitor and kick | M1/M2/M3 | Manifest |
| 8 | `FIL-08` | Anonymous FTP | Public anonymous FTP toggle (disabled / security toggle) | M1/M2/M3 | Manifest |
| 9 | `FIL-09` | Backup | Full account `cpmove` `.tar.gz` and partial SQL/homedir dumps | M1/M2/M3 | Manifest / ADR-09 |
| 10 | `FIL-10` | Backup Wizard | 3-step wizard for backup generation and restoration | M1/M2/M3 | Manifest / ADR-09 |
| 11 | `FIL-11` | Git Version Control | Bare git repository manager with deployment hooks | M1/M2/M3 | Manifest |
| 12 | `DB-01` | phpMyAdmin SSO | 1-Click passwordless SSO bridge via SignonSession | M1/M2/M3 | Manifest / ADR-08 |
| 13 | `DB-02` | MySQL Databases | Database creation, user management, grant assignment | M1/M2/M3 | Manifest |
| 14 | `DB-03` | MySQL Database Wizard | Guided 4-step wizard (DB -> User -> Grants -> Summary) | M2/M3 | Manifest |
| 15 | `DB-04` | Remote MySQL | External client IP whitelist for port 3306 MySQL access | M1/M2/M3 | Manifest |
| 16 | `DB-05` | PostgreSQL Databases | PostgreSQL database and role provisioning | M2/M3 | Manifest |
| 17 | `DB-06` | phpPgAdmin | Web interface for PostgreSQL administration with SSO | M2/M3 | Manifest |
| 18 | `DOM-01` | Domains Manager | Apex, addon, subdomain, and docroot management | M1/M2/M3 | Manifest |
| 19 | `DOM-02` | Redirects | HTTP 301/302 domain and URL path redirection in Nginx | M1/M2/M3 | Manifest |
| 20 | `DOM-03` | Zone Editor | RFC 1035 BIND9 DNS zone editor + Cloudflare sync | M1/M2/M3 | Manifest / ADR-05 |
| 21 | `DOM-04` | Dynamic DNS | DDNS webhook allowing remote devices to update A records | M2/M3 | Manifest |
| 22 | `DOM-05` | Addon Domains | Secondary domain mapping to subdirectories | M1/M2/M3 | Manifest |
| 23 | `DOM-06` | Subdomains | Subdomain creation (`*.domain.com`) with isolated docroot | M1/M2/M3 | Manifest |
| 24 | `DOM-07` | Parked Domains (Aliases)| Domain aliases sharing primary document root | M1/M2/M3 | Manifest |
| 25 | `DOM-08` | Site Publisher | Static website placeholder builder | M3 | Manifest |
| 26 | `DOM-09` | Sitejet Builder | Site builder placeholder/integration | M3 | Manifest |
| 27 | `EML-01` | Email Accounts | IMAP/POP3/SMTP mailbox CRUD, storage quotas, Dovecot | M1/M2/M3 | Manifest / ADR-06 |
| 28 | `EML-02` | Forwarders | Postfix alias forwarding rules (`/etc/postfix/virtual`) | M1/M2/M3 | Manifest / ADR-06 |
| 29 | `EML-03` | Email Routing | Local, Backup, or Remote Mail Exchanger (Google/M365) | M1/M2/M3 | Manifest |
| 30 | `EML-04` | Autoresponders | Vacation replies with Sieve script rate-limiting | M1/M2/M3 | Manifest / ADR-06 |
| 31 | `EML-05` | Default Address | Domain catch-all mailbox or bounce handler (`:fail:`) | M1/M2/M3 | Manifest |
| 32 | `EML-06` | Mailing Lists | Newsletter/discussion list management | M2/M3 | Manifest |
| 33 | `EML-07` | Track Delivery | Mail delivery trace searching Postfix/Rspamd logs | M2/M3 | Manifest |
| 34 | `EML-08` | Global Email Filters | Account-wide Sieve rules evaluated for incoming mail | M1/M2/M3 | Manifest |
| 35 | `EML-09` | User Email Filters | Per-mailbox Sieve rules for folder filing/discard | M1/M2/M3 | Manifest |
| 36 | `EML-10` | Email Deliverability | SPF, DKIM (RSA/Ed25519), DMARC validation & key installer | M1/M2/M3 | Manifest / ADR-06 |
| 37 | `EML-11` | Address Importer | Batch CSV/Excel import for mailboxes and forwarders | M2/M3 | Manifest |
| 38 | `EML-12` | Spam Filters | Rspamd scoring threshold, auto-delete, whitelist/blacklist | M1/M2/M3 | Manifest / ADR-06 |
| 39 | `EML-13` | Email Encryption | GnuPG / PGP public and private key management | M2/M3 | Manifest |
| 40 | `EML-14` | BoxTrapper | Challenge-response verification toggle | M2/M3 | Manifest |
| 41 | `EML-15` | Calendars & Contacts | CalDAV / CardDAV synchronization endpoint details | M2/M3 | Manifest |
| 42 | `EML-16` | Email Disk Usage | Per-folder mail disk breakdown with expunge action | M1/M2/M3 | Manifest |
| 43 | `MET-01` | Visitors | Last 1,000 HTTP requests log inspector | M2/M3 | Manifest |
| 44 | `MET-02` | Errors Log | Live tail and viewer of web server and PHP error logs | M2/M3 | Manifest |
| 45 | `MET-03` | Bandwidth | Transfer accounting per domain (HTTP, FTP, Mail) | M2/M3 | Manifest |
| 46 | `MET-04` | Raw Access Logs | Download compressed historical web access logs (`.log.gz`)| M2/M3 | Manifest |
| 47 | `MET-05` | Awstats / GoAccess | High-performance real-time GoAccess web analytics | M2/M3 | Manifest / ADR-08 |
| 48 | `MET-06` | Webalizer | Legacy traffic stats view / placeholder | M3 | Manifest |
| 49 | `MET-07` | Analog Stats | Legacy text-based stats view / placeholder | M3 | Manifest |
| 50 | `MET-08` | Metrics Editor | Enable/disable stats generators per domain | M2/M3 | Manifest |
| 51 | `MET-09` | Resource Usage | CPU, Memory, I/O cgroup limits & historical telemetry | M1/M2/M3 | Manifest |
| 52 | `SEC-01` | SSH Access | SSH public/private key generation, authorization, import | M1/M2/M3 | Manifest |
| 53 | `SEC-02` | IP Blocker | Deny visitor IP addresses / subnets via Nginx deny rules | M1/M2/M3 | Manifest |
| 54 | `SEC-03` | SSL/TLS Status & AutoSSL| Let's Encrypt ACME automated issuance & SAN viewer | M1/M2/M3 | Manifest |
| 55 | `SEC-04` | Manage API Tokens | Scoped API token generation with expiration | M2/M3 | Manifest |
| 56 | `SEC-05` | Hotlink Protection | Prevent direct image/asset linking via Nginx referrers | M1/M2/M3 | Manifest |
| 57 | `SEC-06` | Leech Protection | Limit concurrent downloads and redirect abusers | M1/M2/M3 | Manifest |
| 58 | `SEC-07` | ModSecurity / Coraza | WAF rule engine toggle and anomaly thresholds | M1/M2/M3 | Manifest |
| 59 | `SOF-01` | MultiPHP Manager | Per-domain PHP version switcher (5.6, 7.x, 8.1–8.5) | M1/M2/M3 | Manifest / ADR-10 |
| 60 | `SOF-02` | MultiPHP INI Editor | Per-pool `php_admin_value` directive editor | M1/M2/M3 | Manifest / ADR-10 |
| 61 | `SOF-03` | WP-CLI WordPress Toolkit| Install, clone, staging, auto-update, wp-admin SSO | M1/M2/M3 | Manifest / ADR-10 |
| 62 | `SOF-04` | Node.js App Manager | Systemd user service runner with Nginx reverse proxy | M1/M2/M3 | Manifest / ADR-10 |
| 63 | `SOF-05` | Python App Manager | WSGI/Gunicorn systemd runner behind Nginx | M1/M2/M3 | Manifest / ADR-10 |
| 64 | `SOF-06` | Composer / Packages | PHP Composer package dependency viewer | M1/M2/M3 | Manifest |
| 65 | `SOF-07` | Perl Modules | Perl module list and CPAN viewer | M2/M3 | Manifest |
| 66 | `SOF-08` | Ruby on Rails | Passenger / systemd Ruby app runner | M2/M3 | Manifest |
| 67 | `ADV-01` | Terminal | Embedded `@xterm/xterm` + `node-pty` WebSocket shell | M2/M3 | Manifest / ADR-08 |
| 68 | `ADV-02` | Cron Jobs | System cron manager with cPanel PHP CLI path mapping | M1/M2/M3 | Manifest |
| 69 | `ADV-03` | Track DNS | DNS lookup, dig, and reverse PTR diagnostic utility | M2/M3 | Manifest |
| 70 | `ADV-04` | Indexes | Directory browsing toggle (`autoindex on/off`) | M1/M2/M3 | Manifest |
| 71 | `ADV-05` | Error Pages | Custom HTTP 400, 401, 403, 404, 500 HTML error pages | M1/M2/M3 | Manifest |
| 72 | `ADV-06` | MIME Types | Custom MIME type handler mapping | M1/M2/M3 | Manifest |
| 73 | `PRE-01` | User Manager | Unified user, FTP, and mail sub-account manager | M2/M3 | Manifest |
| 74 | `PRE-02` | Password & Security | Password rotation, Argon2id hashing, and session logout | M2/M3 | Manifest |
| 75 | `PRE-03` | Two-Factor Auth (2FA)| RFC 6238 TOTP authenticator setup and verification | M2/M3 | Manifest |
| 76 | `PRE-04` | 1-Click Impersonation | Admin/Reseller support impersonation into any tenant | M2/M3 | Manifest / ADR-03 |
| 77 | `PRE-05` | Contact Information | Notification email and quota alert thresholds | M2/M3 | Manifest |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| **M1** | **Shared Contracts & Privileged `panel-agentd` Daemon** | `packages/shared`: Zod RPC schemas (24 operations), models, `.htaccess` converter.<br>`packages/agentd`: Unix socket RPC server, `PANEL_SYSROOT` engine, 8 handlers (`tenant`, `web-php`, `dns-bind`, `mail-rspamd`, `mysql`, `files`, `wp-toolkit`, `cpmove`), streaming `cpmove` importer/exporter, `restic` runner, unit tests. | Root package setup | DONE |
| **M2** | **Unprivileged API Server & Pre-Seeded `vahag` Account** | `packages/server`: SQLite DB schema & WAL migrations, 3-tier RBAC (`admin`, `reseller`, `vahag`), 1-click user impersonation, REST APIs for all 9 cPanel categories, WebSocket terminal bridge (`node-pty`), error log tailer, `phpMyAdmin` SignonSession & `Roundcube` SSO, pre-seeding Vahag's authentic HostGator data (`architecturalnumbers.com`, `trace4less.com`, `vahag_architecturalnumbers`, mailboxes, Multi-PHP pools) into `scratch/sysroot`. | M1 | DONE |
| **M3** | **Modernized React + Monaco + `xterm.js` Control Panel SPA** | `packages/web`: Jupiter-inspired Single Page Application with `/`-hotkey search, right telemetry rail, 1-click user impersonation banner, Native File Manager + Monaco Code Editor modal, `@xterm/xterm` WebSocket terminal, RFC 1035 Zone Editor, Email Deliverability Suite, phpMyAdmin SSO, MultiPHP & WP-CLI Toolkit, and cpmove Backup Importer/Exporter. | M1, M2 | DONE |
| **M4** | **End-to-End Integration Test Suite, Verification, Git Commit & Push** | Automated unit/integration tests verifying all API endpoints, generated `scratch/sysroot/etc/*` configurations, `cpmove` round-trip import/export; `npm run verify` pass; start live panel server and verify HTTP 200 OK on HTML and all static `.js`/`.css` bundles; commit with `Conversation-ID: c769e393-8656-4c45-8af2-589d05f9c378` and `Agent: agents@darter` trailers and push to `origin/main`. | M1, M2, M3 | IN_PROGRESS |
| **E2E**| **E2E Testing Track (Parallel)** | Design comprehensive opaque-box test suite (Tiers 1–4) derived from user requirements and feature manifest, publish `TEST_INFRA.md` and `TEST_READY.md`. | Requirements | DONE |

---

## Interface Contracts

### `packages/server` (Web API) ↔ `packages/agentd` (Privileged Daemon)
- **Transport**: Unix Domain Socket (`/run/panel/agent.sock` or `./scratch/sysroot/run/panel/agent.sock` in sandbox mode).
- **Framing**: NDJSON (Newline Delimited JSON).
- **Request Format**:
  ```typescript
  interface RpcRequest<T = any> {
    id: string;          // UUID v4
    operation: string;   // e.g., 'web.upsertVhost', 'dns.upsertZone'
    params: T;           // Validated against Zod schema in packages/shared
    callerUid?: number;  // UID of calling user for tenant operations
  }
  ```
- **Response Format**:
  ```typescript
  interface RpcResponse<T = any> {
    id: string;          // Matches request id
    success: boolean;
    data?: T;
    error?: {
      code: string;      // e.g., 'EACCES', 'ZONE_INVALID', 'USER_EXISTS'
      message: string;
      details?: any;
    };
  }
  ```
- **Streaming Operations (`backup.cpmoveAndRestic`)**:
  - Emits chunk envelopes: `{ id, chunk: string (base64) | progress: number, done: boolean }`.

### `packages/web` (React SPA) ↔ `packages/server` (API Server)
- **Transport**: HTTP/HTTPS REST APIs (`/api/v1/*`) + WebSocket (`/ws/*`).
- **Authentication**: Bearer JWT in `Authorization` header, or cookie session, with support for impersonation header `X-Impersonate-User: <username>`.
- **WebSocket Endpoints**:
  - `/ws/terminal?token=<jwt>`: Interactive shell stream using `node-pty`.
  - `/ws/logs/:domain?token=<jwt>`: Real-time error and access log tailing.

---

## Code Layout

```text
/home/robert/projects/cpanel-clean-room/
├── package.json                          # Root monorepo workspace definition
├── tsconfig.json                         # Base TypeScript configuration
├── docs/                                 # Clean-room specifications (01..11), manifests, competitor data
├── scripts/                              # Verification, inventory, and crawl scripts
├── scratch/
│   └── sysroot/                          # Rootless sandbox environment (PANEL_SYSROOT)
│       ├── etc/
│       │   ├── nginx/sites-available/    # Generated Nginx vhost configs
│       │   ├── php/<ver>/fpm/pool.d/     # Isolated Multi-PHP FPM pools
│       │   ├── bind/zones/               # RFC 1035 BIND9 zone files (<domain>.db)
│       │   ├── postfix/virtual           # Postfix virtual alias mapping
│       │   └── dovecot/passwd            # Dovecot authentication and quota tables
│       ├── home/<user>/public_html/      # Tenant document roots
│       └── var/
│           ├── lib/rspamd/dkim/          # Generated RSA/Ed25519 DKIM keys
│           └── log/mock_executions.log   # Sandbox command execution audit log
└── packages/
    ├── shared/                           # @cpanel-clean-room/shared
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── rpc-schema.ts             # Strongly-typed Zod schemas for all 24 operations
    │       ├── models.ts                 # Account, Domain, DnsRecord, Mailbox, Database, Backup models
    │       ├── htaccess-translator.ts    # Deterministic Apache .htaccess -> Nginx converter
    │       └── constants.ts              # Port mappings, default paths, PHP version lists
    ├── agentd/                           # @cpanel-clean-room/agentd
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # Unix domain socket server
    │       ├── sysroot.ts                # Dual-mode Sandbox vs Production path resolver & runner
    │       └── handlers/
    │           ├── tenant.ts             # useradd, cgroups v2, disk quota
    │           ├── web-php.ts            # Nginx vhosts, Apache2 proxy, PHP-FPM pools, Let's Encrypt SSL
    │           ├── dns-bind.ts           # RFC 1035 BIND9 zone writer/parser + Cloudflare sync
    │           ├── mail-rspamd.ts        # Postfix virtual, Dovecot passwd/Maildir/Sieve, Rspamd DKIM
    │           ├── mysql.ts              # MariaDB DBs, users, grants, SignonSession
    │           ├── files.ts              # Tenant-UID dropped file operations (list, read, write, chmod, tar/zip)
    │           ├── wp-toolkit.ts         # WP-CLI install, clone, auto-update, SSO
    │           └── cpmove.ts             # Streaming cpmove import/export + restic runner
    ├── server/                           # @cpanel-clean-room/server
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                  # REST API & WebSocket server
    │       ├── db/                       # SQLite WAL schema, migrations, seed loader
    │       ├── auth/                     # Argon2id, TOTP, RBAC, 1-click user impersonation
    │       ├── ws/                       # xterm.js terminal bridge & log tailer
    │       ├── rpc-client.ts             # Unix socket client to panel-agentd
    │       └── routes/                   # REST routes for all 9 cPanel categories & Admin WHM views
    └── web/                              # @cpanel-clean-room/web
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── App.tsx
            ├── main.tsx
            ├── components/               # Jupiter Navigation, Search Hotkey (/), Telemetry Rail
            └── pages/                    # 9 cPanel Category views, Monaco Editor, xterm.js, Impersonation
```
