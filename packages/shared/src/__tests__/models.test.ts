import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type {
  Account,
  Domain,
  DnsZone,
  Mailbox,
  Database,
  Backup,
  SystemStats,
} from '../models.ts';

describe('models.ts Entity Contracts', () => {
  test('Account entity conforms to multi-tenant schema with plan limits', () => {
    const account: Account = {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      username: 'vahag',
      email: 'vahag@architecturalnumbers.com',
      role: 'customer',
      packageName: 'HostGator_Legacy_Gold',
      planLimits: {
        diskQuotaBytes: 107374182400, // 100 GB
        bandwidthLimitBytes: 1099511627776, // 1 TB
        maxDomains: 10,
        maxSubdomains: 50,
        maxDatabases: 10,
        maxMailboxes: 20,
        maxFtpAccounts: 5,
        cpuQuotaPercent: 200,
        memoryMaxBytes: 2147483648,
        tasksMax: 150,
      },
      uid: 1005,
      gid: 1005,
      homeDir: '/home/vahag',
      shell: '/bin/bash',
      suspended: false,
      twoFactorEnabled: false,
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    assert.equal(account.username, 'vahag');
    assert.equal(account.role, 'customer');
    assert.equal(account.planLimits.cpuQuotaPercent, 200);
  });

  test('Domain entity represents primary and addon domains with Multi-PHP versions', () => {
    const primaryDomain: Domain = {
      id: 'dom-001',
      accountId: 'acc-vahag',
      domainName: 'architecturalnumbers.com',
      type: 'primary',
      documentRoot: '/home/vahag/public_html',
      phpVersion: '8.3',
      useApacheBackend: false,
      sslStatus: 'active',
      sslProvider: 'letsencrypt',
      sslExpiresAt: '2027-02-10T00:00:00.000Z',
      forceHttps: true,
      ipAddress: '192.168.11.32',
      aliases: ['www.architecturalnumbers.com'],
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    const addonDomain: Domain = {
      id: 'dom-002',
      accountId: 'acc-vahag',
      domainName: 'trace4less.com',
      type: 'addon',
      documentRoot: '/home/vahag/trace4less.com',
      phpVersion: '7.4',
      useApacheBackend: false,
      sslStatus: 'active',
      sslProvider: 'letsencrypt',
      forceHttps: true,
      ipAddress: '192.168.11.32',
      aliases: ['www.trace4less.com'],
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    assert.equal(primaryDomain.phpVersion, '8.3');
    assert.equal(addonDomain.phpVersion, '7.4');
    assert.equal(primaryDomain.type, 'primary');
    assert.equal(addonDomain.type, 'addon');
  });

  test('Mailbox entity models authentic Vahag mailboxes and Dovecot hashes', () => {
    const mailbox: Mailbox = {
      id: 'mbx-001',
      accountId: 'acc-vahag',
      domainId: 'dom-001',
      email: 'production@architecturalnumbers.com',
      localPart: 'production',
      domain: 'architecturalnumbers.com',
      passwordHash: '{ARGON2ID}$argon2id$v=19$m=65536,t=3,p=4$mockHashProduction',
      quotaBytes: 3145728000, // 3000 MB
      usedBytes: 2567430291,
      suspendedLogin: false,
      suspendedIncoming: false,
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    assert.equal(mailbox.email, 'production@architecturalnumbers.com');
    assert.ok(mailbox.usedBytes < mailbox.quotaBytes);
    assert.equal(mailbox.suspendedLogin, false);
  });

  test('Database entity models authentic prefixed DBs and user grants', () => {
    const database: Database = {
      id: 'db-001',
      accountId: 'acc-vahag',
      databaseName: 'vahag_architecturalnumbers',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      users: [
        {
          username: 'vahag_k',
          remoteHost: 'localhost',
          privileges: ['ALL PRIVILEGES'],
        },
      ],
      sizeBytes: 54759734, // ~54.8 MB
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    assert.equal(database.databaseName, 'vahag_architecturalnumbers');
    assert.equal(database.users[0]?.username, 'vahag_k');
    assert.equal(database.sizeBytes, 54759734);
  });

  test('DnsZone entity models RFC 1035 zone attributes and records', () => {
    const zone: DnsZone = {
      id: 'zone-001',
      domainId: 'dom-001',
      domainName: 'architecturalnumbers.com',
      primaryNs: 'ns1.winwinhost.com.',
      adminEmail: 'hostmaster.winwinhost.com.',
      serial: 2026111201,
      refresh: 10800,
      retry: 3600,
      expire: 604800,
      minimumTtl: 300,
      records: [
        {
          id: 'rec-01',
          domainId: 'dom-001',
          name: '@',
          type: 'A',
          value: '192.168.11.32',
          ttl: 300,
        },
        {
          id: 'rec-02',
          domainId: 'dom-001',
          name: '@',
          type: 'MX',
          value: 'mail.architecturalnumbers.com.',
          ttl: 300,
          priority: 10,
        },
      ],
      syncedCloudflare: false,
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };

    assert.equal(zone.serial, 2026111201);
    assert.equal(zone.records.length, 2);
    assert.equal(zone.records[1]?.type, 'MX');
    assert.equal(zone.records[1]?.priority, 10);
  });

  test('Backup entity models cpmove and restic snapshots', () => {
    const backup: Backup = {
      id: 'bk-001',
      accountId: 'acc-vahag',
      type: 'cpmove',
      status: 'completed',
      fileName: 'cpmove-vahag.tar.gz',
      filePath: '/home/vahag/backups/cpmove-vahag.tar.gz',
      sizeBytes: 154829104,
      destination: 'local',
      progressPercent: 100,
      createdAt: '2026-11-12T00:00:00.000Z',
      completedAt: '2026-11-12T00:02:15.000Z',
    };

    assert.equal(backup.type, 'cpmove');
    assert.equal(backup.status, 'completed');
    assert.equal(backup.progressPercent, 100);
  });

  test('SystemStats entity models appliance health and service states', () => {
    const stats: SystemStats = {
      hostname: 'cleanroom.winwinhost.com',
      os: 'Debian GNU/Linux 12 (bookworm)',
      kernel: '6.1.0-28-amd64',
      uptimeSeconds: 864000,
      loadAverage: [0.12, 0.08, 0.05],
      cpuCount: 8,
      cpuModel: 'AMD EPYC 7763',
      cpuUsagePercent: 4.5,
      memoryTotalBytes: 33658249216,
      memoryUsedBytes: 8589934592,
      memoryFreeBytes: 25068314624,
      swapTotalBytes: 4294967296,
      swapUsedBytes: 0,
      diskTotalBytes: 1000000000000,
      diskUsedBytes: 120000000000,
      diskFreeBytes: 880000000000,
      services: [
        { name: 'nginx', displayName: 'Nginx Web Server', status: 'active', port: 80 },
        { name: 'mariadb', displayName: 'MariaDB SQL Database', status: 'active', port: 3306 },
      ],
    };

    assert.equal(stats.cpuCount, 8);
    assert.equal(stats.services.length, 2);
    assert.equal(stats.services[0]?.status, 'active');
  });
});
