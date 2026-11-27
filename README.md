# cPanel Clean-Room — Open-Source Native Linux Web Hosting Control Panel

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Live Interactive Demo](https://img.shields.io/badge/Live_Demo-robertscreations.com%2Fcleanpanel-amber)](https://robertscreations.com/cleanpanel/)

**cPanel Clean-Room** (`CleanPanel`) is an open-source, MIT-licensed native Linux web hosting control panel appliance and empirical clean-room specification designed to replace commercial cPanel/WHM installations without Docker overhead or legacy Perl/Bash security debt.

It combines a **100% TypeScript / Node.js 22 LTS monorepo** (`@cpanel-clean-room/shared`, `@cpanel-clean-room/agentd`, `@cpanel-clean-room/server`, `@cpanel-clean-room/web`) with a comprehensive **12-part clean-room reverse-engineering specification and 11-repository empirical competitor gap audit**.

> **Live Interactive Browser Sandbox & Architecture Case Study:**
> - **Playable Browser Sandbox (`VITE_DEMO_MODE`)**: [https://robertscreations.com/cleanpanel/](https://robertscreations.com/cleanpanel/)
> - **Systems Architecture Deep-Dive**: [https://robertscreations.com/cpanel-clean-room-open-source-linux-hosting-control-panel](https://robertscreations.com/cpanel-clean-room-open-source-linux-hosting-control-panel)

---

## ✨ Key Architectural Highlights

- **Least-Privilege Process Separation (`ADR-02`):** The unprivileged HTTP/WebSocket server (`packages/server`) never runs as `root`. All privileged OS operations execute inside `panel-agentd` (`packages/agentd`) over a local `0600` NDJSON Unix domain socket (`/run/panel/agent.sock`) validated by strict Zod schemas and `execFile` argument arrays (zero shell string interpolation).
- **Dual-Mode `PANEL_SYSROOT` Sandbox & Production Engine (`ADR-11`):**
  - **Sandbox Mode (`PANEL_SYSROOT=./scratch/sysroot`)**: Safely generates and tests real Nginx vhosts, Multi-PHP FPM pools (`5.6`–`8.5`), RFC 1035 BIND9 zones, Postfix/Dovecot mail configs, Rspamd DKIM keys, and user files on any developer workstation without touching host `/etc`.
  - **Production Mode (`PANEL_SYSROOT=/`)**: Manages native Linux daemons on Ubuntu 22.04/24.04 LTS & Debian 12 servers.
- **Unified Single-Port Jupiter SPA (`ADR-03`, `ADR-07`, `ADR-08`):** React 18 + Vite 6 + Tailwind CSS interface with `/` hotkey instant search across 77 tools, 3-tier RBAC (`Admin` → `Reseller` → `Customer`), 1-click user impersonation, a built-in **File Manager + Monaco Code Editor**, and an embedded **`@xterm/xterm` WebSocket Terminal**.
- **1-Click `cpmove` Migration & `restic` Cloud Backups (`ADR-09`):** Streams and restores standard cPanel `cpmove-<user>.tar.gz` / `backup-*.tar.gz` archives (preserving domains, MariaDB dumps, Dovecot password hashes, Maildirs, and BIND9 zones) alongside deduplicated `restic` snapshots.

---

## 🚀 Quick Start (Local Sandbox Mode)

```bash
git clone https://github.com/rbaindourov/cpanel-clean-room.git
cd cpanel-clean-room
npm install

# Run full TypeScript build check, 170 unit tests, 450 E2E tests, and repo integrity check
npm run build
npm run test:all
npm run verify

# Start the pre-seeded appliance locally on http://127.0.0.1:3000
npm start
```

### Default Sandbox Accounts
| Role | Username | Password | Pre-Seeded Workloads (`./scratch/sysroot`) |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123!` | Full server & account administration + 1-click customer impersonation |
| **Customer** | `acme` | `acme123!` | Domains (`example-store.com`, `legacy-crm.org`, `directory-hub.net`, `studio-letters.com`), MySQL DBs (`acme_store`, `acme_crm`), Mailboxes, BIND9 zones, and Multi-PHP (`7.4`, `8.1`, `8.2`) pools |

---

## 📦 Monorepo Package Structure

| Package | Path | Description |
| :--- | :--- | :--- |
| **`@cpanel-clean-room/shared`** | [`packages/shared/`](packages/shared/) | Shared TypeScript interfaces, 24 Zod RPC schemas, constants, and deterministic Apache `.htaccess`-to-Nginx rule translator |
| **`@cpanel-clean-room/agentd`** | [`packages/agentd/`](packages/agentd/) | Privileged root NDJSON Unix-socket daemon (`SysrootEngine` + 8 handlers: `tenant`, `web-php`, `dns-bind`, `mail-rspamd`, `mysql`, `files`, `wp-toolkit`, `cpmove`) |
| **`@cpanel-clean-room/server`** | [`packages/server/`](packages/server/) | Unprivileged Express REST API + WebSocket PTY server, SQLite WAL database (`19` tables), Argon2id/scrypt + TOTP 2FA, 3-tier RBAC, `phpMyAdmin`/`Roundcube` SSO, and demo dataset seeder |
| **`@cpanel-clean-room/web`** | [`packages/web/`](packages/web/) | Jupiter-modernized React 18 + Vite 6 + Tailwind CSS SPA with Native File Manager, Monaco Code Editor, `@xterm/xterm` Terminal, and 10 category suites |

---

## 📚 Clean-Room Engineering Documentation Suite

1. [`docs/01-executive-summary-and-strategy.md`](docs/01-executive-summary-and-strategy.md) — **Executive Summary & Hosting Strategy**: cPanel licensing economics vs. native Linux ownership, core workload analysis, and dual-track migration roadmap.
2. [`docs/02-hostgator-cpanel-feature-inventory.md`](docs/02-hostgator-cpanel-feature-inventory.md) — **68-Feature Inventory & Linux Primitive Mapping**: Categorization of all 68 cPanel Jupiter tools mapped to cPanel UAPI endpoints, native Linux primitives (`/etc/bind`, `/etc/nginx`, `/etc/postfix`, `/etc/dovecot`, `/run/php/*.sock`), and priority tiers (`P0`, `P1`, `P2`, `Skip`).
3. [`docs/03-visual-walkthrough-and-ui-anatomy.md`](docs/03-visual-walkthrough-and-ui-anatomy.md) — **Visual Walkthrough & UI Anatomy**: Detailed UI walkthrough embedding 43 redacted reference screenshots from [`docs/screenshots/`](docs/screenshots/).
4. [`docs/04-open-source-control-panel-evaluation.md`](docs/04-open-source-control-panel-evaluation.md) — **Open-Source Control Panel Evaluation**: Architectural comparison of native (non-Docker) panels (`Webmin + Virtualmin GPL`, `ISPConfig 3`, `HestiaCP`, `Froxlor`).
5. [`docs/05-webmin-virtualmin-migration-and-customization-playbook.md`](docs/05-webmin-virtualmin-migration-and-customization-playbook.md) — **Virtualmin Migration & Customization Playbook**: Native LEMP setup on Ubuntu 22.04/24.04 LTS, side-by-side Multi-PHP FPM configuration, and `cpmove` backup migration runbook.
6. [`docs/06-clean-room-control-panel-architecture.md`](docs/06-clean-room-control-panel-architecture.md) — **Clean-Room Control Panel Architecture**: Multi-daemon Linux hosting topology, unprivileged UI + schema-validated root Unix socket daemon, and subsystem specifications.
7. [`docs/07-commercial-and-saas-market-landscape.md`](docs/07-commercial-and-saas-market-landscape.md) — **Commercial & SaaS Market Landscape**: Four-quadrant teardown of Legacy Monoliths (`cPanel/WHM`, `Plesk`, `DirectAdmin`), Cluster Panels (`Enhance`, `ApisCP`), Developer SaaS Control Planes (`Laravel Forge`, `RunCloud`, `Ploi.io`, `SpinupWP`), and Closed Freeware (`CloudPanel`, `CyberPanel`).
8. [`docs/08-empirical-open-source-codebase-and-security-audit.md`](docs/08-empirical-open-source-codebase-and-security-audit.md) — **Empirical Open-Source Codebase & Security Audit**: Source-level teardown of 11 repositories measuring exact LOC, CLI/API surface, privilege escalation advisories (`GHSA`/`CVE`), and Copyleft vs. Permissive licensing.
9. [`docs/09-68-feature-competitor-gap-matrix.md`](docs/09-68-feature-competitor-gap-matrix.md) — **68-Feature Competitor Parity & SaaS Readiness Gap Matrix**: Feature-by-feature parity matrix scoring all 68 cPanel tools plus 10 SaaS Product Readiness gates across 7 existing panels and our Clean-Room architecture (`97.1%` cPanel parity, `100%` P0/P1 completion).
10. [`docs/10-build-vs-leverage-decision-blueprint.md`](docs/10-build-vs-leverage-decision-blueprint.md) — **Build vs. Leverage Decision Blueprint & MVP Roadmap**: Head-to-head comparison of 4 engineering strategies, atomic daemon RPC operations, clean-room `cpmove` importer specification, and 8-week MVP build roadmap.
11. [`docs/11-architecture-decision-records-and-mvp-spec.md`](docs/11-architecture-decision-records-and-mvp-spec.md) — **Architecture Decision Records (`ADR-01` to `ADR-11`) & Full-Stack TypeScript MVP Specification**: Canonical specification locking in all 11 architectural decisions.
12. [`docs/12-clean-room-implementation-report.md`](docs/12-clean-room-implementation-report.md) — **Clean-Room Implementation Report & Production `systemd` Runbook**: Unabridged 77-tool feature catalog matrix, test verification metrics, and production deployment guide.

---

## 🗂️ Audit Datasets & Visual Assets

- **Baseline cPanel Feature Manifest**: [`docs/data/cpanel_feature_manifest.json`](docs/data/cpanel_feature_manifest.json)
- **Empirical 11-Repo Competitor Metrics**: [`docs/data/competitor_empirical_metrics.json`](docs/data/competitor_empirical_metrics.json)
- **68-Feature Competitor Gap Matrix**: [`docs/data/competitor_gap_matrix.json`](docs/data/competitor_gap_matrix.json)
- **Redacted Reference Screenshot Library (`43` PNGs)**: [`docs/screenshots/`](docs/screenshots/) & [`docs/screenshots/index.json`](docs/screenshots/index.json)

---

## 🤝 Contributing, Security & License

- **Contributing Guide**: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **Security Policy**: [`SECURITY.md`](SECURITY.md)
- **Code of Conduct**: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- **License**: Released under the [MIT License](LICENSE).
