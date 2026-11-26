# Visual Walkthrough & UI Anatomy: HostGator cPanel (Jupiter Theme)

This visual guide breaks down the user experience, layout patterns, and interface mechanics of **HostGator cPanel** (`example-store.com:2083`), using the high-resolution, redacted reference screenshots captured in `docs/screenshots/`.

---

## 1. Overview & Core Layout Architecture

```mermaid
graph TD
    TOP["Top Global Header (cPanel/HostGator Logo, Search Quick-Jump '/', User Profile, Notifications)"]
    MAIN["Main Layout Canvas (Two Columns)"]
    LEFT["Left Primary Pane: Grouped Tools Accordion (Tools Home, Email, Files, DBs, Domains, Metrics, Security)"]
    RIGHT["Right Telemetry Rail: General Information & Live Quotas (Shared IP, Disk %, Bandwidth %, MySQL DBs)"]

    TOP --> MAIN
    MAIN --> LEFT
    MAIN --> RIGHT
```

### The Tools Home Dashboard

![cPanel Tools Dashboard](screenshots/00-overview/01-tools-dashboard.png)

The Jupiter theme organizes administrative tasks into logical, color-coded functional sections. Key elements:
* **Instant Filter (`/` shortcut)**: A persistent search bar at the top of the tools section allows quick fuzzy-filtering of all 68 tools without scanning page sections manually.
* **Right Telemetry Rail**: Displays immediate resource consumption metrics:
  * Primary Domain (`example-store.com`)
  * Home Directory (`/home4/acme`)
  * Shared IP Address (Scrubbed to `198.57.xxx.xxx`)
  * Disk Space Usage (Pie/progress bar of total quota)
  * Monthly Bandwidth Usage
  * Active MySQL Databases count (`2`) and Mailing Lists (`0`)

### Server Information Screen

![Server Information](screenshots/00-overview/02-server-information.png)

Provides a single-pane diagnostic report of the underlying host daemon versions, Linux kernel (`uname`), Apache web server version, MySQL/MariaDB version, Perl version, and cPanel architecture version. In our clean-room equivalent, this is exposed as an instant API diagnostic endpoint.

---

## 2. Category Walkthroughs

### 2.1 Email, Routing & Deliverability

Email is the primary communication pipeline for Acme's business (`sales@studio-letters.com`).

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **Email Accounts** | ![Email Accounts](screenshots/01-email/01-email-accounts.png) | Table of provisioned mailboxes, storage usage per user, "Check Email" (Webmail SSO launch), "Manage" (change password/quota), and "Connect Devices" (auto-configuration scripts for iOS, Thunderbird, Outlook). |
| **Forwarders** | ![Forwarders](screenshots/01-email/02-forwarders.png) | Forwarding rules mapping aliases (`sales@...`, `info@...`) to primary destination mailboxes, plus domain-level forwarding. |
| **Email Routing** | ![Email Routing](screenshots/01-email/03-email-routing.png) | Radio selection between "Local Mail Exchanger", "Backup Mail Exchanger", and "Remote Mail Exchanger" (critical when switching DNS MX to Google Workspace or Microsoft 365). |
| **Autoresponders** | ![Autoresponders](screenshots/01-email/04-autoresponders.png) | Character set configuration, interval rate-limiting (preventing mail loops), start/stop dates, and subject/body templates. |
| **Email Deliverability** | ![Email Deliverability](screenshots/01-email/06-email-deliverability.png) | Status badge per domain indicating whether **SPF**, **DKIM**, and **Reverse DNS (PTR)** records match DNS. Features a "Copy Record" action for DNS publication. |
| **Spam Filters** | ![Spam Filters](screenshots/01-email/07-spam-filters.png) | SpamAssassin threshold slider (1–10 score), auto-delete spam score threshold, and whitelist/blacklist management. |

---

### 2.2 Files, Storage & Version Control

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **File Manager** | ![File Manager](screenshots/02-files/01-file-manager.png) | Dual-pane navigation tree with toolbar (Upload, Download, Delete, Restore, Edit, Code Editor, Extract, Compress, Permissions). Shows file permissions (`0755`, `0644`), size, and modification timestamp. |
| **Directory Privacy** | ![Directory Privacy](screenshots/02-files/02-directory-privacy.png) | Browser tree to select folders and enforce HTTP Basic Auth credentials (`.htpasswd`). |
| **Disk Usage** | ![Disk Usage](screenshots/02-files/03-disk-usage.png) | Visual bar graph breaking down storage across `public_html`, MySQL databases, mail directories, and hidden dotfiles. |
| **Backup & Backup Wizard** | ![Backup](screenshots/02-files/05-backup.png) & ![Backup Wizard](screenshots/02-files/06-backup-wizard.png) | Generation of full cPanel archive (`backup-*.tar.gz`), download of individual home directory archives, MySQL database dumps, and email forwarder exports. |
| **Git Version Control** | ![Git Version Control](screenshots/02-files/07-git-version-control.png) | Visual creation of bare git repositories, clone URL generation, working directory checkout path, and automatic deployment configuration. |

