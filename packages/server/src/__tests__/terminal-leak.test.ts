import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import { WebSocket } from 'ws';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { PanelWebSocketManager } from '../ws/index.ts';
import { JwtService } from '../auth/jwt.ts';

function getDirectChildProcesses(parentPid: number): number[] {
  const children: number[] = [];
  try {
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = parseInt(entry, 10);
      try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        const lastParen = stat.lastIndexOf(')');
        if (lastParen === -1) continue;
        const rest = stat.slice(lastParen + 2).split(' ');
        const ppid = parseInt(rest[1], 10);
        if (ppid === parentPid) {
          children.push(pid);
        }
      } catch {
        // Ephemeral process exited between readdir and stat read
      }
    }
  } catch {
    // Non-Linux or restricted /proc
  }
  return children;
}

test('Terminal WebSocket Child Process Cleanup & Leak Prevention', async (t) => {
  const db = new SQLiteAdapter(':memory:');
  createStandardMigrationRunner(db).runPendingMigrations();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, email, quota_bytes, uid, gid, home_dir, status, created_at)
    VALUES ('usr_acme', 'acme', 'hash', 'customer', 'acme@example-store.com', 10737418240, 1001, 1001, '/home/acme', 'active', datetime('now'))
  `).run();

  const jwtSecret = 'test-terminal-leak-secret-32-chars-long!';
  const jwt = new JwtService(jwtSecret);
  const { token } = jwt.signAccessToken({
    id: 'usr_acme',
    username: 'acme',
    email: 'acme@example-store.com',
    role: 'customer',
  });

  const wsManager = new PanelWebSocketManager({
    jwtSecret,
    db,
    sysrootPath: './scratch/test_terminal_leak_sysroot',
  });

  const server = http.createServer((_req, res) => res.end('OK'));
  server.on('upgrade', (req, socket, head) => {
    wsManager.handleUpgrade(req, socket as net.Socket, head);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;

  t.after(async () => {
    wsManager.close();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  await t.test('Child process spawned by terminal WebSocket is terminated on disconnect', async () => {
    const initialChildren = getDirectChildProcesses(process.pid);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    // Allow shell process time to spawn
    await new Promise((r) => setTimeout(r, 400));

    const activeChildren = getDirectChildProcesses(process.pid);
    const spawnedPids = activeChildren.filter((p) => !initialChildren.includes(p));
    assert.ok(spawnedPids.length > 0, 'Terminal connection must spawn child shell process');

    // Close socket to trigger cleanup (SIGTERM followed by SIGKILL escalation)
    ws.close();

    // Allow 1500ms (1000ms escalation timer + buffer)
    await new Promise((r) => setTimeout(r, 1500));

    // Verify all spawned shell PIDs have terminated
    for (const pid of spawnedPids) {
      let isAlive = false;
      try {
        process.kill(pid, 0);
        isAlive = true;
      } catch {
        isAlive = false;
      }
      assert.strictEqual(isAlive, false, `Child process ${pid} must be terminated`);
    }

    const remainingChildren = getDirectChildProcesses(process.pid);
    const leakedPids = remainingChildren.filter((p) => !initialChildren.includes(p));
    assert.strictEqual(leakedPids.length, 0, 'Zero child processes must leak after disconnect');
  });
});
