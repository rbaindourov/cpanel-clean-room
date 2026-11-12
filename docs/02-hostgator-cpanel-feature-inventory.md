# HostGator cPanel Feature Inventory & Linux Primitive Mapping

This document provides a comprehensive, categorized inventory of all 68 tools, sub-modules, and service components discovered on **HostGator cPanel** (`architecturalnumbers.com:2083`, Jupiter Theme).

For each feature, this document defines:
1. **User-Facing Capability**: What the tool accomplishes from an administrative perspective.
2. **Underlying cPanel UAPI Module**: The programmatic endpoint used by cPanel internally.
3. **Native Linux System Primitives**: The actual Linux config files, daemons, and commands executing the work under the hood.
4. **Clean-Room Priority Tier**:
   * **`P0 Must-Have`**: Fundamental to core production hosting (Web, DNS, Database, Email, SSL).
   * **`P1 High-Value`**: Operational convenience and administration (Backups, File Manager, Multi-PHP, Cron).
   * **`P2 Niche/Legacy`**: Secondary utilities (Directory Privacy, Hotlink, IP Deny, MIME types).
   * **`Skip - Bloat`**: Commercial upsells, proprietary wrappers, or deprecated tools (SiteLock, Softaculous upsells, Perl PEAR).

---

## 1. Category 00: Overview, Server Telemetry & Account Metrics

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **Tools Home Dashboard** | `DynamicUI::retrieve` / `Features::list_features` | JSON menu registry, user capability ACLs, session auth cookie (`cpsession`). | `P0` | [`docs/screenshots/00-overview/01-tools-dashboard.png`](screenshots/00-overview/01-tools-dashboard.png) |
| **Server Information** | `Variables::get_server_information` | `uname -a`, `/etc/os-release`, `httpd -v`, `mysqld --version`, `php -v`, `/proc/cpuinfo`, `/proc/meminfo`. | `P1` | [`docs/screenshots/00-overview/02-server-information.png`](screenshots/00-overview/02-server-information.png) |
| **General Information Sidebar** | `DomainInfo::domains_data`, `Quota::get_quota_info` | `/etc/passwd`, `/etc/group`, Linux XFS/ext4 user quotas (`quota -u`), system IP allocation. | `P0` | Captured in Tools Dashboard right-rail |
| **Statistics Bar** | `Bandwidth::query`, `Stats::get_site_traffic` | Apache access log accounting (`/var/log/httpd/`), MySQL query counters, Postfix delivery logs. | `P1` | Captured in Tools Dashboard right-rail |

---

## 2. Category 01: Email, Routing & Deliverability

