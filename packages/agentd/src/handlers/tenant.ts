import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';
import type { AgentServer } from '../index.ts';
import {
  TenantCreateParamsSchema,
  TenantUpdateLimitsParamsSchema,
  TenantSuspendParamsSchema,
  TenantResumeParamsSchema,
  TenantDeleteParamsSchema,
  type TenantCreateParams,
  type TenantCreateResult,
  type TenantUpdateLimitsParams,
  type TenantUpdateLimitsResult,
  type TenantSuspendParams,
  type TenantSuspendResult,
  type TenantResumeParams,
  type TenantResumeResult,
  type TenantDeleteParams,
  type TenantDeleteResult,
} from '@cpanel-clean-room/shared';

const RESERVED_USERS = new Set([
  'root',
  'admin',
  'sudo',
  'mysql',
  'bind',
  'postfix',
  'dovecot',
  'rspamd',
  'panelweb',
  'www-data',
  'nobody',
]);

export class TenantHandler {
  sysroot: SysrootEngine;

  constructor(sysroot: SysrootEngine) {
    this.sysroot = sysroot;
  }

  public async create(params: TenantCreateParams): Promise<TenantCreateResult> {
    const { username, shell = '/bin/bash', plan } = params;

    if (RESERVED_USERS.has(username.toLowerCase())) {
      const err: any = new Error(`Cannot create tenant with reserved system username '${username}'`);
      err.code = 'INVALID_PARAMS';
      throw err;
    }

    const { uid, gid } = params.uid
      ? { uid: params.uid, gid: params.uid }
      : this.sysroot.getTenantUidGid(username);

    const homeDir = params.homeDir || `/home/${username}`;

    // 1. Scaffolding / User Provisioning
    if (!this.sysroot.isSandbox()) {
      await this.sysroot.execCommand('useradd', [
        '-m',
        '-s',
        shell,
        '-d',
        homeDir,
        '-u',
        String(uid),
        username,
      ]);
    } else {
      this.sysroot.ensureDir(homeDir);
      this.sysroot.ensureDir(path.join(homeDir, 'public_html'));
      this.sysroot.ensureDir(path.join(homeDir, 'mail'));
      this.sysroot.ensureDir(path.join(homeDir, 'backups'));
    }

    // 2. cgroups v2 slice configuration
    const sliceContent = `[Unit]
Description=User Slice for Tenant ${username} (UID ${uid})
Before=slices.target

[Slice]
CPUAccounting=yes
CPUQuota=${plan?.cpuQuota || '200%'}
MemoryAccounting=yes
MemoryMax=${plan?.memoryMax || '2G'}
TasksAccounting=yes
TasksMax=${plan?.tasksMax || 150}
`;
    this.sysroot.atomicWriteFile(`/etc/systemd/system/user-${uid}.slice`, sliceContent, {
      mode: 0o644,
    });
    await this.sysroot.execCommand('systemctl', ['daemon-reload']);

    // 3. Disk quota
    if (plan?.diskQuotaBytes) {
      const quotaKb = Math.ceil(plan.diskQuotaBytes / 1024);
      await this.sysroot.execCommand('setquota', [
        '-u',
        username,
        String(quotaKb),
        String(quotaKb),
        '0',
        '0',
        '/home',
      ]);
    }

    return {
      uid,
      gid,
      homeDir,
      sliceCreated: true,
    };
  }

  public async updateLimits(params: TenantUpdateLimitsParams): Promise<TenantUpdateLimitsResult> {
    const { username, plan } = params;
    const { uid } = this.sysroot.getTenantUidGid(username);

    const slicePath = `/etc/systemd/system/user-${uid}.slice`;
    let currentSlice = '';
    if (this.sysroot.exists(slicePath)) {
      currentSlice = this.sysroot.readFile(slicePath);
    } else {
      currentSlice = `[Unit]\nDescription=User Slice for Tenant ${username} (UID ${uid})\nBefore=slices.target\n\n[Slice]\n`;
    }

    if (plan.cpuQuota) {
      currentSlice = currentSlice.replace(/CPUQuota=.*(\r?\n|$)/, '') + `CPUQuota=${plan.cpuQuota}\n`;
    }
    if (plan.memoryMax) {
      currentSlice = currentSlice.replace(/MemoryMax=.*(\r?\n|$)/, '') + `MemoryMax=${plan.memoryMax}\n`;
    }
    if (plan.tasksMax) {
      currentSlice = currentSlice.replace(/TasksMax=.*(\r?\n|$)/, '') + `TasksMax=${plan.tasksMax}\n`;
    }

    this.sysroot.atomicWriteFile(slicePath, currentSlice, { mode: 0o644 });
    await this.sysroot.execCommand('systemctl', ['daemon-reload']);

    if (plan.diskQuotaBytes) {
      const quotaKb = Math.ceil(plan.diskQuotaBytes / 1024);
      await this.sysroot.execCommand('setquota', [
        '-u',
        username,
        String(quotaKb),
        String(quotaKb),
        '0',
        '0',
        '/home',
      ]);
    }

    return { updated: true };
  }

  public async suspend(params: TenantSuspendParams): Promise<TenantSuspendResult> {
    const { username, reason = 'Administrative suspension' } = params;
    const suspendedMarker = `/home/${username}/.suspended`;
    this.sysroot.atomicWriteFile(
      suspendedMarker,
      JSON.stringify({ reason, timestamp: new Date().toISOString() }) + '\n',
      { mode: 0o600 }
    );

    await this.sysroot.execCommand('usermod', ['-L', username]);
    return { suspended: true };
  }

  public async resume(params: TenantResumeParams): Promise<TenantResumeResult> {
    const { username } = params;
    const suspendedMarker = `/home/${username}/.suspended`;
    this.sysroot.removeFile(suspendedMarker);

    await this.sysroot.execCommand('usermod', ['-U', username]);
    return { suspended: false };
  }

  public async delete(params: TenantDeleteParams): Promise<TenantDeleteResult> {
    const { username, purgeHome = false } = params;
    const { uid } = this.sysroot.getTenantUidGid(username);

    // Stop tenant slice/processes
    await this.sysroot.execCommand('systemctl', ['kill', `user-${uid}.slice`]);

    const slicePath = `/etc/systemd/system/user-${uid}.slice`;
    this.sysroot.removeFile(slicePath);
    await this.sysroot.execCommand('systemctl', ['daemon-reload']);

    if (!this.sysroot.isSandbox()) {
      const userdelArgs = purgeHome ? ['-r', username] : [username];
      await this.sysroot.execCommand('userdel', userdelArgs);
    } else {
      if (purgeHome) {
        const homeDir = this.sysroot.resolve(`/home/${username}`);
        if (fs.existsSync(homeDir)) {
          fs.rmSync(homeDir, { recursive: true, force: true });
        }
      }
    }

    return { deleted: true };
  }
}

export function registerTenantHandlers(server: AgentServer): void {
  const handler = new TenantHandler(server.getSysroot());

  server.registerHandler('tenant.create', (p) => handler.create(p), TenantCreateParamsSchema);
  server.registerHandler('tenant.updateLimits', (p) => handler.updateLimits(p), TenantUpdateLimitsParamsSchema);
  server.registerHandler('tenant.suspend', (p) => handler.suspend(p), TenantSuspendParamsSchema);
  server.registerHandler('tenant.resume', (p) => handler.resume(p), TenantResumeParamsSchema);
  server.registerHandler('tenant.delete', (p) => handler.delete(p), TenantDeleteParamsSchema);
}
