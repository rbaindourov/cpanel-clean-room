import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { WebSocket } from 'ws';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { createPmaSignonSession } from '../sso/pma.ts';
import {
  createRoundcubeSignonToken,
  verifyRoundcubeSignonToken,
} from '../sso/roundcube.ts';
import { PanelWebSocketManager } from '../ws/index.ts';
import { JwtService } from '../auth/jwt.ts';

test('SSO Bridges & WebSockets Dispatcher Suite', async (t) => {
  await t.test('phpMyAdmin SignonSession creates authenticated session token', () => {
    const res = createPmaSignonSession({
      username: 'vahag',
      databaseUser: 'vahag_wpuser',
      databasePassword: 'SecretPassword123!',
      targetDatabase: 'vahag_wp1',
      ssoSecret: 'test-pma-sso-secret-key-32bytes!',
      sysrootPath: './scratch/test_sso_sysroot',
    });

    assert.ok(res.signonToken);
    assert.strictEqual(res.cookieName, 'SignonSession');
    assert.ok(res.redirectUrl.includes('/pma/'));
    assert.ok(res.expiresAt);
  });

  await t.test('Roundcube SSO creates and cryptographically validates tokens', () => {
    const secret = 'test-roundcube-sso-secret-32bytes!';
    const sso = createRoundcubeSignonToken({
      email: 'vahag@architecturalnumbers.com',
      username: 'vahag',
      ssoSecret: secret,
      validityWindowSeconds: 300,
    });

    assert.ok(sso.ssoToken.includes('.'));
    assert.strictEqual(sso.email, 'vahag@architecturalnumbers.com');
    assert.ok(sso.redirectUrl.includes('_autologin=1'));

    // Valid token passes
    const check = verifyRoundcubeSignonToken(sso.ssoToken, secret);
    assert.strictEqual(check.valid, true);
    assert.strictEqual(check.payload?.email, 'vahag@architecturalnumbers.com');
    assert.strictEqual(check.payload?.username, 'vahag');

    // Tampered token fails
    const tampered = sso.ssoToken.slice(0, -4) + 'abcd';
    const tamperedCheck = verifyRoundcubeSignonToken(tampered, secret);
    assert.strictEqual(tamperedCheck.valid, false);

    // Wrong secret fails
    const wrongSecretCheck = verifyRoundcubeSignonToken(sso.ssoToken, 'wrong-secret-key-32bytes!');
    assert.strictEqual(wrongSecretCheck.valid, false);
  });

  await t.test('PanelWebSocketManager handles JWT authentication, endpoints, and rejections', async () => {
    const db = new SQLiteAdapter(':memory:');
    createStandardMigrationRunner(db).runPendingMigrations();

    // Insert user and domain
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, plan_name, quota_bytes, created_at)
      VALUES ('usr_vahag', 'vahag', 'hash', 'customer', 'vahag@architecturalnumbers.com', 'Standard', 10737418240, datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO domains (id, user_id, domain_name, type, docroot, php_version, created_at)
      VALUES ('dom_1', 'usr_vahag', 'architecturalnumbers.com', 'primary', '/home/vahag/public_html', '8.2', datetime('now'))
    `).run();

    const jwtSecret = 'ws-test-jwt-secret-32-chars-long!';
    const jwt = new JwtService(jwtSecret);
    const { token: validToken } = jwt.signAccessToken({
      id: 'usr_vahag',
      username: 'vahag',
      email: 'vahag@architecturalnumbers.com',
      role: 'customer',
    });

    const wsManager = new PanelWebSocketManager({
      jwtSecret,
      db,
      sysrootPath: './scratch/test_ws_sysroot',
    });

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('HTTP OK');
    });

    server.on('upgrade', (req, socket, head) => {
      wsManager.handleUpgrade(req, socket as net.Socket, head);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as net.AddressInfo).port;

    // 1. Connection without token should be rejected with 401
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal`);
      client.on('error', () => {
        // Expected error due to HTTP 401 rejection
        resolve();
      });
      client.on('open', () => {
        client.close();
        reject(new Error('Expected rejection for unauthenticated terminal upgrade'));
      });
    });

    // 2. Connection with invalid token rejected with 401
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal?token=invalid.jwt.token`);
      client.on('error', () => {
        resolve();
      });
      client.on('open', () => {
        client.close();
        reject(new Error('Expected rejection for invalid token'));
      });
    });

    // 3. Unknown endpoint rejected with 404
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/unknown?token=${validToken}`);
      client.on('error', () => {
        resolve();
      });
      client.on('open', () => {
        client.close();
        reject(new Error('Expected rejection for unknown endpoint'));
      });
    });

    // 4. Logs endpoint for unauthorized domain rejected with 403
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/logs/unowneddomain.com?token=${validToken}`);
      client.on('error', () => {
        resolve();
      });
      client.on('open', () => {
        client.close();
        reject(new Error('Expected rejection for unowned domain logs'));
      });
    });

    // 5. Authenticated terminal connection establishes and cleanly disconnects
    await new Promise<void>((resolve, reject) => {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal?token=${validToken}`);
      client.on('error', reject);
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'stdin', data: 'echo test\n' }));
        setTimeout(() => {
          client.close();
          resolve();
        }, 200);
      });
    });

    wsManager.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
});
