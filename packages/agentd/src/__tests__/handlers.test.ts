import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';

// Handlers
import { TenantHandler } from '../handlers/tenant.ts';
import { WebPhpHandler } from '../handlers/web-php.ts';
import { DnsBindHandler } from '../handlers/dns-bind.ts';
import { MailRspamdHandler } from '../handlers/mail-rspamd.ts';
import { MysqlHandler } from '../handlers/mysql.ts';
import { FilesHandler } from '../handlers/files.ts';
import { WpToolkitHandler } from '../handlers/wp-toolkit.ts';
import { CpmoveHandler } from '../handlers/cpmove.ts';

const testSandboxDir = path.resolve('./scratch/test_handlers_sandbox');

describe('packages/agentd 8 Service Handlers Suite', () => {
  const sysroot = new SysrootEngine(testSandboxDir);
  sysroot.scaffold();

  describe('1. TenantHandler', () => {
    const handler = new TenantHandler(sysroot);

    test('create provisions tenant homedir, cgroups v2 slice, and quota', async () => {
      const res = await handler.create({
        username: 'vahag',
        plan: {
          cpuQuota: '200%',
          memoryMax: '2G',
          tasksMax: 150,
          diskQuotaBytes: 10737418240,
        },
      });

      assert.equal(res.uid, 1005);
      assert.equal(res.gid, 1005);
      assert.equal(res.homeDir, '/home/vahag');
      assert.equal(res.sliceCreated, true);

      // Verify slice file on disk
      const slicePath = sysroot.resolve('/etc/systemd/system/user-1005.slice');
      assert.ok(fs.existsSync(slicePath));
      const sliceContent = fs.readFileSync(slicePath, 'utf8');
      assert.ok(sliceContent.includes('CPUQuota=200%'));
      assert.ok(sliceContent.includes('MemoryMax=2G'));
      assert.ok(sliceContent.includes('TasksMax=150'));

      // Verify homedir scaffolding
      assert.ok(fs.existsSync(sysroot.resolve('/home/vahag/public_html')));
      assert.ok(fs.existsSync(sysroot.resolve('/home/vahag/mail')));
    });

    test('updateLimits adjusts cgroups v2 slice and reloads daemon', async () => {
      const res = await handler.updateLimits({
        username: 'vahag',
        plan: {
          cpuQuota: '300%',
          memoryMax: '4G',
          tasksMax: 200,
        },
      });

      assert.equal(res.updated, true);
      const slicePath = sysroot.resolve('/etc/systemd/system/user-1005.slice');
      const content = fs.readFileSync(slicePath, 'utf8');
      assert.ok(content.includes('CPUQuota=300%'));
      assert.ok(content.includes('MemoryMax=4G'));
      assert.ok(content.includes('TasksMax=200'));
    });

    test('suspend writes .suspended file and locks user', async () => {
      const res = await handler.suspend({
        username: 'vahag',
        reason: 'Maintenance',
      });
      assert.equal(res.suspended, true);
      const marker = sysroot.resolve('/home/vahag/.suspended');
      assert.ok(fs.existsSync(marker));
      const markerJson = JSON.parse(fs.readFileSync(marker, 'utf8'));
      assert.equal(markerJson.reason, 'Maintenance');
    });

    test('resume removes .suspended file and unlocks user', async () => {
      const res = await handler.resume({ username: 'vahag' });
      assert.equal(res.suspended, false);
      const marker = sysroot.resolve('/home/vahag/.suspended');
      assert.equal(fs.existsSync(marker), false);
    });

    test('delete removes slice and processes', async () => {
      const res = await handler.delete({ username: 'vahag', purgeHome: false });
      assert.equal(res.deleted, true);
      const slicePath = sysroot.resolve('/etc/systemd/system/user-1005.slice');
      assert.equal(fs.existsSync(slicePath), false);
    });
  });

  describe('2. WebPhpHandler', () => {
    const handler = new WebPhpHandler(sysroot);

    test('upsertVhost creates Nginx vhost with SSL, PHP pool, and reloads', async () => {
      const res = await handler.upsertVhost({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        aliases: ['www.architecturalnumbers.com'],
        documentRoot: '/home/vahag/public_html',
        phpVersion: '8.3',
        useApacheBackend: false,
        forceHttps: true,
        ssl: {
          enabled: true,
          certPath: '/etc/ssl/certs/architecturalnumbers.com.crt',
          keyPath: '/etc/ssl/private/architecturalnumbers.com.key',
        },
      });

      assert.equal(res.reloaded, true);
      assert.ok(fs.existsSync(sysroot.resolve(res.vhostPath)));
      assert.ok(fs.existsSync(sysroot.resolve(res.enabledPath)));

      const vhostContent = sysroot.readFile(res.vhostPath);
      assert.ok(vhostContent.includes('server_name architecturalnumbers.com www.architecturalnumbers.com'));
      assert.ok(vhostContent.includes('fastcgi_pass unix:/run/php/php83-fpm-architecturalnumbers.com.sock;'));
      assert.ok(vhostContent.includes('listen 443 ssl http2;'));

      const poolPath = sysroot.resolve('/etc/php/8.3/fpm/pool.d/vahag-architecturalnumbers.com.conf');
      assert.ok(fs.existsSync(poolPath));
      const poolContent = fs.readFileSync(poolPath, 'utf8');
      assert.ok(poolContent.includes('listen = /run/php/php83-fpm-architecturalnumbers.com.sock'));
    });

    test('upsertVhost supports Apache2 backend fallback (127.0.0.1:8080) per ADR-04', async () => {
      const res = await handler.upsertVhost({
        username: 'vahag',
        domain: 'legacyapp.la',
        documentRoot: '/home/vahag/public_html/legacy',
        phpVersion: '7.4',
        useApacheBackend: true,
      });

      const vhostContent = sysroot.readFile(res.vhostPath);
      assert.ok(vhostContent.includes('proxy_pass http://127.0.0.1:8080;'));
    });

    test('setPhpVersion moves pool and updates vhost socket', async () => {
      const res = await handler.setPhpVersion({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        fromVersion: '8.3',
        toVersion: '8.4',
      });

      assert.equal(res.reloaded, true);
      assert.equal(res.newSocket, '/run/php/php84-fpm-architecturalnumbers.com.sock');

      const vhostContent = sysroot.readFile('/etc/nginx/sites-available/architecturalnumbers.com.conf');
      assert.ok(vhostContent.includes('fastcgi_pass unix:/run/php/php84-fpm-architecturalnumbers.com.sock;'));

      assert.equal(sysroot.exists('/etc/php/8.3/fpm/pool.d/vahag-architecturalnumbers.com.conf'), false);
      assert.equal(sysroot.exists('/etc/php/8.4/fpm/pool.d/vahag-architecturalnumbers.com.conf'), true);
    });

    test('updatePhpIni updates php_admin_value in pool', async () => {
      const res = await handler.updatePhpIni({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        phpVersion: '8.4',
        directives: {
          memory_limit: '1024M',
          max_execution_time: '600',
        },
      });

      assert.equal(res.updated, true);
      const poolContent = sysroot.readFile('/etc/php/8.4/fpm/pool.d/vahag-architecturalnumbers.com.conf');
      assert.ok(poolContent.includes('php_admin_value[memory_limit] = 1024M'));
      assert.ok(poolContent.includes('php_admin_value[max_execution_time] = 600'));
    });

    test('issueSsl generates certificate and key', async () => {
      const res = await handler.issueSsl({
        domain: 'architecturalnumbers.com',
        sanDomains: ['www.architecturalnumbers.com'],
        email: 'vahag@architecturalnumbers.com',
      });

      assert.ok(fs.existsSync(sysroot.resolve(res.certPath)));
      assert.ok(fs.existsSync(sysroot.resolve(res.keyPath)));
      assert.ok(res.sanDomains.includes('www.architecturalnumbers.com'));
    });

    test('deleteVhost removes vhost and pool configs', async () => {
      const res = await handler.deleteVhost({
        username: 'vahag',
        domain: 'legacyapp.la',
        phpVersion: '7.4',
      });

      assert.equal(res.deleted, true);
      assert.equal(sysroot.exists('/etc/nginx/sites-available/legacyapp.la.conf'), false);
      assert.equal(sysroot.exists('/etc/nginx/sites-enabled/legacyapp.la.conf'), false);
    });
  });

  describe('3. DnsBindHandler', () => {
    const handler = new DnsBindHandler(sysroot);

    test('chunkTxt handles strings <= 255 and > 255 octets correctly per RFC 1035', () => {
      const shortStr = 'v=spf1 include:_spf.google.com ~all';
      assert.equal(handler.chunkTxt(shortStr), '"v=spf1 include:_spf.google.com ~all"');

      const longStr = 'A'.repeat(300);
      const chunked = handler.chunkTxt(longStr);
      assert.ok(chunked.startsWith('( "'));
      assert.ok(chunked.endsWith('" )'));
      assert.ok(chunked.includes('" "'));
    });

    test('upsertZone formats RFC 1035 zone, increments serial, and validates syntax', async () => {
      const res = await handler.upsertZone({
        domain: 'architecturalnumbers.com',
        primaryNs: 'ns1.winwinhost.com.',
        records: [
          { name: '@', type: 'A', value: '192.168.11.32', ttl: 300 },
          { name: 'mail', type: 'A', value: '192.168.11.24', ttl: 300 },
          { name: '@', type: 'MX', value: 'mail.architecturalnumbers.com.', priority: 10 },
          { name: 'default._domainkey', type: 'TXT', value: 'v=DKIM1; k=rsa; p=' + 'A'.repeat(300) },
        ],
        syncCloudflare: true,
      });

      assert.equal(res.reloaded, true);
      assert.ok(res.serial > 2026000000);

      const zoneContent = sysroot.readFile('/etc/bind/zones/architecturalnumbers.com.db');
      assert.ok(zoneContent.includes('SOA ns1.winwinhost.com.'));
      assert.ok(zoneContent.includes('IN MX 10 mail.architecturalnumbers.com.'));
      assert.ok(zoneContent.includes('IN TXT ( "'));

      const namedConf = sysroot.readFile('/etc/bind/named.conf.local');
      assert.ok(namedConf.includes('zone "architecturalnumbers.com"'));
    });

    test('parseZone extracts records from zone content', () => {
      const zoneContent = sysroot.readFile('/etc/bind/zones/architecturalnumbers.com.db');
      const parsed = handler.parseZone(zoneContent);
      assert.ok(parsed.serial > 2026000000);
      assert.ok(parsed.records.some((r) => r.type === 'A' && r.value === '192.168.11.32'));
      assert.ok(parsed.records.some((r) => r.type === 'MX' && r.value === 'mail.architecturalnumbers.com.'));
    });

    test('deleteZone removes zone file and named.conf block', async () => {
      const res = await handler.deleteZone({ domain: 'architecturalnumbers.com' });
      assert.equal(res.deleted, true);
      assert.equal(sysroot.exists('/etc/bind/zones/architecturalnumbers.com.db'), false);
      const namedConf = sysroot.readFile('/etc/bind/named.conf.local');
      assert.ok(!namedConf.includes('zone "architecturalnumbers.com"'));
    });
  });

  describe('4. MailRspamdHandler', () => {
    const handler = new MailRspamdHandler(sysroot);

    test('upsertDomain generates authentic RSA 2048 and Ed25519 DKIM keys', async () => {
      const rsaRes = await handler.upsertDomain({
        domain: 'architecturalnumbers.com',
        dkimSelector: 'default',
        keyType: 'rsa2048',
      });

      assert.ok(fs.existsSync(sysroot.resolve(rsaRes.dkimKeyPath)));
      assert.ok(rsaRes.dkimDnsRecord.value.startsWith('v=DKIM1; k=rsa; p='));

      const edRes = await handler.upsertDomain({
        domain: 'trace4less.com',
        dkimSelector: 'ed25519sel',
        keyType: 'ed25519',
      });

      assert.ok(fs.existsSync(sysroot.resolve(edRes.dkimKeyPath)));
      assert.ok(edRes.dkimDnsRecord.value.startsWith('v=DKIM1; k=ed25519; p='));
    });

    test('upsertMailbox scaffolds Maildir and adds Dovecot passwd entry', async () => {
      const res = await handler.upsertMailbox({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        localPart: 'sales',
        passwordHash: '{ARGON2ID}$argon2id$mockHash',
        quotaBytes: 2147483648,
      });

      assert.equal(res.email, 'sales@architecturalnumbers.com');
      assert.ok(fs.existsSync(sysroot.resolve('/home/vahag/mail/architecturalnumbers.com/sales/cur')));
      assert.ok(fs.existsSync(sysroot.resolve('/home/vahag/mail/architecturalnumbers.com/sales/.Sent')));

      const passwdContent = sysroot.readFile('/etc/dovecot/passwd');
      assert.ok(passwdContent.includes('sales@architecturalnumbers.com:{ARGON2ID}$argon2id$mockHash:1005:1005::'));
      assert.ok(passwdContent.includes('userdb_quota_rule=*:storage=2147483648'));
    });

    test('upsertForwarder updates Postfix virtual aliases and calls postmap', async () => {
      const res = await handler.upsertForwarder({
        domain: 'architecturalnumbers.com',
        source: 'info@architecturalnumbers.com',
        destinations: ['sales@architecturalnumbers.com', 'vahag@external.com'],
      });

      assert.equal(res.updated, true);
      const virtualContent = sysroot.readFile('/etc/postfix/virtual');
      assert.ok(virtualContent.includes('info@architecturalnumbers.com sales@architecturalnumbers.com,vahag@external.com'));
    });

    test('upsertSieve compiles Sieve script with sievec', async () => {
      const res = await handler.upsertSieve({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        localPart: 'sales',
        sieveScript: 'require ["fileinto"]; if header :contains "subject" "spam" { discard; }',
      });

      assert.equal(res.compiled, true);
      assert.ok(fs.existsSync(sysroot.resolve(res.sievePath)));
    });

    test('deleteMailbox removes entry from passwd table', async () => {
      const res = await handler.deleteMailbox({
        username: 'vahag',
        domain: 'architecturalnumbers.com',
        localPart: 'sales',
        purgeMaildir: false,
      });

      assert.equal(res.deleted, true);
      const passwdContent = sysroot.readFile('/etc/dovecot/passwd');
      assert.ok(!passwdContent.includes('sales@architecturalnumbers.com:'));
    });
  });

  describe('5. MysqlHandler', () => {
    const handler = new MysqlHandler(sysroot);

    test('createDatabase prefixes DB name with tenant username', async () => {
      const res = await handler.createDatabase({
        username: 'vahag',
        databaseName: 'architecturalnumbers',
      });

      assert.equal(res.fullDatabaseName, 'vahag_architecturalnumbers');
      assert.equal(res.created, true);
    });

    test('upsertUserGrant provisions user and grants permissions', async () => {
      const res = await handler.upsertUserGrant({
        username: 'vahag',
        dbUserSuffix: 'k',
        password: 'ValidPassword123!',
        databaseName: 'vahag_architecturalnumbers',
      });

      assert.equal(res.fullDbUser, 'vahag_k');
      assert.equal(res.granted, true);
    });

    test('createSignonSession generates phpMyAdmin HMAC SSO token', async () => {
      const res = await handler.createSignonSession({
        username: 'vahag',
        databaseUser: 'vahag_k',
        databasePassword: 'SecretPassword',
      });

      assert.ok(res.signonToken.length === 32);
      assert.equal(res.redirectUrl, '/phpmyadmin/index.php');

      const sessFile = sysroot.resolve(`/tmp/sess_${res.signonToken}`);
      assert.ok(fs.existsSync(sessFile));
      const sessContent = fs.readFileSync(sessFile, 'utf8');
      assert.ok(sessContent.includes('PMA_single_signon_user|s:7:"vahag_k";'));
      assert.ok(sessContent.includes('PMA_single_signon_HMAC'));
    });

    test('dropDatabase rejects unauthorized database drop', async () => {
      await assert.rejects(
        () =>
          handler.dropDatabase({
            username: 'vahag',
            fullDatabaseName: 'otheruser_db',
          }),
        /PERMISSION_DENIED/
      );
    });

    test('dropDatabase drops authorized user database', async () => {
      const res = await handler.dropDatabase({
        username: 'vahag',
        fullDatabaseName: 'vahag_architecturalnumbers',
      });
      assert.equal(res.dropped, true);
    });
  });

  describe('6. FilesHandler', () => {
    const handler = new FilesHandler(sysroot);

    test('Strict chroot containment prevents directory traversal escape', () => {
      assert.throws(
        () => handler.resolveContained('vahag', '../../etc/shadow'),
        /PERMISSION_DENIED/
      );
      assert.throws(
        () => handler.resolveContained('vahag', '/../../var/log/panel'),
        /PERMISSION_DENIED/
      );
    });

    test('execOperation write, list, read, chmod, and delete inside tenant homedir', async () => {
      // 1. mkdir
      const mkdirRes = await handler.execOperation({
        username: 'vahag',
        action: 'mkdir',
        path: '/public_html/assets',
      });
      assert.equal(mkdirRes.success, true);

      // 2. write
      const writeRes = await handler.execOperation({
        username: 'vahag',
        action: 'write',
        path: '/public_html/index.php',
        content: '<?php echo "Hello clean-room"; ?>',
        mode: 0o644,
      });
      assert.equal(writeRes.success, true);
      assert.ok((writeRes.bytesWritten || 0) > 0);

      // 3. read
      const readRes = await handler.execOperation({
        username: 'vahag',
        action: 'read',
        path: '/public_html/index.php',
      });
      assert.equal(readRes.content, '<?php echo "Hello clean-room"; ?>');

      // 4. list
      const listRes = await handler.execOperation({
        username: 'vahag',
        action: 'list',
        path: '/public_html',
      });
      assert.ok(listRes.entries && listRes.entries.length >= 2);
      assert.ok(listRes.entries?.some((e) => e.name === 'index.php' && !e.isDir));
      assert.ok(listRes.entries?.some((e) => e.name === 'assets' && e.isDir));

      // 5. chmod
      const chmodRes = await handler.execOperation({
        username: 'vahag',
        action: 'chmod',
        path: '/public_html/index.php',
        mode: 0o640,
      });
      assert.equal(chmodRes.success, true);

      // 6. archive and extract
      const archiveRes = await handler.execOperation({
        username: 'vahag',
        action: 'archive',
        path: '/public_html',
        targetPath: '/backups/web.tar.gz',
        archiveFormat: 'tar.gz',
      });
      assert.equal(archiveRes.success, true);

      const extractRes = await handler.execOperation({
        username: 'vahag',
        action: 'extract',
        path: '/backups/web.tar.gz',
        targetPath: '/extracted',
      });
      assert.equal(extractRes.success, true);

      // 7. delete
      const delRes = await handler.execOperation({
        username: 'vahag',
        action: 'delete',
        path: '/public_html/index.php',
      });
      assert.equal(delRes.success, true);
      assert.equal(sysroot.exists('/home/vahag/public_html/index.php'), false);
    });
  });

  describe('7. WpToolkitHandler', () => {
    const handler = new WpToolkitHandler(sysroot);

    test('run status, install, createLogin, and autoUpdate', async () => {
      const statusRes = await handler.run({
        username: 'vahag',
        action: 'status',
        domain: 'architecturalnumbers.com',
        path: '/home/vahag/public_html',
      });
      assert.equal(statusRes.success, true);
      assert.equal(statusRes.version, '6.7.1');

      const installRes = await handler.run({
        username: 'vahag',
        action: 'install',
        domain: 'architecturalnumbers.com',
        path: '/home/vahag/public_html',
        dbName: 'vahag_wp',
        dbUser: 'vahag_k',
      });
      assert.equal(installRes.success, true);
      assert.ok(installRes.message?.includes('WordPress successfully installed'));

      const loginRes = await handler.run({
        username: 'vahag',
        action: 'createLogin',
        domain: 'architecturalnumbers.com',
        path: '/home/vahag/public_html',
      });
      assert.equal(loginRes.success, true);
      assert.ok(loginRes.loginUrl?.includes('wp-login.php'));

      const updateRes = await handler.run({
        username: 'vahag',
        action: 'autoUpdate',
        domain: 'architecturalnumbers.com',
        path: '/home/vahag/public_html',
      });
      assert.equal(updateRes.success, true);
    });
  });

  describe('8. CpmoveHandler', () => {
    const handler = new CpmoveHandler(sysroot);

    test('cpmove_export creates cPanel archive with progress reporting', async () => {
      const progressSteps: string[] = [];
      const res = await handler.run(
        {
          username: 'vahag',
          mode: 'cpmove_export',
        },
        {
          sysroot,
          emitProgress: (p) => {
            if (p.step) progressSteps.push(p.step);
          },
        }
      );

      assert.equal(res.success, true);
      assert.equal(res.mode, 'cpmove_export');
      assert.ok(res.archivePath?.endsWith('cpmove-vahag.tar.gz'));
      assert.ok(progressSteps.includes('dumping_mysql'));
      assert.ok(progressSteps.includes('completed'));
    });

    test('cpmove_import normalizes MySQL 8 collation and restores account', async () => {
      const progressSteps: string[] = [];
      const res = await handler.run(
        {
          username: 'vahag',
          mode: 'cpmove_import',
        },
        {
          sysroot,
          emitProgress: (p) => {
            if (p.step) progressSteps.push(p.step);
          },
        }
      );

      assert.equal(res.success, true);
      assert.equal(res.mode, 'cpmove_import');
      assert.ok(progressSteps.includes('restoring_mysql'));
      assert.ok(progressSteps.includes('restoring_homedir'));
    });

    test('restic_backup, restic_list, and restic_restore execute smoothly', async () => {
      const backupRes = await handler.run({
        username: 'vahag',
        mode: 'restic_backup',
      });
      assert.equal(backupRes.success, true);

      const listRes = await handler.run({
        username: 'vahag',
        mode: 'restic_list',
      });
      assert.equal(listRes.success, true);
      assert.ok(listRes.snapshots && listRes.snapshots.length > 0);

      const restoreRes = await handler.run({
        username: 'vahag',
        mode: 'restic_restore',
        snapshotId: 'a1b2c3d4',
      });
      assert.equal(restoreRes.success, true);
      assert.equal(restoreRes.snapshotId, 'a1b2c3d4');
    });
  });
});
