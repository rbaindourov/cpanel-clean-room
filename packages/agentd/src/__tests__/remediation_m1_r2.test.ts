import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';
import { MysqlHandler } from '../handlers/mysql.ts';
import { CpmoveHandler } from '../handlers/cpmove.ts';
import { DnsBindHandler } from '../handlers/dns-bind.ts';
import { MailRspamdHandler } from '../handlers/mail-rspamd.ts';
import { FilesHandler } from '../handlers/files.ts';
import {
  MailUpsertMailboxParamsSchema,
  LocalPartSchema,
} from '@cpanel-clean-room/shared';

describe('Round 2 Remediation Verification Test Suite (remediation_m1_r2.test.ts)', () => {
  let sysroot: SysrootEngine;

  beforeEach(() => {
    sysroot = new SysrootEngine('./scratch/test_remediation_sysroot');
    sysroot.scaffold();
  });

  describe('1. MySQL Handler Security & Dynamic SSO Secrets', () => {
    it('Closes stacked SQL injection in upsertUserGrant across password, host, and privileges', async () => {
      const handler = new MysqlHandler(sysroot);

      await handler.upsertUserGrant({
        username: 'vahag',
        dbUserSuffix: 'app',
        password: "hacked_pass'; DROP DATABASE vahag_production; -- ",
        host: "%' OR '1'='1",
        databaseName: 'vahag_testdb',
        privileges: ['ALL PRIVILEGES; DROP TABLE users; --'],
      });

      const executions = sysroot.getMockExecutions();
      const last = executions[executions.length - 1];
      assert.strictEqual(last.cmd, 'mariadb');
      const sqlArg = last.args[1];

      // Verify passwords and hosts are properly escaped with doubled single quotes
      assert.ok(sqlArg.includes("IDENTIFIED BY 'hacked_pass''; DROP DATABASE vahag_production; -- ';"));
      assert.ok(sqlArg.includes("@'%'' OR ''1''=''1'"));

      // Verify privileges are whitelisted and malicious tokens dropped
      assert.ok(!sqlArg.includes('DROP TABLE users'));
      assert.ok(sqlArg.includes('GRANT ALL PRIVILEGES ON `vahag_testdb`.*'));
    });

    it('Supports dynamic HMAC secret via constructor injection and environment variable', async () => {
      // Test constructor injection
      const injectedSecret = 'custom-constructor-secret-123456!';
      const handlerInjected = new MysqlHandler(sysroot, injectedSecret);

      const res1 = await handlerInjected.createSignonSession({
        username: 'vahag',
        databaseUser: 'vahag_k',
        databasePassword: 'testPassword123',
      });

      const sessFile1 = sysroot.resolve(`/tmp/sess_${res1.signonToken}`);
      assert.ok(fs.existsSync(sessFile1));
      const sessData1 = fs.readFileSync(sessFile1, 'utf8');

      // Test environment variable resolution
      const prevEnv = process.env.PANEL_SSO_SECRET;
      try {
        process.env.PANEL_SSO_SECRET = 'env-configured-secret-key-987654!';
        const handlerEnv = new MysqlHandler(sysroot);

        const res2 = await handlerEnv.createSignonSession({
          username: 'vahag',
          databaseUser: 'vahag_k',
          databasePassword: 'testPassword123',
        });

        const sessFile2 = sysroot.resolve(`/tmp/sess_${res2.signonToken}`);
        assert.ok(fs.existsSync(sessFile2));
        const sessData2 = fs.readFileSync(sessFile2, 'utf8');

        // Sessions should produce different HMAC signatures
        assert.notStrictEqual(sessData1, sessData2);
      } finally {
        if (prevEnv) {
          process.env.PANEL_SSO_SECRET = prevEnv;
        } else {
          delete process.env.PANEL_SSO_SECRET;
        }
      }
    });
  });

  describe('2. Streaming cpmove Importer & Exporter Remediation', () => {
    it('Rejects missing and corrupted archive files with NOT_FOUND and CORRUPTED_ARCHIVE', async () => {
      const handler = new CpmoveHandler(sysroot);

      // 1. Missing archive
      await assert.rejects(
        () =>
          handler.run({
            username: 'vahag',
            mode: 'cpmove_import',
            archivePath: '/home/vahag/backups/non_existent.tar.gz',
          }),
        /NOT_FOUND/
      );

      // 2. Corrupt archive (random bytes)
      const corruptRel = '/home/vahag/backups/corrupted.tar.gz';
      const corruptAbs = sysroot.resolve(corruptRel);
      sysroot.ensureDir(path.dirname(corruptAbs));
      fs.writeFileSync(corruptAbs, Buffer.from('NOT_A_VALID_GZIP_OR_TAR_DATA_1234567890'));

      await assert.rejects(
        () =>
          handler.run({
            username: 'vahag',
            mode: 'cpmove_import',
            archivePath: corruptRel,
          }),
        /CORRUPTED_ARCHIVE/
      );

      // 3. Empty archive (0 bytes)
      const emptyRel = '/home/vahag/backups/empty.tar.gz';
      const emptyAbs = sysroot.resolve(emptyRel);
      fs.writeFileSync(emptyAbs, Buffer.alloc(0));

      await assert.rejects(
        () =>
          handler.run({
            username: 'vahag',
            mode: 'cpmove_import',
            archivePath: emptyRel,
          }),
        /CORRUPTED_ARCHIVE/
      );
    });

    it('Restores homedir files and strips legacy EasyApache handlers from .htaccess', async () => {
      const handler = new CpmoveHandler(sysroot);

      // Create a valid mock archive
      const mockArchiveRel = '/home/vahag/backups/cpmove-vahag.tar.gz';
      const mockArchiveAbs = sysroot.resolve(mockArchiveRel);
      sysroot.ensureDir(path.dirname(mockArchiveAbs));
      fs.writeFileSync(mockArchiveAbs, Buffer.from('MOCK_CPMOVE_ARCHIVE_FOR_vahag\n'));

      const res = await handler.run({
        username: 'vahag',
        mode: 'cpmove_import',
        archivePath: mockArchiveRel,
      });

      assert.strictEqual(res.success, true);
      const homeDir = sysroot.resolve('/home/vahag');
      const userIndex = path.join(homeDir, 'public_html', 'index.html');
      assert.ok(fs.existsSync(userIndex), 'Restored site index.html must exist in /home/vahag');

      // Test .htaccess EasyApache handler stripping
      const htaccess = path.join(homeDir, 'public_html', '.htaccess');
      fs.writeFileSync(
        htaccess,
        'AddHandler application/x-httpd-ea-php81 .php\nRewriteEngine On\n',
        'utf8'
      );

      // Re-run import
      await handler.run({
        username: 'vahag',
        mode: 'cpmove_import',
        archivePath: mockArchiveRel,
      });

      const updatedHtaccess = fs.readFileSync(htaccess, 'utf8');
      assert.ok(updatedHtaccess.includes('# [cpanel-clean-room: stripped legacy EasyApache handler]'));
      assert.ok(!updatedHtaccess.includes('application/x-httpd-ea-php81'));
    });

    it('Safely cleans up temporary directories in /tmp on completion or error', async () => {
      const handler = new CpmoveHandler(sysroot);

      const mockArchiveRel = '/home/vahag/backups/cpmove-vahag.tar.gz';
      const mockArchiveAbs = sysroot.resolve(mockArchiveRel);
      sysroot.ensureDir(path.dirname(mockArchiveAbs));
      fs.writeFileSync(mockArchiveAbs, Buffer.from('MOCK_CPMOVE_ARCHIVE_FOR_vahag\n'));

      const tmpDir = sysroot.resolve('/tmp');
      const beforeEntries = fs.readdirSync(tmpDir).filter((f) => f.startsWith('cpmove_unpack_vahag_'));

      await handler.run({
        username: 'vahag',
        mode: 'cpmove_import',
        archivePath: mockArchiveRel,
      });

      const afterEntries = fs.readdirSync(tmpDir).filter((f) => f.startsWith('cpmove_unpack_vahag_'));
      assert.strictEqual(afterEntries.length, beforeEntries.length, 'No leaked unpack directories in /tmp');
    });

    it('cpmove_export dumps MySQL databases, BIND9 DNS zones, and cPanel metadata', async () => {
      const handler = new CpmoveHandler(sysroot);

      // Seed a mock BIND9 zone
      const bindDir = sysroot.resolve('/etc/bind/zones');
      sysroot.ensureDir(bindDir);
      fs.writeFileSync(path.join(bindDir, 'architecturalnumbers.com.db'), '; zone file', 'utf8');

      const res = await handler.run({
        username: 'vahag',
        mode: 'cpmove_export',
      });

      assert.strictEqual(res.success, true);
      const executions = sysroot.getMockExecutions();
      const mysqldumpCall = executions.find((e) => e.cmd === 'mysqldump');
      assert.ok(mysqldumpCall, 'mysqldump must have been executed during cpmove_export');

      const tarCall = executions.find((e) => e.cmd === 'tar' && e.args.includes('-czf'));
      assert.ok(tarCall, 'tar must have been executed during cpmove_export');
      assert.ok(tarCall.args.includes('--'), 'tar command must use -- separator');
    });
  });

  describe('3. RFC 1035 BIND9 DNS Engine Remediation', () => {
    it('Splits multi-byte UTF-8 TXT strings by octet byte length (<= 255 bytes)', () => {
      const handler = new DnsBindHandler(sysroot);

      // Cyrillic character 'ж' is 2 bytes in UTF-8. 200 'ж' characters = 400 bytes.
      const strMultibyte = 'ж'.repeat(200);
      assert.strictEqual(strMultibyte.length, 200);
      assert.strictEqual(Buffer.byteLength(strMultibyte, 'utf8'), 400);

      const chunked = handler.chunkTxt(strMultibyte);
      assert.ok(chunked.startsWith('( "'), 'Must be split into multi-chunk format wrapped in parentheses');
      assert.ok(chunked.endsWith('" )'));

      // Verify each chunk is <= 255 bytes
      const quoteRegex = /"((?:[^"\\]|\\.)*)"/g;
      let match: RegExpExecArray | null;
      while ((match = quoteRegex.exec(chunked)) !== null) {
        assert.ok(Buffer.byteLength(match[1], 'utf8') <= 255, 'Each chunk must not exceed 255 octets');
      }
    });

    it('Round-trips DKIM keys without injecting internal quote artifacts', async () => {
      const handler = new DnsBindHandler(sysroot);

      const dkimValue =
        'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzqX8n5e0k' +
        'Z6U8LwW9W0p6A8jP9K8u1V2m3N4b5v6c7x8z9A0B1C2D3E4F5G6H7I8J9K0L1M2N3O4P5Q6R7' +
        'S8T9U0V1W2X3Y4Z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1A2B3C' +
        '4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7a8b9c0d1e2f3g4h5i6j7k8l9m0' +
        'n1o2p3q4r5s6t7u8v9w0x1y2z3A4B5C6D7E8F9G0==';

      await handler.upsertZone({
        domain: 'architecturalnumbers.com',
        records: [{ name: 'default._domainkey', type: 'TXT', value: dkimValue }],
      });

      const zoneContent = sysroot.readFile('/etc/bind/zones/architecturalnumbers.com.db');
      const parsed = handler.parseZone(zoneContent);
      const parsedDkim = parsed.records.find((r) => r.name === 'default._domainkey');

      assert.ok(parsedDkim);
      assert.strictEqual(parsedDkim.value, dkimValue, 'Round-trip DKIM value must match original without inner quotes');
    });

    it('Handles SRV records with priority in upsertZone and parseZone', async () => {
      const handler = new DnsBindHandler(sysroot);

      await handler.upsertZone({
        domain: 'architecturalnumbers.com',
        records: [
          {
            name: '_sip._tcp',
            type: 'SRV',
            priority: 10,
            value: '20 5060 sip.architecturalnumbers.com.',
          },
        ],
      });

      const zoneContent = sysroot.readFile('/etc/bind/zones/architecturalnumbers.com.db');
      assert.ok(zoneContent.includes('_sip._tcp IN SRV 10 20 5060 sip.architecturalnumbers.com.'));

      const parsed = handler.parseZone(zoneContent);
      const srvRec = parsed.records.find((r) => r.name === '_sip._tcp');
      assert.ok(srvRec);
      assert.strictEqual(srvRec.priority, 10);
      assert.strictEqual(srvRec.value, '20 5060 sip.architecturalnumbers.com.');
    });

    it('Guarantees monotonic serial progression per RFC 1982', () => {
      const handler = new DnsBindHandler(sysroot);

      // When serial is from the future (e.g. imported zone)
      const futureSerial = 2029123101;
      const nextSerial = handler.computeNextSerial(futureSerial);
      assert.strictEqual(nextSerial, futureSerial + 1, 'Future serial must monotonically increment by 1');
    });

    it('Escapes domain regex in deleteZone to prevent unintended domain deletions', async () => {
      const handler = new DnsBindHandler(sysroot);
      const namedConfPath = '/etc/bind/named.conf.local';

      const initialConf = `
zone "sub-domainXexample.com" { type master; file "/etc/bind/zones/sub-domainXexample.com.db"; };
zone "sub-domain.example.com" { type master; file "/etc/bind/zones/sub-domain.example.com.db"; };
`;
      sysroot.atomicWriteFile(namedConfPath, initialConf);

      await handler.deleteZone({ domain: 'sub-domain.example.com' });

      const updated = sysroot.readFile(namedConfPath);
      assert.ok(updated.includes('sub-domainXexample.com'), 'Escaped regex must NOT match sub-domainXexample.com');
      assert.ok(!updated.includes('sub-domain.example.com'));
    });
  });

  describe('4. Mail & Rspamd Handler Remediation', () => {
    it('LocalPartSchema blocks path traversal attacks in mailbox operations', () => {
      assert.strictEqual(LocalPartSchema.safeParse('valid.user').success, true);
      assert.strictEqual(LocalPartSchema.safeParse('user-name').success, true);
      assert.strictEqual(LocalPartSchema.safeParse('../etc/passwd').success, false);
      assert.strictEqual(LocalPartSchema.safeParse('user/sub').success, false);
      assert.strictEqual(LocalPartSchema.safeParse('user\\sub').success, false);
    });

    it('Allows quotaBytes: 0 for unlimited mailbox quotas in schema', () => {
      const params = {
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        localPart: 'unlimited',
        passwordHash: '$argon2id$v=19$mockhash',
        quotaBytes: 0,
      };

      const parsed = MailUpsertMailboxParamsSchema.safeParse(params);
      assert.strictEqual(parsed.success, true, 'quotaBytes: 0 must be accepted for unlimited quota');
    });

    it('Scaffolds Maildir++ structure with cur, new, tmp across all subfolders', async () => {
      const handler = new MailRspamdHandler(sysroot);

      const res = await handler.upsertMailbox({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        localPart: 'ceo',
        passwordHash: '$argon2id$v=19$mockhash',
        quotaBytes: 0,
      });

      const mailboxDir = sysroot.resolve(res.maildirPath);
      for (const sub of ['.Drafts', '.Sent', '.Trash', '.Junk', '.Archive']) {
        const subDir = path.join(mailboxDir, sub);
        assert.ok(fs.existsSync(path.join(subDir, 'cur')), `cur/ must exist in ${sub}`);
        assert.ok(fs.existsSync(path.join(subDir, 'new')), `new/ must exist in ${sub}`);
        assert.ok(fs.existsSync(path.join(subDir, 'tmp')), `tmp/ must exist in ${sub}`);
        assert.ok(fs.existsSync(path.join(subDir, 'maildirfolder')), `maildirfolder must exist in ${sub}`);
      }
    });

    it('Validates Sieve syntax and rejects malformed Sieve scripts', async () => {
      const handler = new MailRspamdHandler(sysroot);

      const malformedSieve = `
        INVALID SIEVE SYNTAX !@#$%^&*()
        unclosed string "hello
      `;

      await assert.rejects(
        () =>
          handler.upsertSieve({
            username: 'vahag',
            domain: 'architecturalnumbers.com',
            localPart: 'ceo',
            sieveScript: malformedSieve,
          }),
        /SIEVE_SYNTAX_ERROR/
      );
    });

    it('Resolves /etc/postfix/virtual via sysroot before executing postmap', async () => {
      const handler = new MailRspamdHandler(sysroot);

      await handler.upsertForwarder({
        domain: 'architecturalnumbers.com',
        source: 'info@architecturalnumbers.com',
        destinations: ['sales@architecturalnumbers.com'],
      });

      const executions = sysroot.getMockExecutions();
      const postmapCall = executions.find((e) => e.cmd === 'postmap');
      assert.ok(postmapCall);
      const expectedVirtual = sysroot.resolve('/etc/postfix/virtual');
      assert.strictEqual(postmapCall.args[0], expectedVirtual, 'postmap must receive resolved sysroot path');
    });

    it('Sets DKIM private key mode to 0o640 for _rspamd daemon group access', async () => {
      const handler = new MailRspamdHandler(sysroot);

      const res = await handler.upsertDomain({
        domain: 'architecturalnumbers.com',
        dkimSelector: 'default',
        keyType: 'rsa2048',
      });

      const keyAbs = sysroot.resolve(res.dkimKeyPath);
      const stat = fs.statSync(keyAbs);
      assert.strictEqual(stat.mode & 0o777, 0o640, 'DKIM private key must have mode 0o640');
    });
  });
});
