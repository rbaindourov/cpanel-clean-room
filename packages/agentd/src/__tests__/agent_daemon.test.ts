import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createAgentDaemon } from '../index.ts';

const testSandboxDir = path.resolve('./scratch/test_daemon_sandbox');
const testSocketPath = path.resolve('/tmp/test_daemon_full.sock');

function createClient(socketPath: string) {
  const client = net.createConnection(socketPath);
  let buffer = '';
  const messageQueue: any[] = [];
  const listenerQueue: Array<(msg: any) => void> = [];

  function dispatch() {
    while (messageQueue.length > 0 && listenerQueue.length > 0) {
      const msg = messageQueue.shift();
      const listener = listenerQueue.shift();
      if (listener) listener(msg);
    }
  }

  client.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      messageQueue.push(JSON.parse(line));
      dispatch();
    }
  });

  return {
    client,
    send(msg: any): Promise<any> {
      return new Promise((resolve) => {
        listenerQueue.push(resolve);
        client.write(JSON.stringify(msg) + '\n');
        dispatch();
      });
    },
    waitForNextMessage(): Promise<any> {
      return new Promise((resolve) => {
        listenerQueue.push(resolve);
        dispatch();
      });
    },
    close() {
      client.end();
    },
  };
}

describe('createAgentDaemon Full Integration Over Unix Domain Socket', () => {
  test('Boots daemon, routes all 8 handlers over NDJSON socket, and shuts down cleanly', async () => {
    const daemon = createAgentDaemon({
      sysrootBase: testSandboxDir,
      socketPath: testSocketPath,
    });
    daemon.getSysroot().scaffold();

    const actualSockPath = await daemon.start();
    assert.equal(actualSockPath, testSocketPath);
    assert.ok(fs.existsSync(testSocketPath));

    const client = createClient(testSocketPath);

    try {
      // 1. Tenant Create
      const tenantRes = await client.send({
        id: 'req-tenant',
        operation: 'tenant.create',
        params: {
          username: 'vahag',
          plan: { cpuQuota: '200%', memoryMax: '2G', tasksMax: 150, diskQuotaBytes: 10737418240 },
        },
      });
      assert.equal(tenantRes.success, true);
      assert.equal(tenantRes.data.uid, 1005);
      assert.equal(tenantRes.data.sliceCreated, true);

      // 2. Web Upsert Vhost
      const webRes = await client.send({
        id: 'req-web',
        operation: 'web.upsertVhost',
        params: {
          username: 'vahag',
          domain: 'architecturalnumbers.com',
          aliases: ['www.architecturalnumbers.com'],
          documentRoot: '/home/vahag/public_html',
          phpVersion: '8.3',
          useApacheBackend: false,
          ssl: { enabled: true },
        },
      });
      assert.equal(webRes.success, true);
      assert.equal(webRes.data.reloaded, true);

      // 3. DNS Upsert Zone
      const dnsRes = await client.send({
        id: 'req-dns',
        operation: 'dns.upsertZone',
        params: {
          domain: 'architecturalnumbers.com',
          primaryNs: 'ns1.winwinhost.com.',
          records: [
            { name: '@', type: 'A', value: '192.168.11.32', ttl: 300 },
            { name: '@', type: 'MX', value: 'mail.architecturalnumbers.com.', priority: 10 },
          ],
        },
      });
      assert.equal(dnsRes.success, true);
      assert.ok(dnsRes.data.serial > 2026000000);

      // 4. Mail Upsert Domain (DKIM)
      const mailRes = await client.send({
        id: 'req-mail',
        operation: 'mail.upsertDomain',
        params: {
          domain: 'architecturalnumbers.com',
          dkimSelector: 'default',
          keyType: 'rsa2048',
        },
      });
      assert.equal(mailRes.success, true);
      assert.ok(mailRes.data.dkimDnsRecord.value.startsWith('v=DKIM1; k=rsa; p='));

      // 5. MySQL Create Database & Grants
      const dbRes = await client.send({
        id: 'req-db',
        operation: 'mysql.createDatabase',
        params: {
          username: 'vahag',
          databaseName: 'architecturalnumbers',
        },
      });
      assert.equal(dbRes.success, true);
      assert.equal(dbRes.data.fullDatabaseName, 'vahag_architecturalnumbers');

      const ssoRes = await client.send({
        id: 'req-sso',
        operation: 'mysql.createSignonSession',
        params: {
          username: 'vahag',
          databaseUser: 'vahag_k',
        },
      });
      assert.equal(ssoRes.success, true);
      assert.equal(ssoRes.data.redirectUrl, '/phpmyadmin/index.php');

      // 6. Files Operation
      const fileWriteRes = await client.send({
        id: 'req-file-write',
        operation: 'files.operation',
        params: {
          username: 'vahag',
          action: 'write',
          path: '/public_html/test.txt',
          content: 'Daemon live socket test verified',
        },
      });
      assert.equal(fileWriteRes.success, true);

      const fileListRes = await client.send({
        id: 'req-file-list',
        operation: 'files.operation',
        params: {
          username: 'vahag',
          action: 'list',
          path: '/public_html',
        },
      });
      assert.equal(fileListRes.success, true);
      assert.ok(fileListRes.data.entries.some((e: any) => e.name === 'test.txt'));

      // 7. WP Toolkit
      const wpRes = await client.send({
        id: 'req-wp',
        operation: 'wp.toolkit',
        params: {
          username: 'vahag',
          action: 'status',
          domain: 'architecturalnumbers.com',
          path: '/home/vahag/public_html',
        },
      });
      assert.equal(wpRes.success, true);
      assert.equal(wpRes.data.version, '6.7.1');

      // 8. Backup cpmove & Streaming progress
      const messages: any[] = [];
      const donePromise = new Promise<any>((resolve) => {
        const checkMessage = (msg: any) => {
          messages.push(msg);
          if (msg.success !== undefined) {
            resolve(msg);
          } else {
            client.waitForNextMessage().then(checkMessage);
          }
        };
        client.waitForNextMessage().then(checkMessage);
      });

      client.client.write(
        JSON.stringify({
          id: 'req-backup-stream',
          operation: 'backup.cpmoveAndRestic',
          params: {
            username: 'vahag',
            mode: 'cpmove_export',
          },
        }) + '\n'
      );

      const backupFinal = await donePromise;
      assert.equal(backupFinal.success, true);
      assert.ok(backupFinal.data.archivePath.includes('cpmove-vahag.tar.gz'));
      assert.ok(messages.some((m) => m.type === 'progress'));
    } finally {
      client.close();
      await daemon.stop();
    }

    assert.equal(fs.existsSync(testSocketPath), false);
  });
});
