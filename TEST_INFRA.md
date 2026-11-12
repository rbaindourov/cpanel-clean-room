# TEST_INFRA — End-to-End Test Infrastructure & 4-Tier Testing Track

> **Clean-Room Control Panel Appliance — Comprehensive E2E Test Suite Specification**  
> **Repository:** `/home/robert/projects/cpanel-clean-room`  
> **Authoritative Baseline:** `docs/data/cpanel_feature_manifest.json` (68 Features from Vahag Kazanchyan's HostGator Account) & `docs/11-architecture-decision-records-and-mvp-spec.md` (`ADR-01` to `ADR-11`)

---

## 1. Dual-Track Testing Principles & Architecture

The E2E Testing Track is established to guarantee strict functional parity, zero regressions, and robust opaque-box validation across all 68 cPanel features and 11 Architecture Decision Records (`ADR-01` through `ADR-11`).

### 1.1 Core Principles
1. **Opaque-Box Requirement-Driven Testing:**
   - Tests evaluate external behaviors, file system outputs, HTTP contracts, and RPC protocols rather than internal code implementation details.
   - Every expectation is derived authoritatively from the empirical HostGator feature manifest (`docs/data/cpanel_feature_manifest.json`), client Vahag Kazanchyan's production data (`architecturalnumbers.com`, `trace4less.com`), and ADR specifications.
2. **Deterministic Dual-Mode Sysroot Containment (`PANEL_SYSROOT`):**
   - In sandbox/test mode (`PANEL_SYSROOT=./scratch/sysroot`), tests execute without requiring `root` privileges.
   - All system writes target isolated sandbox paths (`scratch/sysroot/etc/...`, `scratch/sysroot/home/...`).
   - Privileged Linux commands (`systemctl`, `rndc`, `postmap`, `sievec`) are intercepted in sandbox mode and deterministically recorded into `scratch/sysroot/var/log/mock_executions.log` with verbatim arguments.
3. **Progressive Testability & Total Isolation:**
   - Each test sets up and tears down its own state, operating independently of execution order.
   - The test harness automatically validates directory structures, generates synthetic fixtures, executes tests, and verifies generated configuration syntax.
4. **Native Node.js Toolchain (Zero External CI / Docker Requirement):**
   - Built on Node's native `node:test` and `node:assert/strict` modules.
   - Runs directly on host developer workstations (`agents@darter`, `agents@webdesigner`) without Docker containers or GitHub Actions runner dependencies.

---

## 2. 4-Tier Test Methodology

The testing track structures all test scenarios into four distinct verification tiers:

```
+-------------------------------------------------------------------------+
|                  TIER 4: Real-World Application Scenarios               |
|    - WordPress Production (architecturalnumbers.com, Multi-PHP 8.4)     |
|    - Legacy PHP App (trace4less.com, PHP 7.2/5.6, .htaccess rewrites)   |
|    - Full cpmove-vahag.tar.gz Round-Trip Import & Export Equivalence    |
|    - 1-Click Support Impersonation & Security Audit Trail               |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                TIER 3: Cross-Feature Interactions (Pairwise)            |
|    - Web + DNS + SSL + Multi-PHP + .htaccess Rewrite Pipeline           |
|    - MariaDB + User Privileges + phpMyAdmin SignonSession SSO           |
|    - Domain + Mailbox + Postfix Map + Dovecot Auth + Sieve + DKIM/SPF   |
|    - Tenant User + cgroups v2 + Disk Quota + Cron Scheduler            |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                TIER 2: Boundary & Corner Cases (Adversarial)            |
|    - Path Traversal & Chroot Escapes (../../etc/shadow, symlinks)       |
|    - Command Injection & Parameter Escaping (; rm -rf, \0 bytes)        |
|    - Resource & Quota Overflow Limits (0-byte files, 100GB quotas)      |
|    - Corrupt Tarball Archives & Truncated SQL Dumps                     |
|    - Unicode & Punycode Domain / Email Address Handling                 |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                TIER 1: Feature Coverage (>=5 Test Cases Per Feature)    |
|    - All 68 Features across 9 Categories (FIL, DB, DOM, EML, MET,       |
|      SEC, SOF, ADV, PRE)                                                |
|    - Verifies CRUD, configuration files, and RPC state transitions       |
+-------------------------------------------------------------------------+
```

---

## 3. Tier 1: Feature Coverage Matrix (>=5 Test Cases Per Feature)

Tier 1 covers all 68 features across the 9 cPanel functional categories. Each feature is tested with at least 5 discrete test cases:

### Category 1: Files (`FIL-01` to `FIL-11` — 11 Features)
- **`FIL-01` (File Manager):**
  1. `listDirectory`: Recursively list directory contents with file metadata (size, mtime, permissions).
  2. `readFile`: Read UTF-8 text and binary files within tenant home root.
  3. `writeFile`: Atomic write with directory creation and POSIX permission setting.
  4. `chmodFile`: Modify permissions (`0644`, `0755`) and verify bitmask.
  5. `deleteFile`: Soft delete to trash and permanent file unlink.
- **`FIL-02` (Images):**
  1. Generate image thumbnail with target dimensions (e.g. 150x150).
  2. Scale high-resolution image preserving aspect ratio.
  3. Convert PNG asset to WebP format.
  4. Handle missing image source error gracefully.
  5. Reject unsupported MIME type upload.
- **`FIL-03` (Directory Privacy):**
  1. Create password-protected directory with `.htpasswd` entry.
  2. Verify Nginx `auth_basic` and `auth_basic_user_file` block injection.
  3. Add multiple authorized users to existing directory protection.
  4. Update user password in `.htpasswd`.
  5. Remove directory protection and verify Nginx config cleanup.
- **`FIL-04` (Disk Usage):**
  1. Calculate aggregate disk usage across tenant homedir (`du -b`).
  2. Calculate MySQL database disk usage for tenant databases.
  3. Calculate Maildir storage usage across all mailboxes.
  4. Verify hierarchical directory breakdown JSON.
  5. Trigger quota threshold alert when usage exceeds 90%.
- **`FIL-05` (Web Disk):**
  1. Provision WebDAV virtual account with read-write permissions.
  2. Provision read-only WebDAV account restricted to subdirectory.
  3. Update WebDAV digest password.
  4. Verify WebDAV digest configuration format.
  5. Revoke WebDAV account and terminate active connections.
- **`FIL-06` (FTP Accounts):**
  1. Create virtual FTP account with chroot to `public_html/subfolder`.
  2. Enforce storage quota on virtual FTP user.
  3. Update FTP account password.
  4. Delete virtual FTP account preserving user data.
  5. Reject duplicate FTP username.
- **`FIL-07` (FTP Connections):**
  1. Query active FTP/SFTP sessions list.
  2. Filter active sessions by client IP address.
  3. Terminate (kick) active session by session ID.
  4. Handle non-existent session ID termination error.
  5. Log session disconnection event to audit log.
- **`FIL-08` (Anonymous FTP):**
  1. Query anonymous FTP status (disabled by default in secure clean-room).
  2. Verify incoming upload directory disabled.
  3. Assert warning emitted if enabled without chroot restriction.
  4. Toggle anonymous access setting.
  5. Ensure root filesystem cannot be accessed via anonymous FTP.
- **`FIL-09` (Backup):**
  1. Generate full account `cpmove-<user>.tar.gz` archive.
  2. Generate partial homedir backup archive.
  3. Generate partial MySQL database dump archive.
  4. Stream backup archive chunks with NDJSON progress.
  5. Verify backup archive integrity (`tar -tzf`).
- **`FIL-10` (Backup Wizard):**
  1. Wizard step 1: Select backup destination and type.
  2. Wizard step 2: Generate compressed archive with live progress.
  3. Wizard step 3: Complete archive verification and download URL generation.
  4. Wizard restore step 1: Upload and inspect backup archive manifest.
  5. Wizard restore step 2: Restore database and homedir with conflict resolution.
- **`FIL-11` (Git Version Control):**
  1. Initialize bare git repository at `~/repositories/<repo>.git`.
  2. Configure deployment branch and working tree checkout path.
  3. Install executable `post-receive` deployment hook script.
  4. Update repository remote URL and fetch branches.
  5. Delete git repository without destroying deployed web root.

### Category 2: Databases (`DB-01` to `DB-06` — 6 Features)
- **`DB-01` (phpMyAdmin SSO):**
  1. Mint valid 60-second HMAC `SignonSession` token for tenant user.
  2. Verify session token payload contains authorized database credentials.
  3. Reject expired SSO token (>60s).
  4. Reject forged or tampered HMAC signature.
  5. Verify redirect URL generation pointing to `/phpmyadmin/index.php`.
- **`DB-02` (MySQL Databases):**
  1. Create database with mandated user prefix (`vahag_db1`) and `utf8mb4`.
  2. Create database user with user prefix (`vahag_user1`) and secure password.
  3. Assign granular grants (`SELECT, INSERT, UPDATE, DELETE`) to user on database.
  4. Rotate database user password without interrupting other users.
  5. Drop database and revoke corresponding user grants.
- **`DB-03` (MySQL Database Wizard):**
  1. Wizard Step 1: Validate and create database name.
  2. Wizard Step 2: Validate and create database user.
  3. Wizard Step 3: Select all privileges and execute `GRANT ALL ON db.*`.
  4. Wizard Step 4: Output connection string snippet (PHP PDO & WordPress `wp-config.php`).
  5. Abort wizard cleanly on duplicate database name error.
- **`DB-04` (Remote MySQL):**
  1. Add external client IPv4 whitelist entry for TCP port 3306.
  2. Add external client CIDR subnet whitelist entry (e.g. `192.168.1.0/24`).
  3. Verify MariaDB `GRANT ... TO ...@'<client_ip>'` executed.
  4. Delete client IP whitelist entry and flush privileges.
  5. Reject invalid IP address format.
- **`DB-05` (PostgreSQL Databases):**
  1. Create PostgreSQL database with tenant prefix.
  2. Create PostgreSQL role with encrypted password.
  3. Grant database ownership to created role.
  4. Alter role connection limits.
  5. Drop PostgreSQL database and role.
- **`DB-06` (phpPgAdmin):**
  1. Generate authenticated session token for phpPgAdmin.
  2. Verify session credentials against PostgreSQL UNIX socket.
  3. Generate SSO redirect URL for tenant database.
  4. Invalidate phpPgAdmin session on logout.
  5. Reject unauthorized cross-tenant database access in phpPgAdmin.

### Category 3: Domains (`DOM-01` to `DOM-09` — 9 Features)
- **`DOM-01` (Domains Manager):**
  1. Create primary domain with docroot `/home/vahag/public_html`.
  2. Generate production Nginx vhost config in `scratch/sysroot/etc/nginx/sites-available/`.
  3. Verify Nginx `sites-enabled/` symlink creation.
  4. Update domain document root path.
  5. Delete domain and remove corresponding Nginx vhost configuration.
- **`DOM-02` (Redirects):**
  1. Create HTTP 301 Permanent redirect from `/old-path` to `https://target.com/new-path`.
  2. Create HTTP 302 Temporary redirect for maintenance.
  3. Verify Nginx `rewrite` or `return` rule generated in vhost block.
  4. Detect and prevent infinite redirect loop (redirecting path to itself).
  5. Delete redirect rule and reload Nginx configuration.
- **`DOM-03` (Zone Editor):**
  1. Create RFC 1035 BIND9 zone file with `$TTL`, `SOA`, `NS`, `A`, and `MX` records.
  2. Add `CNAME` record and verify syntax formatting.
  3. Add `TXT` record for SPF / DKIM with proper quotes.
  4. Increment zone serial number on record modification.
  5. Delete record and verify `rndc reload` logged to mock executions.
- **`DOM-04` (Dynamic DNS):**
  1. Generate dynamic DNS bearer token for subdomain.
  2. Process DDNS update webhook call with remote IP.
  3. Update BIND9 A record dynamically with 60-second TTL.
  4. Reject DDNS update with invalid or revoked bearer token.
  5. Rate-limit excessive DDNS update requests.
- **`DOM-05` (Addon Domains):**
  1. Create addon domain `trace4less.com` pointing to `/home/vahag/trace4less.com`.
  2. Provision dedicated Nginx server block isolated from primary domain.
  3. Automatically provision DNS zone for addon domain.
  4. Assign distinct PHP-FPM pool for addon domain.
  5. Remove addon domain without deleting parent tenant account.
- **`DOM-06` (Subdomains):**
  1. Create subdomain `store.architecturalnumbers.com` with docroot `/home/vahag/store`.
  2. Add A record in parent BIND9 zone file.
  3. Generate Nginx vhost block for subdomain.
  4. Enforce SSL certificate SAN expansion for subdomain.
  5. Delete subdomain and clean up DNS and web configs.
- **`DOM-07` (Parked Domains / Aliases):**
  1. Add domain alias `architecturalnumbers.net` sharing primary document root.
  2. Update Nginx `server_name` directive to include alias.
  3. Add DNS zone with CNAME/A records pointing to server IP.
  4. Request SSL certificate including alias domain SAN.
  5. Remove parked domain alias from Nginx server block.
- **`DOM-08` (Site Publisher):**
  1. List available static landing page templates.
  2. Render template with tenant company name, email, and description.
  3. Write static assets (`index.html`, `style.css`) to target document root.
  4. Guard existing files from accidental overwrite without user confirmation.
  5. Verify published static site serves valid HTML.
- **`DOM-09` (Sitejet Builder Integration):**
  1. Verify site builder integration endpoint status.
  2. Query site builder license status (returns clean-room unbundled status).
  3. Provide graceful fallback guidance to WordPress or static publisher.
  4. Handle launch request when builder is unconfigured.
  5. Ensure zero external proprietary dependencies block core domain operations.

### Category 4: Email (`EML-01` to `EML-16` — 16 Features)
- **`EML-01` (Email Accounts):**
  1. Create mailbox `production@architecturalnumbers.com` with 3,000 MB quota.
  2. Hash mailbox password with `SHA512-CRYPT` into `/etc/dovecot/passwd`.
  3. Provision standard Maildir structure (`cur/`, `new/`, `tmp/`) with tenant ownership.
  4. Update mailbox storage quota limit.
  5. Delete mailbox and archive existing Maildir.
- **`EML-02` (Forwarders):**
  1. Create email forwarder from `info@architecturalnumbers.com` to `sales@architecturalnumbers.com`.
  2. Create domain-level email forwarding rule (`@old.com` -> `@new.com`).
  3. Verify Postfix `/etc/postfix/virtual` table syntax.
  4. Verify `postmap` compilation logged to mock execution log.
  5. Delete forwarder rule and recompile virtual map.
- **`EML-03` (Email Routing):**
  1. Set email routing to Local Mail Exchanger (deliver locally via Dovecot).
  2. Set email routing to Remote Mail Exchanger (Google Workspace / M365).
  3. Verify Postfix `transport_maps` entry (`local:` vs `smtp:`).
  4. Detect MX record mismatch when Remote routing configured without external MX.
  5. Set email routing to Backup Mail Exchanger.
- **`EML-04` (Autoresponders):**
  1. Create out-of-office autoresponder with subject, body, and start/end dates.
  2. Generate Dovecot Sieve vacation rule script.
  3. Enforce rate-limiting interval (e.g. respond at most once per 24 hours per sender).
  4. Verify `sievec` script compilation.
  5. Disable autoresponder and verify Sieve script removal.
- **`EML-05` (Default Address / Catch-All):**
  1. Configure catch-all address forwarding to `admin@architecturalnumbers.com`.
  2. Configure catch-all to reject with standard bounce message (`:fail:`).
  3. Verify Postfix wildcard entry `@architecturalnumbers.com`.
  4. Handle pipe to external program (`|/path/to/script`).
  5. Disable catch-all and verify unhandled addresses bounce.
- **`EML-06` (Mailing Lists):**
  1. Create discussion mailing list with admin email and password.
  2. Add subscriber email addresses to mailing list.
  3. Set moderation policy for non-member postings.
  4. Remove subscriber from mailing list.
  5. Delete mailing list and clean up list archives.
- **`EML-07` (Track Delivery):**
  1. Query delivery status for recipient email address.
  2. Parse Postfix mail log for queue ID, DSN status code (`2.0.0` vs `5.1.1`), and relay.
  3. Parse Rspamd scan logs for spam score and rejection reasons.
  4. Filter delivery history by date range and delivery status.
  5. Handle delivery trace for non-existent message ID gracefully.
- **`EML-08` (Global Email Filters):**
  1. Create account-level Sieve filter matching subject keyword and moving to folder.
  2. Compile global Sieve script into `/var/lib/dovecot/sieve/default.sieve`.
  3. Test complex rule with multiple boolean criteria (`AND` / `OR`).
  4. Reorder filter execution priority.
  5. Delete global filter and recompile Sieve binary.
- **`EML-09` (User Email Filters):**
  1. Create mailbox-specific Sieve filter matching sender address.
  2. Write filter rule to user's `~/.dovecot.sieve` script.
  3. Add discard action (`discard;`) for specific spam patterns.
  4. Compile user Sieve script with `sievec`.
  5. Remove user email filter and verify script clean up.
- **`EML-10` (Email Deliverability):**
  1. Generate 2048-bit RSA DKIM private key and DNS TXT record.
  2. Generate modern Ed25519 DKIM keypair.
  3. Format compliant SPF DNS TXT record (`v=spf1 +mx +a ~all`).
  4. Format compliant DMARC record (`v=DMARC1; p=reject; rua=mailto:...`).
  5. Validate live DNS records against expected deliverability status.
- **`EML-11` (Address Importer):**
  1. Parse CSV file containing batch mailbox definitions (email, password, quota).
  2. Execute atomic batch creation of 10 mailboxes.
  3. Parse CSV file containing forwarder mappings.
  4. Reject malformed CSV rows with clear line-number errors.
  5. Rollback or report partial failure cleanly on duplicate mailbox address.
- **`EML-12` (Spam Filters):**
  1. Configure Rspamd scoring threshold (e.g. tag at 6.0, reject at 15.0).
  2. Configure auto-delete spam toggle.
  3. Add sender email and domain to spam whitelist.
  4. Add sender email and domain to spam blacklist.
  5. Write tenant spam configuration to `/etc/rspamd/local.d/` or tenant prefs.
- **`EML-13` (Email Encryption / GnuPG):**
  1. Generate 2048-bit RSA GPG keypair with passphrase.
  2. Export public ASCII-armored key block.
  3. Import external public GPG key into keyring.
  4. List stored public and private GPG keys.
  5. Delete GPG key from tenant keyring.
- **`EML-14` (BoxTrapper):**
  1. Query BoxTrapper status (disabled by default in modern clean-room).
  2. Verify challenge-response queue settings.
  3. Add authorized sender to BoxTrapper whitelist.
  4. Review queued verification messages.
  5. Toggle BoxTrapper state for mailbox.
- **`EML-15` (Calendars & Contacts):**
  1. Query CalDAV synchronization URL and port.
  2. Query CardDAV address book URL.
  3. Generate Apple macOS/iOS `.mobileconfig` autoconfiguration profile.
  4. Verify SSL/TLS requirements on CalDAV endpoint.
  5. Invalidate CalDAV/CardDAV sync token on password reset.
- **`EML-16` (Email Disk Usage):**
  1. Calculate per-folder disk usage (`INBOX`, `Sent`, `Trash`, `Junk`) in Maildir.
  2. Execute `doveadm expunge` action on messages older than 30 days in `Trash`.
  3. Execute expunge action on messages marked `\Seen` in `Junk`.
  4. Assert freed disk space correctly reflected in mailbox quota.
  5. Handle expunge on locked mailbox without corrupting index.

### Category 5: Metrics (`MET-01` to `MET-09` — 9 Features)
- **`MET-01` (Visitors):**
  1. Parse last 1,000 lines of Nginx access log into structured JSON.
  2. Extract client IP, timestamp, HTTP method, URL, status code, referrer, and user agent.
  3. Filter visitors by domain name.
  4. Paginate visitor log results.
  5. Handle empty or newly created access log gracefully.
- **`MET-02` (Errors Log):**
  1. Read last 300 lines of Nginx error log and PHP-FPM error log.
  2. Stream real-time error log lines over WebSocket endpoint.
  3. Highlight critical fatal errors (PHP Fatal, Nginx 502/504).
  4. Filter error logs by severity level (`error`, `warn`, `crit`).
  5. Handle missing error log file without throwing server exception.
- **`MET-03` (Bandwidth):**
  1. Aggregate HTTP transfer bytes per domain from access logs.
  2. Aggregate FTP and Mail (IMAP/SMTP) transfer bytes.
  3. Generate daily bandwidth breakdown for current billing cycle.
  4. Alert when tenant bandwidth usage exceeds 80% of allocation.
  5. Reset monthly bandwidth counters on billing cycle rollover.
- **`MET-04` (Raw Access Logs):**
  1. Query list of archived compressed access logs (`.log.gz`).
  2. Trigger immediate rotation and gzip compression of current access log.
  3. Generate secure download stream for `.log.gz` archive.
  4. Configure automatic log archiving and retention period (e.g. 30 days).
  5. Prune expired log archives beyond retention window.
- **`MET-05` (Awstats / GoAccess):**
  1. Generate high-performance GoAccess HTML5 real-time report for domain.
  2. Generate GoAccess JSON telemetry stream for dashboard charts.
  3. Verify top 10 requested URLs, top visitor countries, and 404 error breakdown.
  4. Enforce password protection on web analytics report URL.
  5. Handle log rotation in GoAccess state pipeline.
- **`MET-06` (Webalizer):**
  1. Query legacy Webalizer status.
  2. Provide clean-room migration notice redirecting to GoAccess.
  3. Generate static legacy chart fallback if enabled.
  4. Ensure legacy stats daemon consumes zero background CPU cycles.
  5. Toggle Webalizer generation flag in domain preferences.
- **`MET-07` (Analog Stats):**
  1. Query Analog stats status (disabled by default in HostGator manifest).
  2. Provide deprecation notice and modern telemetry alternative.
  3. Render simple text summary if legacy mode requested.
  4. Toggle Analog stats flag.
  5. Verify no orphaned background processes spawned.
- **`MET-08` (Metrics Editor):**
  1. Query enabled metrics engines per domain (GoAccess, Webalizer, Raw Logs).
  2. Enable GoAccess and disable legacy engines for domain.
  3. Persist metrics preferences in SQLite database.
  4. Verify cron execution honors disabled metrics engines.
  5. Reset domain metrics configuration to system default.
- **`MET-09` (Resource Usage):**
  1. Query tenant `systemd` `cgroups v2` slice CPU usage percentage.
  2. Query tenant memory usage against `MemoryMax` limit.
  3. Query current task count against `TasksMax` limit.
  4. Generate historical 24-hour resource usage timeline.
  5. Detect and log cgroup OOM kills or CPU throttling events.

### Category 6: Security (`SEC-01` to `SEC-07` — 7 Features)
- **`SEC-01` (SSH Access):**
  1. Generate 4096-bit RSA or Ed25519 SSH keypair.
  2. Authorize public key by appending to `~/.ssh/authorized_keys` with `0600` permissions.
  3. Import external public key and validate OpenSSH format.
  4. Deauthorize public key from `authorized_keys`.
  5. Delete private key from server storage.
- **`SEC-02` (IP Blocker):**
  1. Block single IPv4 address by appending Nginx `deny <ip>;` directive.
  2. Block CIDR subnet (e.g. `10.0.0.0/8`).
  3. Verify blocked IP receives HTTP 403 Forbidden.
  4. Unblock IP address and reload Nginx configuration.
  5. Reject invalid IP/CIDR syntax.
- **`SEC-03` (SSL/TLS Status & AutoSSL):**
  1. Query SSL status and certificate expiration date for all domains.
  2. Request automated Let's Encrypt ACME HTTP-01 certificate.
  3. Deploy certificate `.crt` and private `.key` to Nginx vhost.
  4. Verify automated SAN coverage for `domain.com`, `www.domain.com`, `mail.domain.com`.
  5. Force HTTPS redirect rule generation in Nginx vhost block.
- **`SEC-04` (Manage API Tokens):**
  1. Generate scoped API token with name and expiration timestamp.
  2. Authenticate REST API request using `Authorization: Bearer <token>`.
  3. Enforce token scope restrictions (e.g. token with `dns` scope rejected on `mysql` API).
  4. Reject expired API token.
  5. Revoke API token immediately.
- **`SEC-05` (Hotlink Protection):**
  1. Enable hotlink protection for file extensions (`jpg`, `jpeg`, `gif`, `png`, `webp`).
  2. Specify authorized referrer domains.
  3. Verify Nginx `valid_referers` block written to vhost configuration.
  4. Configure redirect URL for unauthorized hotlink requests.
  5. Disable hotlink protection and reload Nginx.
- **`SEC-06` (Leech Protection):**
  1. Set maximum concurrent download connections per IP in Nginx (`limit_conn_zone`).
  2. Configure redirect URL for clients exceeding connection threshold.
  3. Apply leech protection to protected directory.
  4. Verify HTTP 429 or 503 response when connection limit exceeded.
  5. Disable leech protection and verify Nginx config cleanup.
- **`SEC-07` (ModSecurity / Coraza WAF):**
  1. Query WAF engine status and loaded OWASP Core Rule Set (CRS).
  2. Enable/disable WAF per domain.
  3. Configure anomaly threshold scoring.
  4. Whitelist specific rule ID for domain (e.g. rule 941100 for false positive).
  5. Parse and display WAF security block events in error log.

### Category 7: Software (`SOF-01` to `SOF-08` — 8 Features)
- **`SOF-01` (MultiPHP Manager):**
  1. List installed Multi-PHP versions (`5.6`, `7.2`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`).
  2. Switch domain PHP version from `8.3` to `8.4`.
  3. Move PHP-FPM pool config from `/etc/php/8.3/fpm/pool.d/` to `/etc/php/8.4/fpm/pool.d/`.
  4. Update Nginx vhost `fastcgi_pass unix:/run/php/php8.4-fpm-vahag.sock`.
  5. Verify both FPM pools and Nginx reload logged to mock execution log.
- **`SOF-02` (MultiPHP INI Editor):**
  1. Update `memory_limit` directive for domain pool (e.g. `512M`).
  2. Update `upload_max_filesize` and `post_max_size` directives.
  3. Update `max_execution_time` (e.g. `90` seconds).
  4. Verify directives written as `php_admin_value` in domain pool configuration.
  5. Reject invalid directive syntax or out-of-range values.
- **`SOF-03` (WP-CLI WordPress Toolkit):**
  1. Install new WordPress instance at document root via `wp core download` & `wp core install`.
  2. Clone existing WordPress site to staging subdomain.
  3. Toggle automatic minor and major core updates.
  4. List installed plugins and execute plugin updates.
  5. Mint 1-click passwordless `wp-admin` SSO login URL.
- **`SOF-04` (Node.js App Manager):**
  1. Register Node.js application with entry script and port.
  2. Generate `systemd` user service unit file (`node-app-<name>.service`).
  3. Configure Nginx reverse proxy block forwarding to application port.
  4. Start, stop, and restart application service.
  5. Read live stdout/stderr application logs.
- **`SOF-05` (Python App Manager):**
  1. Register Python WSGI application with virtualenv path and entry point.
  2. Generate Gunicorn/systemd service unit file.
  3. Configure Nginx reverse proxy to Unix socket or local port.
  4. Restart Python application on code change.
  5. Read Python error and access logs.
- **`SOF-06` (Composer / Packages):**
  1. Detect `composer.json` in domain document root.
  2. Execute `composer install` or `composer update` dropped to tenant UID.
  3. List installed Composer packages and versions.
  4. Validate `composer.json` syntax.
  5. Stream Composer console output to client.
- **`SOF-07` (Perl Modules):**
  1. List installed system Perl modules.
  2. Verify local tenant `cpan` library path configured.
  3. Execute syntax check on Perl CGI script.
  4. Reject execution of Perl scripts outside authorized docroot.
  5. Handle Perl execution error with descriptive line traceback.
- **`SOF-08` (Ruby on Rails):**
  1. Register Ruby on Rails application.
  2. Configure Passenger or systemd Puma runner behind Nginx.
  3. Set `RAILS_ENV=production` environment variable.
  4. Execute database migrations (`rails db:migrate`).
  5. Read Rails production log file.

### Category 8: Advanced (`ADV-01` to `ADV-06` — 6 Features)
- **`ADV-01` (Terminal):**
  1. Establish WebSocket terminal connection with JWT authentication.
  2. Spawn interactive shell process dropped to tenant UID/GID.
  3. Send stdin keystrokes and receive stdout terminal escape sequences.
  4. Handle terminal window resize (`TIOCSWINSZ` / cols & rows).
  5. Terminate shell session cleanly on client disconnect.
- **`ADV-02` (Cron Jobs):**
  1. Create system cron job with schedule (e.g. `0 2 * * *`) and command.
  2. Translate legacy cPanel PHP paths (`/opt/cpanel/ea-php83/.../php` -> `/usr/bin/php8.3`).
  3. Write validated cron entry to `/etc/cron.d/tenant-<user>` with `USER=<user>`.
  4. Validate crontab schedule syntax (reject invalid 5-field syntax).
  5. Delete cron job and verify crontab file update.
- **`ADV-03` (Track DNS):**
  1. Perform DNS lookup for domain A records.
  2. Perform MX record lookup and verify mail server priorities.
  3. Perform reverse DNS (PTR) lookup on IP address.
  4. Perform trace route / dig query with latency measurements.
  5. Handle unresolvable domain error gracefully.
- **`ADV-04` (Indexes):**
  1. Set directory indexing mode to Default (inherited).
  2. Set directory indexing mode to Disabled (`autoindex off;` in Nginx).
  3. Set directory indexing mode to Enabled (`autoindex on;`).
  4. Verify Nginx `autoindex` directive written to directory location block.
  5. Test that indexing disabled returns HTTP 403 when no `index.php` or `index.html` exists.
- **`ADV-05` (Error Pages):**
  1. Customize HTTP 404 Not Found error page HTML.
  2. Customize HTTP 403 Forbidden error page HTML.
  3. Customize HTTP 500 Internal Server Error page HTML.
  4. Verify Nginx `error_page` directive pointing to custom HTML path.
  5. Reset custom error page to server default.
- **`ADV-06` (MIME Types):**
  1. Register custom MIME type mapping (e.g. `.wasm` -> `application/wasm`).
  2. Verify Nginx `types` block updated in vhost configuration.
  3. Delete custom MIME type mapping.
  4. Reject duplicate extension with conflicting MIME type.
  5. Reload Nginx configuration and verify MIME response header.

### Category 9: Preferences (`PRE-01` to `PRE-05` — 5 Features)
- **`PRE-01` (User Manager):**
  1. Create sub-account user with scoped access to Email and FTP.
  2. Update sub-account password and contact information.
  3. Link sub-account to specific domain mailbox.
  4. Disable sub-account login access.
  5. Delete sub-account and revoke all linked privileges.
- **`PRE-02` (Password & Security):**
  1. Enforce minimum password strength calculation (score >= 65 per manifest).
  2. Hash passwords with Argon2id using secure salt and memory parameters.
  3. Rotate tenant login password and invalidate all active session tokens.
  4. Terminate all other active browser sessions on password change.
  5. Reject password reuse against historical password hashes.
- **`PRE-03` (Two-Factor Authentication / 2FA):**
  1. Generate RFC 6238 TOTP secret and QR code data URI.
  2. Validate 6-digit TOTP code during 2FA enrollment.
  3. Generate and store encrypted emergency scratch backup codes.
  4. Require valid TOTP token on subsequent login attempts.
  5. Disable 2FA after verifying current password and emergency code.
- **`PRE-04` (1-Click Impersonation):**
  1. Allow Admin / Reseller to generate ephemeral impersonation token for tenant `vahag`.
  2. Inject `X-Impersonate-User: vahag` header into authenticated API requests.
  3. Enforce tenant-level data isolation during impersonated session.
  4. Record all impersonated actions into audit log with operator admin ID.
  5. Terminate impersonation session and return cleanly to admin context.
- **`PRE-05` (Contact Information):**
  1. Update primary contact notification email address.
  2. Set quota warning notification threshold (e.g. 80%, 90%).
  3. Enable/disable disk quota notification emails.
  4. Enable/disable SSL expiration notification emails.
  5. Send test notification email via local Postfix daemon.

---

## 4. Tier 2: Boundary & Corner Cases (Adversarial Security & Stress)

Tier 2 executes adversarial, stress, and corner-case tests designed to identify edge-case defects:

1. **Path Traversal & Chroot Confinement (`ADV_PATH_TRAVERSAL`):**
   - Attempt file read/write with `../../etc/shadow` and encoded `%2e%2e%2f`.
   - Attempt symlink creation pointing to `/root` or `/etc`.
   - Verify file manager resolves realpath and strictly rejects any path outside tenant document root with HTTP 403 / `EACCES`.
2. **Command & SQL Injection Immunity (`ADV_INJECTION`):**
   - Attempt domain creation with malicious characters: `example.com; rm -rf /`.
   - Attempt database user creation with SQL injection payloads: `user'; DROP TABLE users;--`.
   - Verify all daemon commands use `child_process.execFile` with array arguments (zero shell interpolation) and all SQL statements use parameterized queries.
3. **Resource & Quota Boundary Conditions (`ADV_QUOTA_BOUNDARIES`):**
   - Attempt mailbox creation with 0 MB quota (reject or handle as unlimited depending on policy).
   - Attempt mailbox creation with quota larger than total tenant disk quota.
   - Test disk usage calculations with empty directories, zero-byte files, and 100GB sparse files.
4. **Archive & File System Stress (`ADV_ARCHIVE_CORRUPTION`):**
   - Attempt cpmove restore using corrupted gzip header.
   - Attempt cpmove restore with "tarbomb" directory traversal (`../../etc/passwd`).
   - Verify uncompress stream aborts with clear validation error without leaving partial files on disk.
5. **Unicode, Punycode & Special Characters (`ADV_UNICODE`):**
   - Create internationalized domain name (IDN): `münchen-numbers.de` -> `xn--mnchen-numbers-gsb.de`.
   - Create mailbox with UTF-8 display names and quoted local parts.
   - Create BIND9 TXT records containing semicolons, colons, and multi-line strings.
6. **Concurrent State & Race Conditions (`ADV_CONCURRENCY`):**
   - Issue concurrent file write requests to the same configuration file.
   - Verify atomic file writes (`fs.writeFileSync(tmpPath)` + `fs.renameSync`) guarantee zero torn reads or corrupted configs.
   - Execute parallel domain creation requests and verify serial BIND9 and Nginx reloads.

---

## 5. Tier 3: Cross-Feature Interaction Pipelines

Tier 3 tests end-to-end multi-feature workflows connecting across system boundaries:

### Pipeline 1: Full Web & DNS Provisioning
1. User creates domain `architecturalnumbers.com` (`DOM-01`).
2. Local RFC 1035 BIND9 zone file `/etc/bind/zones/architecturalnumbers.com.db` is compiled with SOA, NS, A, MX records (`DOM-03`).
3. Multi-PHP FPM 8.4 pool configuration `/etc/php/8.4/fpm/pool.d/vahag-architecturalnumbers.com.conf` is written with isolated socket (`SOF-01`).
4. Nginx vhost `/etc/nginx/sites-available/architecturalnumbers.com.conf` is generated with `fastcgi_pass`, WordPress `try_files`, and SSL placeholders (`DOM-01`, `ADR-04`).
5. Let's Encrypt AutoSSL certificate is requested and deployed (`SEC-03`).
6. HTTPS redirection rule is added to Nginx vhost (`DOM-02`).
7. BIND9 and Nginx reload commands are executed in sequence (`ADR-05`).

### Pipeline 2: Full Email & Deliverability Stack
1. User registers email domain `architecturalnumbers.com` (`EML-01`).
2. 2048-bit RSA DKIM private key is generated at `/var/lib/rspamd/dkim/architecturalnumbers.com.dkim.key` (`EML-10`, `ADR-06`).
3. Corresponding DKIM `default._domainkey.architecturalnumbers.com` TXT record and SPF record are inserted into BIND9 zone file (`DOM-03`).
4. Mailbox `sales@architecturalnumbers.com` is provisioned with 4,000 MB quota and Maildir directory tree (`EML-01`).
5. Postfix `/etc/postfix/virtual` is updated with forwarder `info@...` -> `sales@...` and `postmap` is executed (`EML-02`).
6. Dovecot Sieve vacation autoresponder is installed and compiled with `sievec` (`EML-04`).

### Pipeline 3: Database & phpMyAdmin SSO Stack
1. User creates database `vahag_architecturalnumbers` (`DB-02`).
2. User creates database user `vahag_k` with password (`DB-02`).
3. Privileges granted: `GRANT ALL ON vahag_architecturalnumbers.* TO 'vahag_k'@'localhost'` (`DB-02`).
4. User clicks phpMyAdmin SSO button in React panel (`DB-01`).
5. Server mints 60-second HMAC `SignonSession` token (`ADR-08`).
6. Verification script validates token payload, signature, and expiration.

### Pipeline 4: Tenant Creation & cgroups v2 Quota Stack
1. Admin creates tenant account `vahag` with 10 GB disk quota and 512 MB memory limit (`PRE-01`).
2. System user and group `vahag` are created with home directory `/home/vahag` (`ADR-02`).
3. `systemd` `cgroups v2` slice `/etc/systemd/system/user-1001.slice` is written with `MemoryMax=512M` and `CPUQuota=200%` (`MET-09`).
4. Cron job is scheduled in `/etc/cron.d/tenant-vahag` with cPanel PHP CLI path translated to `/usr/bin/php8.4` (`ADV-02`).

---

## 6. Tier 4: Real-World Application Scenarios

Tier 4 tests authentic, multi-domain production scenarios reconstructed from Vahag Kazanchyan's HostGator cPanel account:

### Scenario 1: Vahag Kazanchyan's WordPress Production (`architecturalnumbers.com`)
- **Domain:** `architecturalnumbers.com` (Apex)
- **Document Root:** `/home/vahag/public_html`
- **Application:** WordPress 6.x CMS
- **Runtime:** Multi-PHP FPM 8.4 (`memory_limit = 512M`, `upload_max_filesize = 512M`, `max_execution_time = 90`)
- **Web Server:** Nginx with WordPress rewrite preset (`try_files $uri $uri/ /index.php?$args`)
- **Database:** `vahag_architecturalnumbers` (54.7 MB dump, user `vahag_k`)
- **Mailboxes (4):**
  - `production@architecturalnumbers.com` (Quota: 3,000 MB, Usage: 2,567 MB)
  - `sales@architecturalnumbers.com` (Quota: 4,000 MB, Usage: 2,469 MB)
  - `webmaster@architecturalnumbers.com` (Quota: 1,000 MB, Usage: 731 MB)
  - `amazon@architecturalnumbers.com` (Quota: 500 MB, Usage: 13 MB)
- **SSL / TLS:** Let's Encrypt Wildcard RSA 2048-bit with 10 SANs (`architecturalnumbers.com`, `www.*`, `mail.*`, `cpanel.*`, `webmail.*`, etc.)
- **DNS Zone:** BIND9 RFC 1035 zone file with A, NS, MX, SPF, and 2048-bit RSA DKIM records.
- **Verification Assertions:**
  - Verify all configs written into `scratch/sysroot/etc/nginx/`, `scratch/sysroot/etc/php/8.4/fpm/`, `scratch/sysroot/etc/bind/zones/`, `scratch/sysroot/etc/dovecot/`.
  - Assert syntax validity of generated configuration files.

### Scenario 2: Legacy PHP Application (`trace4less.com`)
- **Domain:** `trace4less.com` (Addon Domain)
- **Document Root:** `/home/vahag/trace4less.com`
- **Application:** Custom legacy PHP procedural application with `.htaccess` rewrites
- **Runtime:** Multi-PHP FPM 7.2 (with fallback compatibility shim)
- **Database:** `vahag_trace4less` (4.1 KB dump, user `vahag_k`)
- **Web Server:** Nginx with deterministic `.htaccess` translation:
  - Strips `AddHandler application/x-httpd-ea-php72`
  - Converts `RewriteCond %{REQUEST_FILENAME} !-f` -> `try_files $uri $uri/ /index.php?$args`
  - Converts redirects `RewriteRule ^search/(.*)$ /results.php?q=$1 [L,QSA]` -> `rewrite ^/search/(.*)$ /results.php?q=$1 last;`
- **Verification Assertions:**
  - Verify separate FPM pool in `scratch/sysroot/etc/php/7.2/fpm/pool.d/`.
  - Verify converted Nginx rewrite rules execute without syntax errors.

### Scenario 3: Full `cpmove-vahag.tar.gz` Round-Trip Migration
- **Import Stage:**
  1. Construct authentic `cpmove-vahag.tar.gz` containing:
     - `cp/vahag`: Account metadata (`DNS=architecturalnumbers.com`, `PLAN=unlimited`, `CONTACTEMAIL=vahag@example.com`)
     - `userdata/main` and `userdata/architecturalnumbers.com`: Docroots, PHP versions
     - `homedir/public_html/`: WordPress site files and `.htaccess`
     - `mysql/vahag_architecturalnumbers.sql`: Schema and data dump
     - `mysql.sql`: User grants and password hashes
     - `dnszones/architecturalnumbers.com.db`: RFC 1035 zone file
     - `cron/vahag`: Crontab entries
     - `apache_tls/architecturalnumbers.com`: Certificate and private key
     - `valiases/architecturalnumbers.com`: Forwarder map
  2. Execute migration import engine.
  3. Assert all databases, domains, DNS zones, mailboxes, and cron jobs ingested into SQLite state and written to `scratch/sysroot`.
- **Export Stage:**
  1. Trigger streaming `cpmove` export for user `vahag`.
  2. Collect exported `.tar.gz` archive.
  3. Decompress and verify full structural parity and checksum equivalence of restored data.

### Scenario 4: Support Impersonation & Security Audit Trail
- **Workflow:**
  1. Admin logs into control panel.
  2. Admin triggers 1-click impersonation into tenant `vahag`.
  3. System issues ephemeral JWT with `impersonator: "admin"` and `user: "vahag"`.
  4. Impersonated session adds IP blocker rule for `203.0.113.50`.
  5. Audit log records: `timestamp`, `action: "ip_blocker.add"`, `tenant: "vahag"`, `operator: "admin"`.
  6. Verify tenant data isolation (cannot access other tenants' files).
  7. Admin ends impersonation and returns to primary session.

---

## 7. Test Harness & Sysroot Sandbox Manager

The test harness provides automated sandbox lifecycle management in `tests/e2e/harness/`:

- **`sysroot-sandbox.mjs`**:
  - Initializes clean directory hierarchy under `./scratch/sysroot/`:
    - `etc/nginx/sites-available/` and `etc/nginx/sites-enabled/`
    - `etc/php/{5.6,7.2,8.1,8.2,8.3,8.4,8.5}/fpm/pool.d/`
    - `etc/bind/zones/`
    - `etc/postfix/` and `etc/dovecot/`
    - `etc/systemd/system/`
    - `etc/cron.d/`
    - `var/lib/rspamd/dkim/`
    - `var/log/mock_executions.log`
    - `home/vahag/public_html/` and `home/vahag/trace4less.com/`
  - Implements `resolveSysroot(targetPath)` resolving paths safely into sandbox.
  - Intercepts system commands and logs to `mock_executions.log`.
- **`cpmove-fixture.mjs`**:
  - Programmatically constructs standard tarball structures for migration testing.
- **`mock-agentd-rpc.mjs`**:
  - Exposes typed invocation helpers for all 24 privileged operations.

---

## 8. Test Runner Commands & CI Verification

The entire E2E test suite is executable via standard Node.js commands:

```bash
# Run all E2E test suites (Tiers 1, 2, 3, 4)
npm run test:e2e

# Or run directly via Node.js native test runner
node --test tests/e2e/**/*.test.mjs

# Run individual tiers
node --test tests/e2e/tier1_features.test.mjs
node --test tests/e2e/tier2_boundaries.test.mjs
node --test tests/e2e/tier3_interactions.test.mjs
node --test tests/e2e/tier4_realworld_vahag.test.mjs

# Run repository integrity verification
npm run verify
```

---

## 9. Verification & Quality Gates

Before declaring `TEST_READY.md`:
1. Every test file must execute cleanly with zero uncaught exceptions.
2. All 68 features in Tier 1 must have at least 5 passing assertions each.
3. Tier 2 boundary cases must cover security boundaries (path traversal, injection, extreme sizes).
4. Tier 3 interaction pipelines must pass across web, mail, database, and tenant subsystems.
5. Tier 4 scenarios must successfully simulate Vahag Kazanchyan's authentic HostGator data (`architecturalnumbers.com`, `trace4less.com`) and complete the `cpmove` round-trip.
6. `npm run verify` must report 0 leaks and 0 policy errors.
