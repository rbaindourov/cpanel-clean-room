# Open-Source Control Panel Architectural Evaluation

This document evaluates the leading open-source control panels capable of replacing HostGator cPanel for tenant **Acme Hosting Tenant** (`example-store.com`, `legacy-crm.org`, `studio-letters.com`).

Per the **Native Installations over Docker** invariant, this evaluation strictly considers control panels that run directly on bare-metal Linux / unmanaged VPS environments as native system services (APT/systemd), directly managing standard Linux daemons (`Nginx`/`Apache`, `PHP-FPM`, `MySQL`/`MariaDB`, `BIND9`, `Postfix`, `Dovecot`, `SpamAssassin`).

---

## 1. Candidate Architectural Breakdown

### Candidate 1: Webmin + Virtualmin GPL + Usermin (GPLv3)
* **Underlying Architecture**: Modular Perl core running under a dedicated hardened HTTP daemon (`miniserv.pl`, port 10000). Features the responsive **Authentic Theme** and a comprehensive CLI utility (`virtualmin`).
* **Web & Multi-PHP Stack**: Natively supports both Apache and Nginx (LEMP). Multi-PHP is first-class—Virtualmin detects and manages multiple PHP-FPM pools from the Ondřej Surý PPA (`php7.2-fpm` through `php8.4-fpm`).
* **Mail & DNS Stack**: Direct configuration of native `Postfix`, `Dovecot` (Maildir), `SpamAssassin`, `ClamAV`, `OpenDKIM`, and `BIND9`.
* **Automated cPanel Migration Engine**: **Unrivaled.** Virtualmin includes a dedicated, battle-tested `cpmove` importer (`virtualmin migrate-domain --type cpanel`) capable of extracting a standard cPanel backup archive and recreating virtual hosts, docroots, MySQL databases, database users, mailbox accounts with preserved password hashes, forwarders, and DNS records automatically.
* **Separation of Concerns (Usermin)**: Virtualmin provides **Usermin** (port 20000), a dedicated unprivileged webmail and user portal that allows mailbox owners to manage passwords, spam filters, and autoresponders without granting access to the Webmin administrative panel.
* **Verdict**: **The #1 recommended turnkey migration target for Acme.**

---

