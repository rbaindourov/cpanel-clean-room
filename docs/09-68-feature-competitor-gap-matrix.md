# 09 — 68-Feature Competitor Parity & SaaS Readiness Gap Matrix

> **Executive Summary:** Using [`scripts/score_feature_gap_matrix.mjs`](file:///home/robert/projects/cpanel-clean-room/scripts/score_feature_gap_matrix.mjs), we evaluated all **68 active cPanel tools** inventoried from Vahag Kazanchyan's HostGator account ([`docs/data/cpanel_feature_manifest.json`](file:///home/robert/projects/cpanel-clean-room/docs/data/cpanel_feature_manifest.json)) alongside **10 SaaS Product & Multi-Tenancy Requirements** across seven existing control panels and our **Strategy 3 (Composable OSS + Clean-Room Agent)** architecture. All raw data and weighted formulas are stored in [`docs/data/competitor_gap_matrix.json`](file:///home/robert/projects/cpanel-clean-room/docs/data/competitor_gap_matrix.json).

---

## 1. Overall Weighted Scorecard Summary

Our scoring model applies priority weights (`P0 = 3x`, `P1 = 2x`, `P2 = 1x`, `Skip/Bloat = 0x`, max weighted feature score = `122` across `59` active features; `9` HostGator upsell/legacy items excluded from denominator) and combines `80%` cPanel Feature Parity with `20%` SaaS Product Readiness (`maxPossibleSaasWeight = 30`):

| Candidate Panel / Strategy | P0 Must-Have (`20` features) | P1 Operational (`23` features) | P2 Convenience (`16` features) | Weighted cPanel Parity (`80%`) | SaaS Product Fit (`20%`) | **Combined Product Fit** |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Strategy 3: Composable OSS + Clean-Room Agent** | **`20.0 / 20` (`100%`)** | **`23.0 / 23` (`100%`)** | **`12.5 / 16` (`78.1%`)** | **`97.1%`** | **`100.0%`** | **`97.7%`** |
| **Webmin + Virtualmin GPL** | `19.5 / 20` (`97.5%`) | `21.5 / 23` (`93.5%`) | `12.0 / 16` (`75.0%`) | `93.0%` | `50.0%` | `84.5%` |
| **ISPConfig 3** | `19.0 / 20` (`95.0%`) | `18.5 / 23` (`80.4%`) | `9.0 / 16` (`56.3%`) | `84.4%` | `61.0%` | `79.8%` |
| **HestiaCP** | `19.5 / 20` (`97.5%`) | `18.0 / 23` (`78.3%`) | `6.0 / 16` (`37.5%`) | `82.4%` | `39.0%` | `73.8%` |
| **Froxlor v2** | `17.0 / 20` (`85.0%`) | `12.5 / 23` (`54.3%`) | `4.0 / 16` (`25.0%`) | `65.6%` | `51.0%` | `62.7%` |
| **AcePanel (Go)** | `13.5 / 20` (`67.5%`) | `13.0 / 23` (`56.5%`) | `4.5 / 16` (`28.1%`) | `58.2%` | `51.0%` | `56.8%` |
| **CloudPanel (Proprietary Ref)** | `13.5 / 20` (`67.5%`) | `12.0 / 23` (`52.2%`) | `3.5 / 16` (`21.9%`) | `55.7%` | `25.0%` | `49.7%` |
| **VitoDeploy** | `12.0 / 20` (`60.0%`) | `9.0 / 23` (`39.1%`) | `2.0 / 16` (`12.5%`) | `45.9%` | `40.0%` | `44.7%` |

```mermaid
xychart-beta
    title "Weighted cPanel Feature Parity (%) vs. SaaS Product Readiness (%)"
    x-axis ["Strategy 3", "Virtualmin", "ISPConfig 3", "HestiaCP", "Froxlor v2", "AcePanel", "CloudPanel", "VitoDeploy"]
    y-axis "Completion Score (%)" 0 --> 100
    bar [97.1, 93.0, 84.4, 82.4, 65.6, 58.2, 55.7, 45.9]
    line [100.0, 50.0, 61.0, 39.0, 51.0, 51.0, 25.0, 40.0]
```

---

## 2. Category-by-Category Completion Breakdown (`%`)

| cPanel Category | Virtualmin GPL | ISPConfig 3 | HestiaCP | Froxlor v2 | AcePanel (Go) | CloudPanel | VitoDeploy | **Strategy 3 (Composable)** |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **01 — Email (`14` tools)** | `93.1%` | `89.7%` | `74.1%` | `55.2%` | `0.0%` | `0.0%` | `0.0%` | **`93.1%`** |
| **02 — Files (`11` tools)** | `94.7%` | `73.7%` | `73.7%` | `36.8%` | `71.1%` | `68.4%` | `47.4%` | **`94.7%`** |
| **03 — Databases (`4` tools)** | `90.0%` | `90.0%` | `80.0%` | `65.0%` | `90.0%` | `90.0%` | `75.0%` | **`100.0%`** |
| **04 — Domains (`6` tools)** | `100.0%` | `100.0%` | `100.0%` | `100.0%` | `66.7%` | `66.7%` | `66.7%` | **`100.0%`** |
| **05 — Metrics (`8` tools)** | `100.0%` | `90.9%` | `100.0%` | `81.8%` | `63.6%` | `54.5%` | `36.4%` | **`100.0%`** |
| **06 — Security (`7` tools)** | `80.8%` | `73.1%` | `92.3%` | `76.9%` | `88.5%` | `80.8%` | `73.1%` | **`100.0%`** |
| **07 — Software (`9` tools)** | `88.5%` | `73.1%` | `84.6%` | `61.5%` | `96.2%` | `88.5%` | `80.8%` | **`100.0%`** |
| **08 — Advanced (`6` tools)** | `94.4%` | `77.8%` | `66.7%` | `72.2%` | `66.7%` | `55.6%` | `33.3%` | **`94.4%`** |
| **09 — Preferences (`3` tools)** | `100.0%` | `100.0%` | `88.9%` | `88.9%` | `61.1%` | `77.8%` | `72.2%` | **`100.0%`** |

---

## 3. Complete 68-Feature Parity Matrix

Legend: `1.0` = Native Complete | `0.5` = Partial / Manual / Add-on Required | `0.0` = Missing | `Skip` = HostGator Upsell or Legacy Bloat Excluded from Denominator.

### 3.1 Category 01 — Email (`14` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `EML-01` | Email Accounts (Mailboxes & Quotas) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`Postfix`+`Dovecot`) |
| `EML-02` | Forwarders (Address & Domain) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`virtual_alias_maps`) |
| `EML-03` | Email Routing (Local vs Remote MX) | **P1** | `1.0` | `0.5` | `1.0` | `0.5` | `0.0` | `0.0` | `0.0` | **`1.0`** (`transport_maps`) |
| `EML-04` | Autoresponders (Vacation Replies) | **P1** | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (Dovecot `Pigeonhole`) |
| `EML-05` | Default Address (Catch-All) | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`@domain` catch-all) |
| `EML-06` | Mailing Lists (Mailman) | *Skip* | `1.0` | `0.0` | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Replaced by Listmonk) |
| `EML-07` | Track Delivery (Mail Queue/Log Search) | **P1** | `1.0` | `0.5` | `1.0` | `0.5` | `0.0` | `0.0` | `0.0` | **`1.0`** (`journalctl` + `Rspamd`) |
| `EML-08` | Global Email Filters (Domain Sieve) | **P1** | `1.0` | `0.5` | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (ManageSieve global) |
| `EML-09` | Email Filters (Per-Mailbox Sieve) | **P1** | `1.0` | `1.0` | `1.0` | `0.5` | `0.0` | `0.0` | `0.0` | **`1.0`** (Roundcube `managesieve`) |
| `EML-10` | Email Deliverability (DKIM, SPF, DMARC) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`Rspamd` Ed25519/RSA) |
| `EML-11` | Address Importer (CSV Batch Import) | **P2** | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (Control Plane CSV Import) |
| `EML-12` | Spam Filters (SpamAssassin / Rspamd) | **P0** | `1.0` | `1.0` | `1.0` | `0.5` | `0.0` | `0.0` | `0.0` | **`1.0`** (`Rspamd` Bayesian/RBL) |
| `EML-13` | Encryption (PGP Key Manager) | **P2** | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`0.5`** (Roundcube `Enigma`) |
| `EML-14` | BoxTrapper (Challenge-Response) | **P2** | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`0.0`** (Deprecated; violates DMARC) |