Email is critical for Vahag's operations (`sales@westonletters.com` and customer order communications).

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **Email Accounts** | `Email::list_pops_with_disk`, `Email::add_pop`, `Email::passwd_pop` | Dovecot `/etc/dovecot/users` (or MySQL virtual mail table), `/home/<user>/mail/<domain>/<account>/`, Maildir directory structure, `doveadm quota`. | `P0` | [`docs/screenshots/01-email/01-email-accounts.png`](screenshots/01-email/01-email-accounts.png) |
| **Forwarders** | `Email::list_forwarders`, `Email::add_forwarder` | Postfix `/etc/postfix/virtual` alias map, `postmap /etc/postfix/virtual`, or `~/.forward` file. | `P0` | [`docs/screenshots/01-email/02-forwarders.png`](screenshots/01-email/02-forwarders.png) |
| **Email Routing** | `Email::get_mail_routing`, `Email::set_mail_routing` | Postfix `transport_maps` (`local:` vs `smtp:` relay routing) determining whether mail for domain is handled locally or remotely (e.g. Google Workspace/Microsoft 365). | `P0` | [`docs/screenshots/01-email/03-email-routing.png`](screenshots/01-email/03-email-routing.png) |
| **Autoresponders** | `Email::list_auto_responders`, `Email::add_auto_responder` | Dovecot Sieve vacation scripts (`vacation :days 1 :subject "..."`), or `vacation(1)` UNIX binary in `~/.vacation.msg`. | `P1` | [`docs/screenshots/01-email/04-autoresponders.png`](screenshots/01-email/04-autoresponders.png) |
| **Email Filters** | `Email::list_filters`, `Email::store_filter` | Dovecot Sieve scripts (`~/.dovecot.sieve` or `/var/lib/dovecot/sieve/`) evaluated at LDA delivery time. | `P1` | [`docs/screenshots/01-email/05-email-filters.png`](screenshots/01-email/05-email-filters.png) |
| **Email Deliverability (SPF/DKIM/DMARC)** | `Email::get_deliverability_problems`, `Email::install_dkim_private_keys` | OpenDKIM key generation (`opendkim-genkey`), `/etc/opendkim/KeyTable`, `/etc/opendkim/SigningTable`, DNS TXT record compilation (v=spf1, v=DKIM1, v=DMARC1). | `P0` | [`docs/screenshots/01-email/06-email-deliverability.png`](screenshots/01-email/06-email-deliverability.png) |
| **Spam Filters** | `SpamAssassin::get_user_preferences`, `SpamAssassin::update_user_preference` | SpamAssassin daemon (`spamd` on port 783), `~/.spamassassin/user_prefs`, `required_score 5.0`, `rewrite_header Subject *****SPAM*****`. | `P0` | [`docs/screenshots/01-email/07-spam-filters.png`](screenshots/01-email/07-spam-filters.png) |
| **Default Address (Catch-All)** | `Email::get_default_address`, `Email::set_default_address` | Postfix `virtual_alias_maps` wildcard entry (`@domain.com target@domain.com` or `:fail:` bounce). | `P1` | Discovered in manifest |
| **Mailing Lists** | `Email::list_mailmans`, `Email::add_mailman` | GNU Mailman 2/3 daemon, `/var/lib/mailman/lists/`. | `P2` | Discovered in manifest |
| **Track Delivery** | `Email::trace_delivery` | Parsing Postfix `/var/log/mail.log` or Exim `/var/log/exim4/mainlog` for queue ID, message status, and DSN codes. | `P1` | Discovered in manifest |
| **Email Disk Usage** | `Email::get_disk_usage` | `doveadm quota get -u <user>` or `du -sh /home/<user>/mail/<domain>/*`. | `P1` | Discovered in manifest |
| **BoxTrapper / GPG** | `BoxTrapper::*`, `GPG::*` | Challenge-response verification scripts / `gpg --gen-key` on disk. | `P2` | Discovered in manifest |

---

## 3. Category 02: Files, Storage & Version Control

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **File Manager** | `Fileman::list_files`, `Fileman::upload_files`, `Fileman::savefile` | Standard Linux filesystem I/O in user home directory (`/home/<user>/public_html/`), POSIX permissions (`chmod 0755`/`0644`), `unzip`/`tar` execution. | `P0` | [`docs/screenshots/02-files/01-file-manager.png`](screenshots/02-files/01-file-manager.png) |
| **Directory Privacy** | `DirectoryProtection::list_directories`, `DirectoryProtection::protect_directory` | Apache/Nginx `.htaccess` / `auth_basic "Protected Area"; auth_basic_user_file /home/<user>/.htpasswds/<path>/passwd;`. | `P1` | [`docs/screenshots/02-files/02-directory-privacy.png`](screenshots/02-files/02-directory-privacy.png) |
| **Disk Usage** | `DiskUsage::get_disk_usage` | `du -b --max-depth=2 /home/<user>`, user quota block accounting (`quotacheck` / `repquota`). | `P1` | [`docs/screenshots/02-files/03-disk-usage.png`](screenshots/02-files/03-disk-usage.png) |
| **FTP Accounts** | `Ftp::list_ftp_with_disk`, `Ftp::add_ftp` | Pure-FTPd virtual user database (`/etc/pure-ftpd/pureftpd.pdb`) or ProFTPD `AuthUserFile`, root chroot jail. | `P1` | [`docs/screenshots/02-files/04-ftp-accounts.png`](screenshots/02-files/04-ftp-accounts.png) |
| **Backup** | `Backup::list_backups`, `Backup::create_full_backup` | Shell invocation of `tar -czf backup.tar.gz /home/<user>`, `mysqldump --all-databases`, exporting DNS zone files and maildirs. | `P0` | [`docs/screenshots/02-files/05-backup.png`](screenshots/02-files/05-backup.png) |
| **Backup Wizard** | `Backup::*` (Wizard frontend) | Step-by-step UI wrapper around the single-file backup and restore scripts. | `P1` | [`docs/screenshots/02-files/06-backup-wizard.png`](screenshots/02-files/06-backup-wizard.png) |
| **Git Version Control** | `VersionControl::list_repos`, `VersionControl::create` | `git init --bare /home/<user>/repositories/<repo>.git`, post-receive hooks checking out to `/home/<user>/public_html/`. | `P1` | [`docs/screenshots/02-files/07-git-version-control.png`](screenshots/02-files/07-git-version-control.png) |
| **Web Disk** | `Webdav::list_webdav_accounts` | Apache `mod_dav` or Nginx `ngx_http_dav_module` with digest authentication. | `P2` | Discovered in manifest |

