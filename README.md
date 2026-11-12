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

7. [`docs/07-commercial-and-saas-market-landscape.md`](docs/07-commercial-and-saas-market-landscape.md)  
   **Commercial & SaaS Market Landscape**: Four-quadrant teardown of Legacy Monoliths (`cPanel/WHM`, `Plesk`, `DirectAdmin`), Commercial Cluster Panels (`Enhance`, `ApisCP`), Developer SaaS SSH Control Planes (`Laravel Forge`, `RunCloud`, `Ploi.io`, `SpinupWP`), and Closed Freeware (`CloudPanel`, `CyberPanel`), defining the "Missing Middle" product wedge.

8. [`docs/08-empirical-open-source-codebase-and-security-audit.md`](docs/08-empirical-open-source-codebase-and-security-audit.md)  
   **Empirical Open-Source Codebase & Security Audit**: Source-level teardown of 11 shallow-cloned repositories (`HestiaCP`, `Webmin`, `Virtualmin GPL`, `ISPConfig 3`, `Froxlor v2`, `AcePanel`, `VitoDeploy`, `Ajenti 2`, `FileBrowser`, `ttyd`, `GoAccess`) measuring exact LOC, CLI/API counts, privilege escalation advisories (`GHSA`/`CVE`), and Copyleft vs. Permissive SaaS licensing.

9. [`docs/09-68-feature-competitor-gap-matrix.md`](docs/09-68-feature-competitor-gap-matrix.md)  
   **68-Feature Competitor Parity & SaaS Readiness Gap Matrix**: Feature-by-feature parity matrix scoring all 68 HostGator cPanel tools (`P0`/`P1`/`P2`/`Skip`) plus 10 SaaS Product Readiness gates across 7 existing panels and our Composable Clean-Room architecture (`97.1%` cPanel parity, `100%` SaaS fit).

10. [`docs/10-build-vs-leverage-decision-blueprint.md`](docs/10-build-vs-leverage-decision-blueprint.md)  
    **Build vs. Leverage Decision Blueprint & MVP Roadmap**: Head-to-head comparison of 4 engineering strategies (`Fork`, `Headless Bridge`, `Composable OSS + Clean-Room Agent`, `Pure Scratch`), specification of the 22 atomic Go RPC operations in `winwin-agentd`, clean-room `cpmove` backup importer design, and 8-week MVP build roadmap.

---

## 🗂️ Audit Data & Visual Reference Assets

* **Feature Manifest**: [`docs/data/cpanel_feature_manifest.json`](docs/data/cpanel_feature_manifest.json)  
  * Raw, sanitized JSON export capturing server environment variables, installed PHP versions (`ea-php81` through `ea-php85`, `alt-php56`), active databases (`vahag_architecturalnumbers`, `vahag_trace4less`), and all 68 discovered UI tool links.
* **Empirical Competitor Source Metrics**: [`docs/data/competitor_empirical_metrics.json`](docs/data/competitor_empirical_metrics.json)  
  * Programmatically generated source metrics (file counts, LOC by language, CLI/API counts, SPDX licenses, and published GitHub Security Advisories) across 11 open-source repositories.
* **68-Feature Competitor Gap Matrix**: [`docs/data/competitor_gap_matrix.json`](docs/data/competitor_gap_matrix.json)  
  * Machine-readable weighted scoring matrix (`68` cPanel tools + `10` SaaS product readiness dimensions + `4`-strategy effort model).
* **Screenshot Library**: [`docs/screenshots/`](docs/screenshots/)  
  * 43 redacted, high-resolution desktop captures categorized into `00-overview/`, `01-email/`, `02-files/`, `03-databases/`, `04-domains/`, `05-metrics/`, `06-security/`, `07-software/`, `08-advanced/`, and `09-preferences/`.
* **Screenshot Manifest**: [`docs/screenshots/index.json`](docs/screenshots/index.json)  
  * Machine-readable index recording filenames, categories, SHA-256 hashes, byte sizes, and HTTP response codes.

---

## 🛠️ Verification & Tooling

To run the automated verification and security audit suite:

```bash
# Verify all markdown links, JSON datasets, screenshot integrity, and secret redactions
npm run verify

# Re-run empirical open-source repository audit (shallow-clones into scratch/competitor-repos)
npm run audit:competitors

# Re-compute weighted 68-feature competitor gap matrix
npm run score:gaps

# Re-run read-only cPanel UAPI feature inventory (requires .env)
npm run inventory

# Re-run Playwright screenshot crawler with automated DOM privacy masking
npm run screenshots
```