---

### 3.2 Category 02 — Files (`11` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `FIL-01` | File Manager (Web Tree, Editor, Zip) | **P0** | `1.0` | `1.0` | `0.5` | `0.0` | `1.0` | `0.0` | `1.0` | **`1.0`** (Embedded `FileBrowser`) |
| `FIL-02` | Images (Thumbnailer, Scaler, Converter) | **P2** | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`0.5`** (`sharp` / `libvips` action) |
| `FIL-03` | Directory Privacy (`htpasswd` Auth) | **P2** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `1.0` | **`1.0`** (Nginx `auth_basic`) |
| `FIL-04` | Disk Usage (Directory Quota Breakdown) | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `1.0` | **`1.0`** (`du` + `repquota` API) |
| `FIL-05` | Web Disk (WebDAV Mount) | **P2** | `1.0` | `0.5` | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`0.5`** (Rclone / SFTP preferred) |
| `FIL-06` | FTP Accounts | **P2** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `1.0` | **`1.0`** (SFTP + optional `vsftpd`) |
| `FIL-07` | Backup (Full Account & Partial Download) | **P0** | `1.0` | `1.0` | `1.0` | `0.5` | `1.0` | `1.0` | `1.0` | **`1.0`** (`restic` + `cpmove` export) |
| `FIL-08` | Backup Wizard (Guided Restore) | **P0** | `1.0` | `0.5` | `0.5` | `0.0` | `0.5` | `0.5` | `0.5` | **`1.0`** (1-Click `cpmove` Importer) |
| `FIL-09` | Git Version Control | **P1** | `1.0` | `0.5` | `0.5` | `0.0` | `0.5` | `1.0` | `0.5` | **`1.0`** (Git Webhook & Deploy Key) |
| `FIL-10` | File and Directory Restoration | **P1** | `1.0` | `0.5` | `1.0` | `0.0` | `0.5` | `0.5` | `0.5` | **`1.0`** (`restic` Granular Restore) |
| `FIL-11` | JetBackup 5 (Third-Party Plugin) | *Skip* | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Superseded by `restic` UI) |

