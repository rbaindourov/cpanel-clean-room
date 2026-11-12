# cPanel Clean-Room Functional Specification & Open-Source Modernization

This repository contains the complete clean-room reverse-engineering analysis, live visual audit, open-source control panel evaluation, and native Linux hosting architecture designed to transition client **Vahag Kazanchyan** (`architecturalnumbers.com`, `trace4less.com`, `westonletters.com`) off commercial cPanel licensing.

---

## 📚 Documentation Index

1. [`docs/01-executive-summary-and-strategy.md`](docs/01-executive-summary-and-strategy.md)  
   **Executive Summary & Hosting Strategy**: Cost analysis of cPanel licensing markups and introductory price hikes vs. native Linux ownership; definition of Vahag's core workload requirements; dual-track roadmap (Track A: Turnkey VPS via Virtualmin GPL / HestiaCP; Track B: Native WinWinHost control plane).

2. [`docs/02-hostgator-cpanel-feature-inventory.md`](docs/02-hostgator-cpanel-feature-inventory.md)  
   **Feature Inventory & Linux Primitive Mapping**: Comprehensive categorization of all 68 tools discovered on HostGator cPanel (Jupiter theme); mapping of every tool to its underlying cPanel UAPI module and native Linux system primitives (`/etc/bind`, `/etc/nginx`, `/etc/postfix`, `/etc/dovecot`, `/run/php/*.sock`, `/var/run/mysqld/mysqld.sock`); priority tiers (`P0`, `P1`, `P2`, `Skip`).

3. [`docs/03-visual-walkthrough-and-ui-anatomy.md`](docs/03-visual-walkthrough-and-ui-anatomy.md)  
   **Visual Walkthrough & UI Anatomy**: Deep UI walkthrough embedding high-resolution, redacted reference screenshots from `docs/screenshots/`; analysis of Jupiter UX patterns worth preserving (quick search `/`, right-rail telemetry, deliverability verification) vs. anti-patterns to eliminate (third-party upsell banners, screen fragmentation).

4. [`docs/04-open-source-control-panel-evaluation.md`](docs/04-open-source-control-panel-evaluation.md)  
   **Open-Source Control Panel Evaluation**: Architectural and security evaluation of native (non-Docker) open-source panels: **Webmin + Virtualmin GPL + Usermin**, **ISPConfig 3**, **HestiaCP**, and **Froxlor**; explicit disqualification rationale for Docker-bound or closed-source panels; 16-point feature parity matrix against HostGator cPanel.

5. [`docs/05-webmin-virtualmin-migration-and-customization-playbook.md`](docs/05-webmin-virtualmin-migration-and-customization-playbook.md)  
   **Virtualmin Migration & Customization Playbook**: Step-by-step native LEMP installation runbook on Ubuntu 22.04/24.04 LTS; side-by-side Multi-PHP configuration (`PHP 7.2` for legacy `trace4less.com` + modern `PHP 8.4-FPM` for `architecturalnumbers.com`); native `cpmove` cPanel backup importer; Authentic Theme lockdown and white-labeling; zero-downtime DNS cutover runbook.

6. [`docs/06-clean-room-winwinhost-control-panel-architecture.md`](docs/06-clean-room-winwinhost-control-panel-architecture.md)  
   **Clean-Room WinWinHost Control Panel Architecture ("WinWinPanel")**: Complete system specification integrating into WinWinHost's multi-server cluster (`.32` Web/DNS/DB/Vault, `.24` Mail, `.25` `solidstate` Job Runner); unprivileged control plane UI + schema-validated root daemon over Unix socket; RBAC binding to `users_backend` (`:3030`); sub-system specs for Web, DNS, MySQL, SFTP, Mail, and off-host backups.

---

## 🗂️ Audit Data & Visual Reference Assets

* **Feature Manifest**: [`docs/data/cpanel_feature_manifest.json`](docs/data/cpanel_feature_manifest.json)  
  * Raw, sanitized JSON export capturing server environment variables, installed PHP versions (`ea-php81` through `ea-php85`, `alt-php56`), active databases (`vahag_architecturalnumbers`, `vahag_trace4less`), and all 68 discovered UI tool links.
* **Screenshot Library**: [`docs/screenshots/`](docs/screenshots/)  
  * 43 redacted, high-resolution desktop captures categorized into `00-overview/`, `01-email/`, `02-files/`, `03-databases/`, `04-domains/`, `05-metrics/`, `06-security/`, `07-software/`, `08-advanced/`, and `09-preferences/`.
* **Screenshot Manifest**: [`docs/screenshots/index.json`](docs/screenshots/index.json)  
  * Machine-readable index recording filenames, categories, SHA-256 hashes, byte sizes, and HTTP response codes.

---

## 🛠️ Verification & Tooling

To run the automated verification and security audit suite:

```bash
# Verify all markdown links, screenshot integrity, and secret redactions
npm run verify

# Re-run read-only cPanel UAPI feature inventory (requires .env)
npm run inventory

# Re-run Playwright screenshot crawler with automated DOM privacy masking
npm run screenshots
```