---

## 4. Category 03: Databases & Schema Management

Essential for Vahag's `vahag_architecturalnumbers` (SignBuilder 2.0 specs) and `vahag_trace4less` databases.

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **MySQL Databases** | `Mysql::list_databases`, `Mysql::create_database`, `Mysql::set_privileges_on_database` | MySQL root connection via UNIX socket `/var/run/mysqld/mysqld.sock`: `CREATE DATABASE \`<user>_<dbname>\`;`, `CREATE USER '<user>_<dbuser>'@'localhost' IDENTIFIED BY '...';`, `GRANT ALL PRIVILEGES ON \`<user>_<dbname>\`.* TO ...; FLUSH PRIVILEGES;`. | `P0` | [`docs/screenshots/03-databases/01-mysql-databases.png`](screenshots/03-databases/01-mysql-databases.png) |
| **MySQL Database Wizard** | `Mysql::*` (Wizard frontend) | Guided 4-step workflow: 1. DB Name, 2. DB Username & Password, 3. Privilege Matrix Checkboxes, 4. Confirmation. | `P1` | [`docs/screenshots/03-databases/02-mysql-wizard.png`](screenshots/03-databases/02-mysql-wizard.png) |
| **Remote MySQL** | `Mysql::list_access_hosts`, `Mysql::add_access_host` | Modifying `GRANT ... ON *.* TO ...@'<remote_ip>'` and updating UFW firewall rules on port 3306 (`ufw allow from <remote_ip> to any port 3306`). | `P1` | [`docs/screenshots/03-databases/03-remote-mysql.png`](screenshots/03-databases/03-remote-mysql.png) |
| **phpMyAdmin** | Single-Sign-On redirect (`sql/PhpMyAdmin.html`) | Upstream phpMyAdmin package (`/usr/share/phpmyadmin/`), configured with cookie/session authentication (`auth_type = 'signon'`). | `P0` | Discovered in manifest |

---

## 5. Category 04: Domains, Virtual Hosts & DNS

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **Domains Manager** | `DomainInfo::domains_data`, `AddonDomain::addaddondomain`, `SubDomain::addsubdomain` | Web server virtual host configuration (`/etc/nginx/sites-available/<domain>.conf` or Apache vhost), setting `DocumentRoot /home/<user>/<docroot>`, and creating directories. | `P0` | [`docs/screenshots/04-domains/01-domains-manager.png`](screenshots/04-domains/01-domains-manager.png) |
| **Zone Editor** | `ZoneEdit::fetchzone_records`, `ZoneEdit::add_zone_record`, `ZoneEdit::edit_zone_record` | Authoritative BIND9 zone file (`/var/named/<domain>.db` or `/etc/bind/zones/<domain>.db`), modifying SOA serial (`YYYYMMDDNN`), running `named-checkzone <domain> <file>`, and reloading via `rndc reload <domain>`. | `P0` | [`docs/screenshots/04-domains/02-zone-editor.png`](screenshots/04-domains/02-zone-editor.png) |
| **Redirects** | `Redirect::list_redirects`, `Redirect::add_redirect` | Nginx `return 301 https://target.com$request_uri;` or Apache `.htaccess` `RewriteRule ^(.*)$ https://target.com/$1 [R=301,L]`. | `P0` | [`docs/screenshots/04-domains/03-redirects.png`](screenshots/04-domains/03-redirects.png) |

---