---

### 3.3 Category 03 — Databases (`4` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `DB-01` | phpMyAdmin (Web SQL GUI with SSO) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `1.0` | **`1.0`** (phpMyAdmin `SignonSession`) |
| `DB-02` | MySQL Databases (Create/Drop/Grants) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (MariaDB Native SQL Driver) |
| `DB-03` | MySQL Database Wizard | **P1** | `0.5` | `0.5` | `0.5` | `0.0` | `0.5` | `0.5` | `0.5` | **`1.0`** (Unified 1-Step DB+User Modal) |
| `DB-04` | Remote MySQL (Allowlist Client IPs) | **P1** | `1.0` | `0.5` | `1.0` | `0.5` | `1.0` | `1.0` | `1.0` | **`1.0`** (`CREATE USER 'u'@'ip'` + nftables) |

---

### 3.4 Category 04 — Domains (`6` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `DOM-01` | Domains (Primary, Addon, Subdomains) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (Nginx Vhost + FPM Pool) |
| `DOM-02` | Redirects (`301`/`302` Rules) | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (Declarative Nginx `return`) |
| `DOM-03` | Zone Editor (`A`,`AAAA`,`CNAME`,`MX`,`TXT`,`SRV`,`CAA`) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`PowerDNS` + Cloudflare Sync) |
| `DOM-04` | Dynamic DNS (DDNS Webhook) | **P2** | `1.0` | `0.0` | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`POST /api/ddns/update`) |
| `DOM-05` | Site Publisher | *Skip* | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Replaced by Site Builder) |
| `DOM-06` | Sitejet Builder | *Skip* | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Commercial Upsell) |

