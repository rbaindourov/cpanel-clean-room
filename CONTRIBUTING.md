# Contributing to cPanel Clean-Room

Thank you for your interest in contributing to **cPanel Clean-Room**, an open-source, MIT-licensed native Linux web hosting control panel built with 100% TypeScript, React, SQLite (WAL), and a schema-validated Unix-socket root daemon.

---

## 1. Architecture & Dual-Mode `PANEL_SYSROOT` Safety

To make local development safe on any workstation without modifying your host OS `/etc` files, `panel-agentd` enforces a strict `PANEL_SYSROOT` boundary:

- **Sandbox Mode (`PANEL_SYSROOT=./scratch/sysroot` — Default for local dev & tests):**
  All generated Nginx virtual hosts, Multi-PHP FPM pools, RFC 1035 BIND9 zones, Postfix/Dovecot mail configs, Rspamd DKIM keys, and user home directories are written inside `./scratch/sysroot/`.
- **Production Mode (`PANEL_SYSROOT=/` — Target Ubuntu 22.04/24.04 or Debian 12 VPS):**
  Writes directly to system paths (`/etc/nginx`, `/etc/php`, `/etc/bind`, `/etc/postfix`, `/etc/dovecot`, `/home/<user>`) and invokes native service reloads via `execFile` argument arrays (zero shell interpolation).

---

## 2. Local Development Setup

### Prerequisites
- **Node.js 22 LTS** or newer (supports `--experimental-strip-types` natively)
- **npm 10+**

### Install & Verify
```bash
git clone https://github.com/rbaindourov/cpanel-clean-room.git
cd cpanel-clean-room
npm install

# Run full TypeScript typecheck across all packages
npm run build

# Run unit & adversarial security test suites (170+ tests)
npm test

# Run 4-tier end-to-end test suite (450+ tests)
npm run test:e2e

# Run documentation & secret-scrubbing verification gate
npm run verify
```

### Start the Appliance Locally (Sandbox Mode)
```bash
npm start
```
The panel starts on `http://127.0.0.1:3000` with pre-seeded demo accounts (`admin`, `reseller`, and customer `acme`).

---

## 3. Coding Standards & Pull Request Checklist

1. **Zero Shell String Interpolation (`ADR-02`):** All OS command execution in `packages/agentd` must use `execFile` / `spawn` with explicit argument arrays and strict Zod schema validation in `packages/shared/src/rpc-schema.ts`. Never use `sh -c` or interpolated shell strings.
2. **Sysroot Containment (`ADR-11`):** Every filesystem operation in `packages/agentd` must resolve paths through `SysrootEngine.resolvePath()` or `SysrootEngine.resolveTenantPath()` to prevent symlink and path-traversal escapes.
3. **Tests Required:** Every new RPC handler, REST endpoint, or UI capability must include unit tests (`packages/*/src/__tests__/`) and pass `npm run test:all` and `npm run verify`.
4. **Conventional Commits:** Format commit titles using conventional commits (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`).