## 6. Category 05: Metrics, Logs & Resource Analytics

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **Visitors** | `Stats::get_site_traffic` | Reading last 1,000 lines of web access log (`/var/log/httpd/domains/<domain>.log` or Nginx access log) with IP, timestamp, method, URL, status code, referer, and user-agent. | `P1` | [`docs/screenshots/05-metrics/01-visitors.png`](screenshots/05-metrics/01-visitors.png) |
| **Errors Log** | `Stats::get_last_errors` | Reading last 300 lines of `/var/log/httpd/domains/<domain>.error.log` or `/home/<user>/public_html/error_log`. | `P0` | [`docs/screenshots/05-metrics/02-errors-log.png`](screenshots/05-metrics/02-errors-log.png) |
| **Bandwidth** | `Bandwidth::query` | Parsing access log bytes transferred per domain, aggregated daily/monthly via logrotate and RRDtool. | `P1` | [`docs/screenshots/05-metrics/03-bandwidth.png`](screenshots/05-metrics/03-bandwidth.png) |
| **Awstats** | External landing redirect | Upstream AWStats Perl engine reading web access logs, outputting static HTML reports to `~/.awstats/`. Clean-room modern equivalent is **GoAccess** (real-time, fast C binary, HTML5 dashboard). | `P1` | [`docs/screenshots/05-metrics/04-awstats.png`](screenshots/05-metrics/04-awstats.png) |
| **Raw Access** | `Stats::list_raw_logs` | Exposing compressed historical access logs (`/var/log/httpd/<domain>-access.log-YYYYMMDD.gz`) for direct HTTP download. | `P1` | Discovered in manifest |

---

## 7. Category 06: Security, SSL/TLS & Access Control

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **SSL/TLS Status (AutoSSL)** | `SSL::installed_hosts`, `SSL::check_site_status` | ACME client (`certbot` or `acme.sh`), Automated HTTP-01 / DNS-01 challenges, Let's Encrypt / ZeroSSL TLS certificates (`fullchain.pem` & `privkey.pem`), web server reload. | `P0` | [`docs/screenshots/06-security/01-ssl-tls-status.png`](screenshots/06-security/01-ssl-tls-status.png) |
| **IP Blocker** | `DenyIp::list_ip_denies`, `DenyIp::add_ip` | Nginx `deny <ip>;` or Apache `.htaccess` `Require not ip <ip>`, or system firewall `ufw insert 1 deny from <ip> to any`. | `P1` | [`docs/screenshots/06-security/02-ip-blocker.png`](screenshots/06-security/02-ip-blocker.png) |
| **SSH Access** | `Telnet::list_ssh_keys`, `Telnet::import_key` | Writing public keys to `/home/<user>/.ssh/authorized_keys`, setting `chmod 0600`, generating 4096-bit RSA or Ed25519 keypairs via `ssh-keygen`. | `P0` | [`docs/screenshots/06-security/03-ssh-access.png`](screenshots/06-security/03-ssh-access.png) |
| **API Tokens** | `Tokens::list_tokens`, `Tokens::create_full_access` | Generating cryptographically secure random bearer tokens hashed with SHA-512 stored in `/home/<user>/.cpanel/api_tokens/`. Clean-room equivalent: Scoped JWT or API keys verified by control plane daemon. | `P0` | [`docs/screenshots/06-security/04-api-tokens.png`](screenshots/06-security/04-api-tokens.png) |
| **Hotlink Protection** | `Hotlink::get_hotlink_protection`, `Hotlink::set_hotlink_protection` | Nginx `valid_referers none blocked server_names; if ($invalid_referer) { return 403; }` for `.png`, `.jpg`, `.jpeg`, `.gif`, `.mp4`. | `P1` | [`docs/screenshots/06-security/05-hotlink-protection.png`](screenshots/06-security/05-hotlink-protection.png) |
| **Two-Factor Authentication** | `TwoFactorAuth::*` | RFC 6238 TOTP algorithm (Google Authenticator / Authy compatibility), secret stored in user profile. | `P0` | Discovered in manifest |

---

