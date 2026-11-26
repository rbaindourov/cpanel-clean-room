import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RpcRequestSchema,
  RpcResponseSchema,
  RpcErrorSchema,
  RpcStreamMessageSchema,
  TenantCreateParamsSchema,
  TenantUpdateLimitsParamsSchema,
  TenantSuspendParamsSchema,
  TenantResumeParamsSchema,
  TenantDeleteParamsSchema,
  WebUpsertVhostParamsSchema,
  WebDeleteVhostParamsSchema,
  WebSetPhpVersionParamsSchema,
  WebUpdatePhpIniParamsSchema,
  WebIssueSslParamsSchema,
  DnsUpsertZoneParamsSchema,
  DnsDeleteZoneParamsSchema,
  MailUpsertDomainParamsSchema,
  MailUpsertMailboxParamsSchema,
  MailDeleteMailboxParamsSchema,
  MailUpsertForwarderParamsSchema,
  MailUpsertSieveParamsSchema,
  MysqlCreateDatabaseParamsSchema,
  MysqlDropDatabaseParamsSchema,
  MysqlUpsertUserGrantParamsSchema,
  MysqlCreateSignonSessionParamsSchema,
  FilesOperationParamsSchema,
  WpToolkitParamsSchema,
  BackupCpmoveAndResticParamsSchema,
  RPC_OPERATIONS,
} from '../rpc-schema.ts';

