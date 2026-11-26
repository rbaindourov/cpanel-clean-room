import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { seedDemoData } from '../seed-demo.ts';
import { createServer } from '../server.ts';
import { JwtService } from '../auth/jwt.ts';
import { AgentdClient } from '../agentd-client.ts';

class MockAgentdClient extends AgentdClient {
  constructor() {
    super({ socketPath: '/tmp/nonexistent-mock.sock', autoConnect: false });
  }

  public override async call(operation: any, params: any, _options?: any): Promise<any> {
    if (operation === 'files.operation') {
      return { action: params.action, entries: [], path: params.path };
    }
    if (operation === 'web.upsertVhost') {
      return { vhostPath: '/etc/nginx/sites-available/' + params.domain, reloaded: true };
    }
    if (operation === 'mysql.createDatabase') {
      return { fullDatabaseName: `${params.username}_${params.databaseName}`, created: true };
    }
    if (operation === 'mail.upsertMailbox') {
      return { email: `${params.localPart}@${params.domain}`, maildirPath: '/home/' + params.username + '/Maildir', quotaBytes: params.quotaBytes };
    }
    if (operation === 'tenant.create') {
      return { uid: 1002, gid: 1002, homeDir: `/home/${params.username}`, sliceCreated: true };
    }
    return { success: true, op: operation };
  }
}

test('Comprehensive REST API Routes Suite', async (t) => {
  const db = new SQLiteAdapter(':memory:');
  createStandardMigrationRunner(db).runPendingMigrations();
  seedDemoData({ db, sysrootPath: './scratch/test_routes_sysroot' });

  const jwtSecret = 'test-routes-jwt-secret-key-32bytes!';
  const jwt = new JwtService(jwtSecret);

  const acmeToken = jwt.signAccessToken({
    id: db.prepare<any>('SELECT id FROM users WHERE username = ?').get('acme').id,
    username: 'acme',
    email: 'acme@example-store.com',
    role: 'customer',
  }).token;

  const adminToken = jwt.signAccessToken({
    id: db.prepare<any>('SELECT id FROM users WHERE username = ?').get('admin').id,
    username: 'admin',
    email: 'admin@cleanpanel.local',
    role: 'admin',
  }).token;

  const mockAgentd = new MockAgentdClient();
  const server = createServer({
    port: 0,
    host: '127.0.0.1',
    db,
    agentd: mockAgentd,
    jwtSecret,
    ssoSecret: 'test-sso-secret',
    sysrootPath: './scratch/test_routes_sysroot',
  });

  const { port, host } = await server.start();
  assert.ok(port > 0, 'server.start() must return a valid non-zero port');
  assert.notStrictEqual(port, 0, 'port 0 must resolve to bound OS ephemeral port');
  const baseUrl = `http://${host}:${port}/api/v1`;

  t.after(async () => {
    await server.stop();
    db.close();
  });

  // 1. Auth & Profile
  await t.test('GET /auth/me returns authenticated user identity', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.username, 'acme');
    assert.strictEqual(body.user.role, 'customer');
  });

  // 2. Metrics & System Stats
  await t.test('GET /metrics/system returns CPU, RAM, and load metrics', async () => {
    const res = await fetch(`${baseUrl}/metrics/system`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.cpu);
    assert.ok(body.memory);
  });

  // 3. Domains
  await t.test('GET /domains lists tenant domains including example-store.com', async () => {
    const res = await fetch(`${baseUrl}/domains`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.domains));
    assert.ok(body.domains.some((d: any) => d.domain_name === 'example-store.com'));
  });

  // 4. Databases
  await t.test('GET /databases/mysql/databases lists seeded MySQL databases', async () => {
    const res = await fetch(`${baseUrl}/databases/mysql/databases`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.databases));
    assert.ok(body.databases.some((d: any) => d.db_name === 'acme_store'));
  });

  // 5. Email
  await t.test('GET /email/mailboxes lists seeded mailboxes', async () => {
    const res = await fetch(`${baseUrl}/email/mailboxes`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.mailboxes));
    assert.ok(body.mailboxes.some((m: any) => m.email === 'acme@example-store.com'));
  });

  // 6. Security (API Tokens)
  await t.test('POST /security/tokens generates a new scoped token', async () => {
    const res = await fetch(`${baseUrl}/security/tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Automated CI Token',
        scopes: ['files:read', 'web:reload'],
      }),
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token.startsWith('cpr_tok_'));
    assert.strictEqual(body.tokenPrefix.length, 8);
  });

  // 7. Software (PHP Multi-Version)
  await t.test('GET /software/php/versions returns supported PHP runtimes', async () => {
    const res = await fetch(`${baseUrl}/software/php/versions`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.supportedVersions));
    assert.ok(body.supportedVersions.includes('8.2'));
    assert.ok(body.supportedVersions.includes('7.4'));
  });

  // 8. Advanced (Terminal Info)
  await t.test('GET /advanced/terminal/info returns shell and websocket endpoint metadata', async () => {
    const res = await fetch(`${baseUrl}/advanced/terminal/info`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.shell, '/bin/bash');
    assert.strictEqual(body.wsEndpoint, '/ws/terminal');
  });

  // 9. Preferences
  await t.test('PUT /preferences/theme saves theme selection', async () => {
    const res = await fetch(`${baseUrl}/preferences/theme`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme: 'dark' }),
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.theme, 'dark');
  });

  // 10. Admin WHM Routes & 1-Click Impersonation
  await t.test('Admin route GET /admin/tenants lists accounts and permits impersonation', async () => {
    const adminRes = await fetch(`${baseUrl}/admin/tenants`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminRes.status, 200);
    const adminBody: any = await adminRes.json();
    assert.strictEqual(adminBody.success, true);
    assert.ok(Array.isArray(adminBody.tenants));

    // Admin impersonating customer acme via X-Impersonate-User
    const impersonateRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Impersonate-User': 'acme',
      },
    });
    assert.strictEqual(impersonateRes.status, 200);
    const impBody: any = await impersonateRes.json();
    assert.strictEqual(impBody.effectiveUser.username, 'acme');
    assert.strictEqual(impBody.isImpersonating, true);
    assert.strictEqual(impBody.user.username, 'admin');
  });
});