## 8. Category 07: Software, PHP Runtimes & Applications

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **MultiPHP Manager** | `LangPHP::php_get_installed_versions`, `LangPHP::php_set_vhost_versions` | Switching UNIX domain sockets in web virtual host configuration (`fastcgi_pass unix:/run/php/php7.2-fpm.sock;` vs `fastcgi_pass unix:/run/php/php8.4-fpm.sock;`), managed via Ondřej Surý PPA packages. | `P0` | [`docs/screenshots/07-software/01-multiphp-manager.png`](screenshots/07-software/01-multiphp-manager.png) |
| **MultiPHP INI Editor** | `LangPHP::php_ini_get_user_content`, `LangPHP::php_ini_set_user_content` | Managing per-site PHP pool directives or `php.ini` files: `memory_limit = 512M`, `upload_max_filesize = 64M`, `post_max_size = 64M`, `max_execution_time = 300`. | `P0` | [`docs/screenshots/07-software/02-multiphp-ini-editor.png`](screenshots/07-software/02-multiphp-ini-editor.png) |
| **Optimize Website** | `Optimize::get_compression_config`, `Optimize::set_compression_config` | Apache `mod_deflate` / Nginx `gzip on; gzip_types text/plain text/css application/json application/javascript text/xml application/xml;`. | `P1` | [`docs/screenshots/07-software/03-optimize-website.png`](screenshots/07-software/03-optimize-website.png) |
| **Application Manager (Phusion Passenger)** | `PassengerApps::list_applications` | Node.js / Python / Ruby application runner managing process spawning, reverse proxy port allocation, and environment variables. | `P1` | [`docs/screenshots/07-software/04-application-manager.png`](screenshots/07-software/04-application-manager.png) |
| **Softaculous / WordPress** | Third-party Softaculous plugin | Proprietary automated PHP/MySQL installer script package. For clean-room production, replaced with direct `wp-cli` (`wp core download`, `wp core install`). | `Skip - Bloat` | Discovered in manifest |
| **PHP PEAR / Perl Modules** | `ModuleInstallers::*` | Legacy package managers (`pear install`, CPAN). Irrelevant for modern WebGL and modern CMS stacks. | `Skip - Bloat` | Discovered in manifest |

---

## 9. Category 08: Advanced System & Scheduled Tasks

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **Cron Jobs** | `Cron::list_cron`, `Cron::add_line`, `Cron::edit_line` | Linux standard user crontab (`/var/spool/cron/crontabs/<user>`), managed via `crontab -u <user> -l` and `crontab -u <user> -`. | `P0` | [`docs/screenshots/08-advanced/01-cron-jobs.png`](screenshots/08-advanced/01-cron-jobs.png) |
| **Track DNS** | Network utilities wrapper | Native `dig <domain> ANY +nocmd +noall +answer` and `traceroute <host>`. | `P2` | [`docs/screenshots/08-advanced/02-track-dns.png`](screenshots/08-advanced/02-track-dns.png) |
| **Indexes** | `IndexManager::get_indexing` | Apache `Options +/-Indexes` or Nginx `autoindex on/off;`. | `P2` | [`docs/screenshots/08-advanced/03-indexes.png`](screenshots/08-advanced/03-indexes.png) |
| **Error Pages** | `ErrorPages::list_error_pages` | Static HTML error documents (`404.shtml`, `500.shtml`) mapped via Nginx `error_page 404 /404.html;`. | `P1` | [`docs/screenshots/08-advanced/04-error-pages.png`](screenshots/08-advanced/04-error-pages.png) |
| **MIME Types / Apache Handlers** | `Mime::list_mime_types` | `/etc/mime.types` and Nginx `types { application/wasm wasm; }`. | `P2` | [`docs/screenshots/08-advanced/05-mime-types.png`](screenshots/08-advanced/05-mime-types.png) |

---

## 10. Category 09: User Preferences & Account Security

| Tool / Screen | cPanel UAPI Module & Function | Native Linux System Primitives | Priority | Screenshot Reference |
| :--- | :--- | :--- | :---: | :--- |
| **User Manager** | `UserManager::list_users`, `UserManager::create_user` | Linux system accounts, Dovecot mail users, and FTP virtual users consolidated into a unified profile. | `P1` | [`docs/screenshots/09-preferences/01-user-manager.png`](screenshots/09-preferences/01-user-manager.png) |
| **Change Password** | `Passwd::change_password` | Linux `passwd <user>`, MySQL password update, and Dovecot auth db update. | `P0` | [`docs/screenshots/09-preferences/02-change-password.png`](screenshots/09-preferences/02-change-password.png) |
| **Contact Information** | `ContactInfo::get_contact_information` | Writing notification email addresses and disk/bandwidth alert threshold toggles to `/home/<user>/.cpanel/contactinfo`. | `P1` | [`docs/screenshots/09-preferences/03-contact-information.png`](screenshots/09-preferences/03-contact-information.png) |
