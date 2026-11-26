import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';

test('SysrootEngine path resolution and sandbox isolation', () => {
  const sandboxDir = path.resolve('./scratch/test_sysroot_sandbox');
  const engine = new SysrootEngine(sandboxDir);

  assert.equal(engine.isSandbox(), true);
  assert.equal(engine.getBaseDir(), sandboxDir);

  const resolvedNginx = engine.resolve('/etc/nginx/sites-available/test.conf');
  assert.equal(resolvedNginx, path.join(sandboxDir, 'etc/nginx/sites-available/test.conf'));

  // Double-prefix prevention
  assert.equal(engine.resolve(resolvedNginx), resolvedNginx);

  // Traversal prevention
  assert.throws(
    () => engine.resolve('../../etc/shadow'),
    /SecurityError/
  );
});

test('SysrootEngine directory scaffolding and atomic file operations', () => {
  const sandboxDir = path.resolve('./scratch/test_sysroot_sandbox');
  const engine = new SysrootEngine(sandboxDir);

  // Scaffolding standard system tree
  engine.scaffold();
  assert.ok(fs.existsSync(path.join(sandboxDir, 'etc/nginx/sites-available')));
  assert.ok(fs.existsSync(path.join(sandboxDir, 'etc/bind/zones')));
  assert.ok(fs.existsSync(path.join(sandboxDir, 'var/lib/rspamd/dkim')));

  // Atomic file write
  const targetFile = '/etc/nginx/sites-available/example-store.com.conf';
  const testContent = 'server { listen 80; server_name example-store.com; }';
  const writtenPath = engine.atomicWriteFile(targetFile, testContent, { mode: 0o640 });

  assert.ok(fs.existsSync(writtenPath));
  assert.equal(engine.readFile(targetFile), testContent);
  const stats = fs.statSync(writtenPath);
  assert.equal(stats.mode & 0o777, 0o640);

  // File removal
  assert.equal(engine.removeFile(targetFile), true);
  assert.equal(engine.exists(targetFile), false);
});

test('SysrootEngine mock command execution in sandbox mode', async () => {
  const sandboxDir = path.resolve('./scratch/test_sysroot_sandbox');
  const engine = new SysrootEngine(sandboxDir);
  engine.clearMockExecutions();

  // Nginx syntax check mock
  const nginxRes = await engine.execCommand('nginx', ['-t']);
  assert.equal(nginxRes.mocked, true);
  assert.equal(nginxRes.code, 0);
  assert.ok(nginxRes.stdout.includes('syntax is ok'));

  // Systemctl reload mock
  const sysctlRes = await engine.execCommand('systemctl', ['reload', 'nginx']);
  assert.equal(sysctlRes.mocked, true);
  assert.equal(sysctlRes.code, 0);

  // Audit log assertions
  const records = engine.getMockExecutions();
  assert.equal(records.length, 2);
  assert.equal(records[0]?.cmd, 'nginx');
  assert.deepEqual(records[0]?.args, ['-t']);
  assert.equal(records[1]?.cmd, 'systemctl');
  assert.deepEqual(records[1]?.args, ['reload', 'nginx']);

  engine.clearMockExecutions();
  assert.equal(engine.getMockExecutions().length, 0);
});

test('SysrootEngine socket path length safeguard', () => {
  const sandboxDir = path.resolve('./scratch/test_sysroot_sandbox');
  const engine = new SysrootEngine(sandboxDir);

  const sock = engine.resolveSocketPath();
  assert.ok(sock.length <= 108, `Socket path length ${sock.length} exceeds 108 bytes`);
  assert.ok(sock.endsWith('.sock'));
});