### Candidate 2: ISPConfig 3 (BSD License)
* **Underlying Architecture**: PHP-based master-agent architecture designed specifically for multi-server hosting networks. 
* **Multi-Server Clustering**: Uniquely architected for distributed clusters. Can operate a central management master while managing separate physical nodes for Web/PHP (`203.0.113.32`), Mail/IMAP (`203.0.113.24`), and DNS/Database.
* **Web & Multi-PHP Stack**: Manages Apache, Nginx, PureFTPd, and multi-PHP-FPM versions per web domain.
* **Mail & DNS Stack**: Highly mature Postfix + Dovecot + BIND9/PowerDNS management with DKIM, SPF, and Rspamd / SpamAssassin integration.
* **cPanel Migration**: Features an active migration toolkit (`ispconfig_cpanel_migration`), though less automated than Virtualmin's native CLI command.
* **Verdict**: **The strongest open-source panel for multi-server cluster topologies** (ideal for CleanPanel's multi-node infrastructure).

---

### Candidate 3: HestiaCP (GPLv3)
* **Underlying Architecture**: Clean fork of VestaCP. Operates via a clean PHP frontend and an auditable, modular suite of bash scripts located in `/usr/local/hestia/bin/v-*` (e.g. `v-add-web-domain`, `v-add-mail-account`, `v-add-database`).
* **Web & Multi-PHP Stack**: Native Nginx as reverse proxy in front of Apache or standalone Nginx + PHP-FPM (`5.6` through `8.4`). Fast per-domain PHP switching.
* **Mail & DNS Stack**: Exim4 + Dovecot + Roundcube Webmail + BIND9. Includes automated Let's Encrypt certificates for mail, web, and the control panel.
* **User Experience**: The cleanest, most modern, and responsive user interface among open-source panels. Easiest for non-technical clients to navigate.
* **Limitation**: Mail is hardcoded to Exim4 rather than Postfix, and installation requires a clean, dedicated server OS instance.
* **Verdict**: **The best single-server UX replacement** if Acme desires an interface that feels modern and lightweight.

---

### Candidate 4: Froxlor (GPLv2)
* **Underlying Architecture**: Ultra-lean, modular PHP control panel written by system administrators. It operates without running its own daemon—it executes via scheduled cron jobs that generate native config files.
* **Web & Multi-PHP Stack**: Clean, transparent config file generation for Nginx, Apache, PHP-FPM, and Lighttpd. Multi-PHP supported natively.
* **Mail & DNS Stack**: Postfix, Dovecot/Courier, BIND9/PowerDNS.
* **Philosophy**: Leaves the underlying system untouched; admins can view the exact generated `.conf` files.
* **Limitation**: Interface is functional and developer-centric; lacks automated cPanel backup import tooling.
* **Verdict**: Excellent for minimalist sysadmins, but higher onboarding friction for clients.

---

## 2. Disqualified Panels & Risk Analysis

The following popular hosting panels were evaluated and **strictly disqualified**:

| Panel | Primary Reason for Disqualification |
| :--- | :--- |
| **Coolify / 1Panel / CapRover** | **Docker-Bound Architecture**: These platforms are built around Docker containers. They violate the native host installation rule and are poorly suited for traditional shared-hosting multi-tenant workloads (such as hosting 50 PHP/MySQL domains with shared Dovecot IMAP and unified Postfix queues). |
| **CloudPanel** | **Closed-Source & Missing Core Primitives**: While fast and native (LEMP), CloudPanel's core is proprietary. Critically, it **lacks native Mail (Postfix/Dovecot) and DNS (BIND9)** management, requiring external third-party services. |
| **CyberPanel** | **Severe Security Track Record & OpenLiteSpeed Lock-In**: Suffered catastrophic zero-day vulnerabilities (e.g., PSA-2024-001 pre-authentication remote code execution wave used by PSA-Lock ransomware in late 2024). Diverges from the standard Nginx/Apache Linux stack. |
| **aaPanel / KeyHelp** | **Proprietary & Telemetry Concerns**: Closed-source core components, non-standard system modifications, and telemetry phone-home behaviors. |

---

## 3. Comprehensive Feature Parity Matrix

Scoring candidate open-source control panels against the core requirements identified on HostGator cPanel:

| Feature / Domain Requirement | HostGator cPanel | Webmin / Virtualmin GPL | ISPConfig 3 | HestiaCP | Froxlor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **License & Cost** | Commercial ($35–$60+/mo) | **100% Free (GPLv3)** | **100% Free (BSD)** | **100% Free (GPLv3)** | **100% Free (GPLv2)** |
| **Native Linux Installation (No Docker)** | Yes | **Yes (APT / RPM)** | **Yes (APT / DNF)** | **Yes (APT)** | **Yes (APT / DNF)** |
| **cPanel Full Backup Importer** | Native | **Yes (Native CLI)** | Partial (Script) | Manual | Manual |
| **Multi-PHP (PHP 7.2 - 8.4 FPM)** | Yes (ea-php) | **Yes (Ondřej Surý PPA)** | **Yes (Ondřej Surý PPA)**| **Yes (Native)** | **Yes (Native)** |
| **MySQL / MariaDB + User ACLs** | Yes | **Yes** | **Yes** | **Yes** | **Yes** |
| **Web Database GUI** | phpMyAdmin SSO | **phpMyAdmin / Adminer** | **phpMyAdmin** | **phpMyAdmin** | **phpMyAdmin** |
| **DNS Zone Management (BIND9)** | Yes (Zone Editor) | **Yes (Full RFC1035)** | **Yes (Multi-Server)** | **Yes** | **Yes** |
| **Mail Stack (Postfix + Dovecot)** | Exim + Dovecot | **Postfix + Dovecot** | **Postfix + Dovecot** | Exim4 + Dovecot | **Postfix + Dovecot** |
| **SPF, DKIM & DMARC Automation** | Yes | **Yes (OpenDKIM)** | **Yes (OpenDKIM/Rspamd)**| **Yes (Native)** | **Yes (OpenDKIM)** |
| **Webmail Client** | Roundcube | **Usermin / Roundcube** | **Roundcube** | **Roundcube** | **Roundcube** |
| **AutoSSL / Let's Encrypt** | Yes (Sectigo/LE) | **Yes (Certbot / Native)** | **Yes (acme.sh/Certbot)** | **Yes (Native)** | **Yes (acme.sh)** |
| **File Manager in Browser** | Yes | **Yes (Authentic Fileman)**| Third-party add-on | **Yes (Built-in)** | Third-party add-on |
| **User Quotas & Resource Slices** | Yes | **Yes (XFS/ext4 + POSIX)** | **Yes** | **Yes** | **Yes** |
| **Scheduled Backups (Incremental/Offsite)**| Yes | **Yes (S3, SSH, Local)** | **Yes (FTP/Local)** | **Yes (S3, B2, SFTP)** | **Yes (FTP/Local)** |
| **Cron Job Management** | Yes | **Yes** | **Yes** | **Yes** | **Yes** |
| **Multi-Server Clustering Capability** | WHM Reseller | High (Webmin Clusters) | **Native Multi-Node Master**| Single Node | Single Node |

---

## 4. Final Recommendation & Strategic Guidance

1. **For Acme's Consolidated VPS (Short-Term)**: Deploy **Virtualmin GPL** on a clean Ubuntu 22.04 / 24.04 LTS VPS. It delivers 100% operational parity with cPanel, automates the migration of `example-store.com` and `legacy-crm.org` via `virtualmin migrate-domain`, natively accommodates PHP 7.2 through 8.4, and completely eliminates the $35–$60/month cPanel licensing overhead.
2. **For CleanPanel Multi-Server Infrastructure (Long-Term)**: Adopt the architectural principles of **HestiaCP's privileged CLI script wrapper model** (`v-*` scripts) and **ISPConfig's multi-server master/agent model** to drive the clean-room "CleanPanel" specification detailed in [Document 06](06-clean-room-control-panel-architecture.md).