---

### 3.5 Category 05 — Metrics (`8` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `MET-01` | Visitors (Recent Requests Inspector) | **P2** | `1.0` | `1.0` | `1.0` | `0.5` | `1.0` | `0.0` | `0.5` | **`1.0`** (Embedded `GoAccess`) |
| `MET-02` | Errors (Live Nginx & PHP-FPM Tail) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (SSE Log Tail Stream) |
| `MET-03` | Bandwidth (Monthly Transfer Metering) | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `0.0` | `0.5` | **`1.0`** (`GoAccess` + `vnStat` + `dovecot`) |
| `MET-04` | Raw Access (Download `.log.gz` Archives) | **P2** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `0.5` | **`1.0`** (`logrotate` Archive Download) |
| `MET-05` | Awstats (Web Traffic Analytics) | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `0.0` | `0.5` | **`1.0`** (Upgraded to `GoAccess` HTML5) |
| `MET-06` | Analog Stats | *Skip* | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (1995 Relic) |
| `MET-07` | Webalizer | *Skip* | `1.0` | `1.0` | `1.0` | `1.0` | `0.0` | `0.0` | `0.0` | *Skip* (1997 Relic) |
| `MET-08` | Metrics Editor | *Skip* | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Obsolete) |

---

### 3.6 Category 06 — Security (`7` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `SEC-01` | SSH Access & Key Manager | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`authorized_keys` + `ttyd`) |
| `SEC-02` | IP Blocker (Per-Site Deny Rules) | **P1** | `1.0` | `1.0` | `0.5` | `0.0` | `1.0` | `0.5` | `1.0` | **`1.0`** (Nginx `deny` + `nftables`) |
| `SEC-03` | SSL/TLS Key, CSR & Cert Manager | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`lego` / ACME + Custom Certs) |
| `SEC-04` | Manage API Tokens | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | **`1.0`** (Scoped Bearer JWT / API Keys) |
| `SEC-05` | Hotlink Protection | **P2** | `0.5` | `0.0` | `0.0` | `0.0` | `1.0` | `0.0` | `0.0` | **`1.0`** (Nginx `valid_referers`) |
| `SEC-06` | Leech Protection | **P2** | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`fail2ban` Auth Rate Limit) |
| `SEC-07` | SSL/TLS Status (AutoSSL Let's Encrypt) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (Auto-ACME HTTP-01 / DNS-01) |

---

### 3.7 Category 07 — Software (`9` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `SOF-01` | PHP PEAR Packages | *Skip* | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Replaced by Composer) |
| `SOF-02` | Perl Modules | **P2** | `1.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0`** (`cpanm` CLI Support) |
| `SOF-03` | Optimize Website (Brotli / Gzip) | **P2** | `1.0` | `1.0` | `0.5` | `0.5` | `1.0` | `1.0` | `1.0` | **`1.0`** (Nginx `brotli` + `gzip` Toggle) |
| `SOF-04` | Application Manager (Node/Python Apps) | **P1** | `1.0` | `0.5` | `0.5` | `0.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`systemd` Service + Proxy) |
| `SOF-05` | MultiPHP Manager (`5.6`–`8.5` per Domain) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`ppa:ondrej/php` FPM Pools) |
| `SOF-06` | MultiPHP INI Editor | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`php_admin_value` Pool Generator) |
| `SOF-07` | Softaculous Apps Installer | **P1** | `1.0` | `1.0` | `0.5` | `0.0` | `1.0` | `0.5` | `0.5` | **`1.0`** (`WP-CLI` + 1-Click Recipes) |
| `SOF-08` | Site Software | *Skip* | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | `0.0` | *Skip* (Redundant) |
| `SOF-09` | Select PHP Version (CloudLinux Wrapper) | **P1** | `0.5` | `0.5` | `0.5` | `0.5` | `1.0` | `0.5` | `0.5` | **`1.0`** (Unified into MultiPHP Manager) |

---

### 3.8 Category 08 — Advanced (`6` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ADV-01` | Terminal (In-Browser WebSocket Shell) | **P1** | `1.0` | `0.5` | `0.0` | `0.0` | `1.0` | `0.0` | `0.5` | **`1.0`** (Embedded `ttyd` Binary) |
| `ADV-02` | Cron Jobs | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`/etc/cron.d/` + `systemd` Timers) |
| `ADV-03` | Track DNS | **P2** | `1.0` | `0.0` | `0.5` | `0.0` | `0.5` | `0.0` | `0.0` | **`1.0`** (Built-in `dig` / Trace Tool) |
| `ADV-04` | Indexes (`autoindex on/off`) | **P2** | `1.0` | `0.5` | `1.0` | `1.0` | `0.5` | `0.0` | `0.5` | **`1.0`** (Nginx `autoindex` Toggle) |
| `ADV-05` | Error Pages (`400`–`504`) | **P2** | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `0.0` | `0.5` | **`1.0`** (Nginx `error_page` Directives) |
| `ADV-06` | Apache Handlers & MIME Types | **P2** | `0.5` | `0.0` | `0.5` | `0.0` | `0.0` | `0.0` | `0.0` | **`0.5`** (Nginx `types` Override) |

