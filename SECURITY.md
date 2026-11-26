# Security Policy

## 1. Security Architecture Principles

As documented in [`docs/08-empirical-open-source-codebase-and-security-audit.md`](docs/08-empirical-open-source-codebase-and-security-audit.md) and [`docs/11-architecture-decision-records-and-mvp-spec.md`](docs/11-architecture-decision-records-and-mvp-spec.md), legacy open-source control panels have suffered from recurring privilege-escalation vulnerabilities caused by running web interfaces as `root` or invoking `sudo` Bash scripts with string-interpolated arguments.

**cPanel Clean-Room** enforces four non-negotiable security boundaries:

1. **Least-Privilege Process Separation (`ADR-02`):**
   - `packages/server` (the HTTP REST API, WebSocket server, and static SPA host) runs as an unprivileged service user (`panelweb`).
   - `packages/agentd` (the privileged OS provisioning daemon) runs as `root` and listens exclusively on a local `0600` Unix domain socket (`/run/panel/agent.sock`).
2. **Strict Zod RPC Schema Validation & Zero Shell Interpolation:**
   - Every message sent over `/run/panel/agent.sock` is validated against strict Zod schemas (`packages/shared/src/rpc-schema.ts`).
   - System binaries (`nginx`, `rndc`, `postmap`, `sievec`, `setquota`, `systemctl`) are invoked strictly via `execFile` argument arrays—never via `sh -c` or string concatenation.
3. **Symlink & Path-Traversal Containment (`SysrootEngine`):**
   - All tenant file operations (`files.*`, `cpmove.*`) verify real canonical paths (`fs.realpathSync`) against the tenant's home directory boundary (`/home/<username>`) and reject symlink escapes or tar-slip archive entries.
4. **Modern Cryptographic Defaults:**
   - User and mailbox passwords use `scrypt` / `Argon2id` Dovecot-compatible hashes.
   - Two-Factor Authentication enforces RFC 6238 TOTP with monotonic `last_totp_step` replay protection.
   - Multi-tenant impersonation actions (`x-impersonate-user`) verify hierarchical RBAC permissions and record immutable audit log entries.

---

## 2. Supported Versions

| Version | Supported |
| :--- | :---: |
| `1.0.x` (`main`) | ✅ Yes |

---

## 3. Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, please report suspected vulnerabilities privately via **[GitHub Private Vulnerability Reporting](https://github.com/rbaindourov/cpanel-clean-room/security/advisories/new)** on this repository.

Include:
- Affected package and file path (e.g., `packages/agentd/src/handlers/files.ts`).
- Step-by-step reproduction or proof-of-concept test case.
- Impact assessment (e.g., cross-tenant boundary read/write, privilege escalation, authentication bypass).

We aim to acknowledge all security reports within **48 hours** and release a verified patch and regression test within **7 days**.