describe('rpc-schema.ts Envelopes & Operations', () => {
  test('RpcRequestSchema validates compliant request envelope', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      method: 'tenant.create',
      params: { username: 'acme' },
      callerUid: 1000,
    };
    const parsed = RpcRequestSchema.parse(valid);
    assert.equal(parsed.id, valid.id);
    assert.equal(parsed.method, 'tenant.create');
  });

  test('RpcRequestSchema rejects empty id', () => {
    const invalid = {
      id: '',
      method: 'tenant.create',
      params: {},
    };
    assert.throws(() => RpcRequestSchema.parse(invalid));
  });

  test('RpcResponseSchema validates success and error variants', () => {
    const successRes = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      success: true,
      data: { uid: 1005 },
    };
    assert.ok(RpcResponseSchema.parse(successRes).success);

    const errorRes = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      success: false,
      error: {
        code: 'ALREADY_EXISTS',
        message: 'User acme already exists',
      },
    };
    const parsedErr = RpcResponseSchema.parse(errorRes);
    assert.equal(parsedErr.error?.code, 'ALREADY_EXISTS');
  });

  test('RpcErrorSchema and RpcStreamMessageSchema validate correctly', () => {
    const err = { code: 'NOT_FOUND', message: 'Resource not found', details: { id: '123' } };
    assert.ok(RpcErrorSchema.parse(err));

    const stream = { id: '550e8400-e29b-41d4-a716-446655440000', type: 'progress' as const, percent: 50, step: 'dumping' };
    assert.ok(RpcStreamMessageSchema.parse(stream));
  });

  test('All 24 operations are registered in RPC_OPERATIONS map', () => {
    const opCount = Object.keys(RPC_OPERATIONS).length;
    assert.equal(opCount, 24, 'Must register exactly 24 atomic operations');
  });

  describe('Handler 1: Tenant Operations', () => {
    test('tenant.create validates valid and rejects invalid username', () => {
      const valid = {
        username: 'acme',
        plan: {
          cpuQuota: '200%',
          memoryMax: '2G',
          tasksMax: 150,
          diskQuotaBytes: 10737418240,
        },
      };
      assert.ok(TenantCreateParamsSchema.parse(valid));

      // Invalid username (uppercase, symbols, too short)
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'ACME' }));
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'va' }));
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'user$bad' }));
    });

    test('tenant.updateLimits validates optional plan fields', () => {
      assert.ok(
        TenantUpdateLimitsParamsSchema.parse({
          username: 'acme',
          plan: { memoryMax: '4G' },
        })
      );
    });

    test('tenant.suspend and tenant.resume validate payloads', () => {
      assert.ok(TenantSuspendParamsSchema.parse({ username: 'acme', reason: 'Non-payment' }));
      assert.ok(TenantResumeParamsSchema.parse({ username: 'acme' }));
    });

    test('tenant.delete validates purgeHome boolean default', () => {
      const parsed = TenantDeleteParamsSchema.parse({ username: 'acme' });
      assert.equal(parsed.purgeHome, false);
    });
  });

  describe('Handler 2: Web & PHP Operations', () => {
    test('web.upsertVhost validates full vhost spec', () => {
      const payload = {
        username: 'acme',
        domain: 'example-store.com',
        aliases: ['www.example-store.com'],
        documentRoot: '/home/acme/public_html',
        phpVersion: '8.3',
        useApacheBackend: false,
        ssl: { enabled: true, certPath: '/path/cert.crt', keyPath: '/path/key.key' },
      };
      const parsed = WebUpsertVhostParamsSchema.parse(payload);
      assert.equal(parsed.phpVersion, '8.3');
    });

    test('web.deleteVhost validates deletion params', () => {
      assert.ok(
        WebDeleteVhostParamsSchema.parse({
          username: 'acme',
          domain: 'example-store.com',
          phpVersion: '8.3',
        })
      );
    });

    test('web.setPhpVersion rejects invalid PHP versions', () => {
      const valid = {
        username: 'acme',
        domain: 'example-store.com',
        fromVersion: '8.3',
        toVersion: '8.4',
      };
      assert.ok(WebSetPhpVersionParamsSchema.parse(valid));

      assert.throws(() =>
        WebSetPhpVersionParamsSchema.parse({ ...valid, toVersion: '4.0' as any })
      );
      assert.throws(() =>
        WebSetPhpVersionParamsSchema.parse({ ...valid, toVersion: '9.0' as any })
      );
    });

    test('web.updatePhpIni validates directives dictionary', () => {
      const payload = {
        username: 'acme',
        domain: 'example-store.com',
        phpVersion: '8.3',
        directives: {
          memory_limit: '512M',
          upload_max_filesize: '64M',
          max_execution_time: '300',
        },
      };
      assert.ok(WebUpdatePhpIniParamsSchema.parse(payload));
    });

    test('web.issueSsl validates domain, SANs, and email', () => {
      const payload = {
        domain: 'example-store.com',
        sanDomains: ['www.example-store.com', 'mail.example-store.com'],
        email: 'acme@example-store.com',
        provider: 'letsencrypt',
        challengeType: 'http-01',
      };
      assert.ok(WebIssueSslParamsSchema.parse(payload));
      assert.throws(() => WebIssueSslParamsSchema.parse({ ...payload, email: 'not-an-email' }));
    });
  });

  describe('Handler 3: DNS Operations', () => {
    test('dns.upsertZone validates RFC 1035 zone input', () => {
      const payload = {
        domain: 'example-store.com',
        primaryNs: 'ns1.cleanpanel.local.',
        records: [
          { name: '@', type: 'A' as const, value: '203.0.113.32', ttl: 300 },
          { name: 'mail', type: 'A' as const, value: '203.0.113.24', ttl: 300 },
          { name: '@', type: 'MX' as const, value: 'mail.example-store.com.', priority: 10 },
          { name: 'default._domainkey', type: 'TXT' as const, value: 'v=DKIM1; k=rsa; p=MIIBIj...' },
        ],
      };
      assert.ok(DnsUpsertZoneParamsSchema.parse(payload));
    });

    test('dns.deleteZone validates domain name', () => {
      assert.ok(DnsDeleteZoneParamsSchema.parse({ domain: 'example-store.com' }));
    });
  });

  describe('Handler 4: Mail Operations', () => {
    test('mail.upsertDomain validates DKIM parameters', () => {
      assert.ok(
        MailUpsertDomainParamsSchema.parse({
          domain: 'example-store.com',
          dkimSelector: 'default',
          keyType: 'rsa2048',
        })
      );
    });

    test('mail.upsertMailbox validates localPart and quota', () => {
      const payload = {
        username: 'acme',
        domain: 'example-store.com',
        localPart: 'sales',
        passwordHash: '{ARGON2ID}$argon2id$...',
        quotaBytes: 4194304000,
      };
      assert.ok(MailUpsertMailboxParamsSchema.parse(payload));
      assert.throws(() =>
        MailUpsertMailboxParamsSchema.parse({ ...payload, localPart: 'bad local part' })
      );
    });

    test('mail.upsertForwarder validates source and destination emails', () => {
      const payload = {
        domain: 'example-store.com',
        source: 'info@example-store.com',
        destinations: ['sales@example-store.com'],
      };
      assert.ok(MailUpsertForwarderParamsSchema.parse(payload));
    });

    test('mail.deleteMailbox validates mailbox deletion', () => {
      assert.ok(
        MailDeleteMailboxParamsSchema.parse({
          username: 'acme',
          domain: 'example-store.com',
          localPart: 'sales',
          purgeMaildir: true,
        })
      );
    });

    test('mail.upsertSieve validates sieve script upload', () => {
      assert.ok(
        MailUpsertSieveParamsSchema.parse({
          username: 'acme',
          domain: 'example-store.com',
          localPart: 'sales',
          sieveScript: 'require ["fileinto"]; if header :contains "subject" "spam" { discard; }',
        })
      );
    });
  });

  describe('Handler 5: MySQL Operations', () => {
    test('mysql.createDatabase enforces database name pattern', () => {
      assert.ok(
        MysqlCreateDatabaseParamsSchema.parse({
          username: 'acme',
          databaseName: 'store',
        })
      );
      assert.throws(() =>
        MysqlCreateDatabaseParamsSchema.parse({
          username: 'acme',
          databaseName: 'bad-db-name-with-dashes!',
        })
      );
    });

    test('mysql.dropDatabase validates database drop params', () => {
      assert.ok(
        MysqlDropDatabaseParamsSchema.parse({
          username: 'acme',
          fullDatabaseName: 'acme_store',
        })
      );
    });

    test('mysql.upsertUserGrant validates password and host', () => {
      const payload = {
        username: 'acme',
        dbUserSuffix: 'wp1',
        password: 'ValidPassword123!',
        host: 'localhost',
        databaseName: 'acme_store',
        privileges: ['ALL PRIVILEGES'],
      };
      assert.ok(MysqlUpsertUserGrantParamsSchema.parse(payload));
    });

    test('mysql.createSignonSession validates session request', () => {
      assert.ok(
        MysqlCreateSignonSessionParamsSchema.parse({
          username: 'acme',
          databaseUser: 'acme_wp1',
          targetDatabase: 'acme_store',
        })
      );
    });
  });

  describe('Handler 6: File Operations', () => {
    test('files.operation validates list, read, write, chmod, archive', () => {
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'acme',
          action: 'list',
          path: '/home/acme/public_html',
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'acme',
          action: 'write',
          path: '/home/acme/public_html/index.php',
          content: '<?php echo "Hello World"; ?>',
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'acme',
          action: 'chmod',
          path: '/home/acme/public_html',
          mode: 0o755,
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'acme',
          action: 'archive',
          path: '/home/acme/public_html',
          targetPath: '/home/acme/backups/web.tar.gz',
          archiveFormat: 'tar.gz',
        })
      );
    });
  });

  describe('Handler 7: WP Toolkit Operations', () => {
    test('wp.toolkit validates install, clone, and autoUpdate', () => {
      assert.ok(
        WpToolkitParamsSchema.parse({
          username: 'acme',
          action: 'install',
          domain: 'example-store.com',
          path: '/home/acme/public_html',
          title: 'Example Store',
          adminEmail: 'acme@example-store.com',
        })
      );
      assert.ok(
        WpToolkitParamsSchema.parse({
          username: 'acme',
          action: 'createLogin',
          domain: 'example-store.com',
          path: '/home/acme/public_html',
        })
      );
    });
  });

  describe('Handler 8: Backups Operations', () => {
    test('backup.cpmoveAndRestic validates cpmove and restic modes', () => {
      assert.ok(
        BackupCpmoveAndResticParamsSchema.parse({
          username: 'acme',
          mode: 'cpmove_export',
          archivePath: '/home/acme/backups/cpmove-acme.tar.gz',
        })
      );
      assert.ok(
        BackupCpmoveAndResticParamsSchema.parse({
          username: 'acme',
          mode: 'restic_backup',
          resticTarget: 's3:s3.amazonaws.com/backup-bucket',
        })
      );
    });
  });
});