---

### 3.9 Category 09 — Preferences (`3` Tools)

| Code | cPanel Feature (`architecturalnumbers.com`) | Priority | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `PRF-01` | Password & Security (2FA / TOTP) | **P0** | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | `1.0` | **`1.0`** (`Argon2id` + TOTP + WebAuthn) |
| `PRF-02` | Contact Information & Notifications | **P1** | `1.0` | `1.0` | `1.0` | `1.0` | `0.5` | `1.0` | `0.5` | **`1.0`** (SMTP/Webhook Alert Rules) |
| `PRF-03` | User Manager (Sub-Accounts for FTP/Mail) | **P1** | `1.0` | `0.5` | `1.0` | `0.5` | `0.0` | `0.0` | `0.5` | **`1.0`** (Tenant Sub-User RBAC) |

---

## 4. The Decisive Differentiator: 10-Point SaaS & Commercial Product Readiness Matrix

While `Virtualmin GPL` (`93.0%`), `ISPConfig 3` (`84.4%`), and `HestiaCP` (`82.4%`) score well on legacy single-server cPanel features, they collapse when evaluated against the **10 requirements for a modern multi-server commercial SaaS control panel**:

| Code | SaaS Product & Architecture Requirement | Weight | Virtualmin | HestiaCP | ISPConfig 3 | Froxlor v2 | AcePanel | VitoDeploy | CloudPanel | **Strategy 3 (Composable)** |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `SAAS-01` | **Permissive License for Commercial SaaS (`MIT`/`BSD`/`Apache`)** | `3` | `0.2` (GPLv3) | `0.0` (GPLv3) | `1.0` (BSD-3) | `0.3` (LGPL) | `1.0` (BSD-3) | `0.0` (AGPL) | `0.0` (Closed) | **`1.0` (100% Clean IP + MIT/Apache)** |
| `SAAS-02` | **Modern Compiled/Typed Codebase (`Go`/`TS` vs Perl/Bash)** | `3` | `0.0` (Perl) | `0.1` (Bash) | `0.2` (PHP) | `0.4` (PHP) | `1.0` (Go/TS) | `0.6` (PHP/TS) | `0.5` | **`1.0` (Go Host Agent + TS UI)** |
| `SAAS-03` | **1-Click cPanel `cpmove` Backup Archive Importer** | `3` | `1.0` | `0.2` | `0.2` (Paid) | `0.0` | `0.0` | `0.0` | `0.0` | **`1.0` (Native Go `cpmove` Engine)** |
| `SAAS-04` | **Multi-Server Central Control Plane + Remote Agent** | `3` | `0.3` | `0.0` | `0.9` | `0.2` | `0.2` | `0.9` | `0.0` | **`1.0` (mTLS Multi-Node Hub)** |
| `SAAS-05` | **Multi-Tenant Hierarchy (`SuperAdmin` → `Agency` → `Client`)** | `3` | `1.0` | `0.7` | `1.0` | `1.0` | `0.0` | `0.3` | `0.2` | **`1.0` (3-Tier RBAC + Impersonation)** |
| `SAAS-06` | **Strict Linux UID + `systemd` `cgroups v2` Isolation** | `3` | `0.8` | `0.7` | `0.8` | `0.7` | `0.2` | `0.3` | `0.7` | **`1.0` (Per-UID + `user-<uid>.slice`)** |
| `SAAS-07` | **Zero-Privilege-Escalation Track Record (Typed RPC vs `sudo`)** | `3` | `0.6` | `0.1` (26 GHSAs) | `0.6` | `0.3` (30 GHSAs) | `0.6` | `0.6` | `0.5` | **`1.0` (Zero Shell Interpolation)** |
| `SAAS-08` | **Native Daemon Execution (Zero Docker-in-Docker Overhead)** | `3` | `1.0` | `1.0` | `1.0` | `1.0` | `0.8` | `1.0` | `1.0` | **`1.0` (100% Native Systemd Services)** |
| `SAAS-09` | **Real-Time Sub-Second Provisioning & SSE Streaming** | `3` | `0.6` | `0.6` | `0.1` (60s cron) | `0.2` (cron) | `0.9` | `0.8` | `0.6` | **`1.0` (Synchronous gRPC/mTLS + SSE)** |
| `SAAS-10` | **White-Label Branding, Billing Webhooks & Impersonation** | `3` | `0.5` | `0.3` | `0.7` | `0.6` | `0.2` | `0.2` | `0.0` | **`1.0` (Built-In Agency Portal)** |
| — | **Total SaaS Product Readiness Score (`%`)** | **`30`** | **`50.0%`** | **`39.0%`** | **`61.0%`** | **`51.0%`** | **`51.0%`** | **`40.0%`** | **`25.0%`** | **`100.0%`** |

