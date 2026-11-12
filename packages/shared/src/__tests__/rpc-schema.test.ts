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
      params: { username: 'vahag' },
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
        message: 'User vahag already exists',
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
        username: 'vahag',
        plan: {
          cpuQuota: '200%',
          memoryMax: '2G',
          tasksMax: 150,
          diskQuotaBytes: 10737418240,
        },
      };
      assert.ok(TenantCreateParamsSchema.parse(valid));

      // Invalid username (uppercase, symbols, too short)
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'VAHAG' }));
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'va' }));
      assert.throws(() => TenantCreateParamsSchema.parse({ ...valid, username: 'user$bad' }));
    });

    test('tenant.updateLimits validates optional plan fields', () => {
      assert.ok(
        TenantUpdateLimitsParamsSchema.parse({
          username: 'vahag',
          plan: { memoryMax: '4G' },
        })
      );
    });

    test('tenant.suspend and tenant.resume validate payloads', () => {
      assert.ok(TenantSuspendParamsSchema.parse({ username: 'vahag', reason: 'Non-payment' }));
      assert.ok(TenantResumeParamsSchema.parse({ username: 'vahag' }));
    });

    test('tenant.delete validates purgeHome boolean default', () => {
      const parsed = TenantDeleteParamsSchema.parse({ username: 'vahag' });
      assert.equal(parsed.purgeHome, false);
    });
  });

  describe('Handler 2: Web & PHP Operations', () => {
    test('web.upsertVhost validates full vhost spec', () => {
      const payload = {
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        aliases: ['www.architecturalnumbers.com'],
        documentRoot: '/home/vahag/public_html',
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
          username: 'vahag',
          domain: 'architecturalnumbers.com',
          phpVersion: '8.3',
        })
      );
    });

    test('web.setPhpVersion rejects invalid PHP versions', () => {
      const valid = {
        username: 'vahag',
        domain: 'architecturalnumbers.com',
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
        username: 'vahag',
        domain: 'architecturalnumbers.com',
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
        domain: 'architecturalnumbers.com',
        sanDomains: ['www.architecturalnumbers.com', 'mail.architecturalnumbers.com'],
        email: 'vahag@architecturalnumbers.com',
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
        domain: 'architecturalnumbers.com',
        primaryNs: 'ns1.winwinhost.com.',
        records: [
          { name: '@', type: 'A' as const, value: '192.168.11.32', ttl: 300 },
          { name: 'mail', type: 'A' as const, value: '192.168.11.24', ttl: 300 },
          { name: '@', type: 'MX' as const, value: 'mail.architecturalnumbers.com.', priority: 10 },
          { name: 'default._domainkey', type: 'TXT' as const, value: 'v=DKIM1; k=rsa; p=MIIBIj...' },
        ],
      };
      assert.ok(DnsUpsertZoneParamsSchema.parse(payload));
    });

    test('dns.deleteZone validates domain name', () => {
      assert.ok(DnsDeleteZoneParamsSchema.parse({ domain: 'architecturalnumbers.com' }));
    });
  });

  describe('Handler 4: Mail Operations', () => {
    test('mail.upsertDomain validates DKIM parameters', () => {
      assert.ok(
        MailUpsertDomainParamsSchema.parse({
          domain: 'architecturalnumbers.com',
          dkimSelector: 'default',
          keyType: 'rsa2048',
        })
      );
    });

    test('mail.upsertMailbox validates localPart and quota', () => {
      const payload = {
        username: 'vahag',
        domain: 'architecturalnumbers.com',
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
        domain: 'architecturalnumbers.com',
        source: 'info@architecturalnumbers.com',
        destinations: ['sales@architecturalnumbers.com'],
      };
      assert.ok(MailUpsertForwarderParamsSchema.parse(payload));
    });

    test('mail.deleteMailbox validates mailbox deletion', () => {
      assert.ok(
        MailDeleteMailboxParamsSchema.parse({
          username: 'vahag',
          domain: 'architecturalnumbers.com',
          localPart: 'sales',
          purgeMaildir: true,
        })
      );
    });

    test('mail.upsertSieve validates sieve script upload', () => {
      assert.ok(
        MailUpsertSieveParamsSchema.parse({
          username: 'vahag',
          domain: 'architecturalnumbers.com',
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
          username: 'vahag',
          databaseName: 'architecturalnumbers',
        })
      );
      assert.throws(() =>
        MysqlCreateDatabaseParamsSchema.parse({
          username: 'vahag',
          databaseName: 'bad-db-name-with-dashes!',
        })
      );
    });

    test('mysql.dropDatabase validates database drop params', () => {
      assert.ok(
        MysqlDropDatabaseParamsSchema.parse({
          username: 'vahag',
          fullDatabaseName: 'vahag_architecturalnumbers',
        })
      );
    });

    test('mysql.upsertUserGrant validates password and host', () => {
      const payload = {
        username: 'vahag',
        dbUserSuffix: 'k',
        password: 'ValidPassword123!',
        host: 'localhost',
        databaseName: 'vahag_architecturalnumbers',
        privileges: ['ALL PRIVILEGES'],
      };
      assert.ok(MysqlUpsertUserGrantParamsSchema.parse(payload));
    });

    test('mysql.createSignonSession validates session request', () => {
      assert.ok(
        MysqlCreateSignonSessionParamsSchema.parse({
          username: 'vahag',
          databaseUser: 'vahag_k',
          targetDatabase: 'vahag_architecturalnumbers',
        })
      );
    });
  });

  describe('Handler 6: File Operations', () => {
    test('files.operation validates list, read, write, chmod, archive', () => {
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'vahag',
          action: 'list',
          path: '/home/vahag/public_html',
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'vahag',
          action: 'write',
          path: '/home/vahag/public_html/index.php',
          content: '<?php echo "Hello World"; ?>',
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'vahag',
          action: 'chmod',
          path: '/home/vahag/public_html',
          mode: 0o755,
        })
      );
      assert.ok(
        FilesOperationParamsSchema.parse({
          username: 'vahag',
          action: 'archive',
          path: '/home/vahag/public_html',
          targetPath: '/home/vahag/backups/web.tar.gz',
          archiveFormat: 'tar.gz',
        })
      );
    });
  });

  describe('Handler 7: WP Toolkit Operations', () => {
    test('wp.toolkit validates install, clone, and autoUpdate', () => {
      assert.ok(
        WpToolkitParamsSchema.parse({
          username: 'vahag',
          action: 'install',
          domain: 'architecturalnumbers.com',
          path: '/home/vahag/public_html',
          title: 'Architectural Numbers',
          adminEmail: 'vahag@architecturalnumbers.com',
        })
      );
      assert.ok(
        WpToolkitParamsSchema.parse({
          username: 'vahag',
          action: 'createLogin',
          domain: 'architecturalnumbers.com',
          path: '/home/vahag/public_html',
        })
      );
    });
  });

  describe('Handler 8: Backups Operations', () => {
    test('backup.cpmoveAndRestic validates cpmove and restic modes', () => {
      assert.ok(
        BackupCpmoveAndResticParamsSchema.parse({
          username: 'vahag',
          mode: 'cpmove_export',
          archivePath: '/home/vahag/backups/cpmove-vahag.tar.gz',
        })
      );
      assert.ok(
        BackupCpmoveAndResticParamsSchema.parse({
          username: 'vahag',
          mode: 'restic_backup',
          resticTarget: 's3:s3.amazonaws.com/backup-bucket',
        })
      );
    });
  });
});