---

### 2.3 Databases & Schema Management

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **MySQL Databases** | ![MySQL Databases](screenshots/03-databases/01-mysql-databases.png) | List of active databases (`acme_store`, `acme_crm`), size in MB, privileged users assigned, database creation input, database user creation, and user-to-database permission assignment table. |
| **MySQL Database Wizard** | ![MySQL Database Wizard](screenshots/03-databases/02-mysql-wizard.png) | 4-step guided wizard designed for non-technical users to create a database, create a user with auto-generated high-entropy password, assign all privileges, and show connection string details. |
| **Remote MySQL** | ![Remote MySQL](screenshots/03-databases/03-remote-mysql.png) | IP access list for external MySQL client connections (Navicat, DBeaver, external microservices). |

---

### 2.4 Domains & DNS Zone Editor

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **Domains Manager** | ![Domains Manager](screenshots/04-domains/01-domains-manager.png) | Unified list of apex domains, subdomains, and parked aliases. Displays document root path, SSL certificate health badge, and force HTTPS redirect toggle. |
| **Zone Editor** | ![Zone Editor](screenshots/04-domains/02-zone-editor.png) | Interactive table of DNS resource records (`A`, `AAAA`, `CNAME`, `MX`, `TXT`, `SRV`). Allows inline editing, TTL modification, record filtering, and instant addition of new records without manually formatting RFC1035 zone syntax. |
| **Redirects** | ![Redirects](screenshots/04-domains/03-redirects.png) | Form configuring 301 Permanent or 302 Temporary HTTP redirects across apex and subdomains, with regex matching and query-string pass-through toggles. |

---

### 2.5 Security & SSL/TLS Management

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **SSL/TLS Status** | ![SSL/TLS Status](screenshots/06-security/01-ssl-tls-status.png) | AutoSSL validation status across all domains and subdomains (`*.example-store.com`, `mail.*`, `cpanel.*`). Displays certificate expiration date, issuer (cPanel / Let's Encrypt / Sectigo), and one-click "Run AutoSSL" force-renewal button. |
| **IP Blocker** | ![IP Blocker](screenshots/06-security/02-ip-blocker.png) | CIDR block and single IP address blacklisting tool. Translates user inputs directly into web server deny rules. |
| **SSH Access** | ![SSH Access](screenshots/06-security/03-ssh-access.png) | SSH key generation, public key upload, and private key download, managing `~/.ssh/authorized_keys`. |
| **API Tokens** | ![API Tokens](screenshots/06-security/04-api-tokens.png) | Provisioning of scoped cPanel UAPI authentication tokens with fine-grained capability checkboxes. |

---

### 2.6 Software & Multi-PHP Runtimes

| Screen | Redacted Visual Reference | Key UI Capabilities |
| :--- | :--- | :--- |
| **MultiPHP Manager** | ![MultiPHP Manager](screenshots/07-software/01-multiphp-manager.png) | System-wide PHP version status (`ea-php81` through `ea-php85`), domain-level PHP version selector dropdown, and PHP-FPM enable/disable toggle. |
| **MultiPHP INI Editor** | ![MultiPHP INI Editor](screenshots/07-software/02-multiphp-ini-editor.png) | Dual-mode editor (Basic Mode with sliders/switches for `memory_limit`, `post_max_size`, `display_errors`; Editor Mode with direct raw text editing of `php.ini` directives). |

---

## 3. UI Patterns: What to Keep vs. What to Eliminate

### Critical UX Strengths to Retain in a Clean-Room Build
1. **Instant Keyboard Search (`/`)**: High-utility feature for power users and developers to locate tools in milliseconds.
2. **Right Telemetry Rail**: Providing at-a-glance visibility into storage, bandwidth, and database counts prevents surprise quota limits.
3. **Email Deliverability Verification**: Presenting color-coded SPF, DKIM, and DMARC status with one-click copyable TXT values dramatically reduces mail delivery support overhead.
4. **Interactive DNS Table**: Inline editing of DNS records with validation for record types (`A`, `CNAME`, `MX`, `TXT`) is vastly superior to raw zone file editing for routine client updates.

### UX Flaws & Anti-Patterns to Eliminate
1. **Commercial Upsell Distraction**: HostGator's dashboard contains banners for SiteLock, CodeGuard, and SEO tools that look like system warnings but are marketing funnels. Clean-room panels must have zero third-party upsells.
2. **Redundant Tool Duplication**: The Jupiter dashboard has 3 separate icons for SSL (`SSL/TLS`, `SSL/TLS Status`, `Manage SSL Hosts`) and 2 separate icons for backups (`Backup`, `Backup Wizard`). These should be consolidated into a single unified screen with tabs.
3. **Heavy Page Payload**: Each cPanel sub-screen loads multiple megabytes of legacy YUI, jQuery, and Angular/Vue bundles with high TTFB (`600ms–1500ms`). A modern clean-room SPA or lightweight server-rendered interface (e.g. Preact/HTMX) can render in under 80ms.