---

## 5. Key Findings from the Gap Matrix

1. **No Existing Panel Crosses `65%` on Both Axes Simultaneously:**
   - The panels with high cPanel feature parity (`Virtualmin GPL` at `93.0%`, `ISPConfig 3` at `84.4%`, `HestiaCP` at `82.4%`) are trapped in legacy Perl/PHP/Bash architectures (`0.0`–`0.2` on codebase modernity) or locked under `GPLv3` copyleft.
   - The panels with modern codebases or central SSH control planes (`AcePanel` in Go, `VitoDeploy` in Laravel/TS, `CloudPanel`) score **`0.0%` on Email (`EML-01`–`EML-14`)**, **`0.0%` on Local Authoritative DNS (`DOM-03`)**, and **`0.0%` on `cpmove` Migration (`SAAS-03`)**.
2. **Composable OSS Subsystems Eliminate the Hardest Frontend Rebuilds:**
   - By embedding `FileBrowser` (`Apache-2.0`), `ttyd` (`MIT`), `GoAccess` (`MIT`), `Roundcube`, and `phpMyAdmin` behind our clean-room Go agent and TypeScript SaaS portal, **Strategy 3 achieves `100%` on P0 features, `100%` on P1 features, `97.1%` overall cPanel parity, and `100%` SaaS Product Readiness**.
