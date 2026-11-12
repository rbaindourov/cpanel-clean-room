import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { SysrootEngine } from '../sysroot.ts';
import { AgentServer } from '../index.ts';

const testSandboxDir = path.resolve('./scratch/test_server_sandbox');
const testSocketPath = path.resolve('/tmp/test_agent_suite.sock');

function createClient(socketPath: string) {
  const client = net.createConnection(socketPath);
  let buffer = '';
  const messageListeners: Array<(msg: any) => void> = [];

  client.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      const listener = messageListeners.shift();
      if (listener) listener(parsed);
    }
  });

  return {
    client,
    send(msg: any): Promise<any> {
      return new Promise((resolve) => {
        messageListeners.push(resolve);
        client.write(JSON.stringify(msg) + '\n');
      });
    },
    sendRaw(raw: string): Promise<any> {
      return new Promise((resolve) => {
        messageListeners.push(resolve);
        client.write(raw);
      });
    },
    waitForNextMessage(): Promise<any> {
      return new Promise((resolve) => {
        messageListeners.push(resolve);
      });
    },
    close() {
      client.end();
    },
  };
}

test('AgentServer lifecycle, schema validation, streaming, and error handling', async () => {
  const sysroot = new SysrootEngine(testSandboxDir);
  const server = new AgentServer({ sysroot, socketPath: testSocketPath });

  const EchoSchema = z.object({
    username: z.string().min(3),
    domain: z.string(),
  });

  server.registerHandler('test.echo', async (params, ctx) => {
    return { received: params, sandbox: ctx.sysroot.isSandbox() };
  }, EchoSchema);

  server.registerHandler('test.throw', async () => {
    const err: any = new Error('Database connection failed');
    err.code = 'DB_UNAVAILABLE';
    err.details = { host: 'localhost', port: 3306 };
    throw err;
  });

  server.registerHandler('test.backupStream', async (_params, ctx) => {
    ctx.emitProgress({ percent: 25, step: 'dumping_sql' });
    ctx.emitProgress({ percent: 75, step: 'compressing_homedir' });
    return { archive: '/home/vahag/backups/cpmove-vahag.tar.gz', size: 102400 };
  });

  await server.start();
  assert.ok(fs.existsSync(testSocketPath));

  const client = createClient(testSocketPath);

  // 1. Successful handler invocation
  const successRes = await client.send({
    id: 'req-1',
    operation: 'test.echo',
    params: { username: 'vahag', domain: 'architecturalnumbers.com' },
  });
  assert.equal(successRes.id, 'req-1');
  assert.equal(successRes.success, true);
  assert.equal(successRes.data.received.username, 'vahag');

  // 2. Schema validation failure (username too short)
  const schemaFailRes = await client.send({
    id: 'req-2',
    operation: 'test.echo',
    params: { username: 'v', domain: 'architecturalnumbers.com' },
  });
  assert.equal(schemaFailRes.id, 'req-2');
  assert.equal(schemaFailRes.success, false);
  assert.equal(schemaFailRes.error.code, 'INVALID_PARAMS');

  // 3. Unknown operation
  const unknownRes = await client.send({
    id: 'req-3',
    operation: 'nonexistent.op',
    params: {},
  });
  assert.equal(unknownRes.id, 'req-3');
  assert.equal(unknownRes.error.code, 'METHOD_NOT_FOUND');

  // 4. Malformed JSON
  const malformedRes = await client.sendRaw('{ broken json\n');
  assert.equal(malformedRes.error.code, 'INVALID_JSON');

  // 5. Handler custom exception
  const throwRes = await client.send({
    id: 'req-4',
    operation: 'test.throw',
    params: {},
  });
  assert.equal(throwRes.error.code, 'DB_UNAVAILABLE');
  assert.equal(throwRes.error.details.port, 3306);

  // 6. Streaming progress frames
  const p1 = client.waitForNextMessage();
  const p2 = client.waitForNextMessage();
  const pFinal = client.waitForNextMessage();

  client.client.write(JSON.stringify({ id: 'stream-1', operation: 'test.backupStream', params: {} }) + '\n');

  const s1 = await p1;
  assert.equal(s1.type, 'progress');
  assert.equal(s1.percent, 25);

  const s2 = await p2;
  assert.equal(s2.type, 'progress');
  assert.equal(s2.percent, 75);

  const finalRes = await pFinal;
  assert.equal(finalRes.id, 'stream-1');
  assert.equal(finalRes.success, true);
  assert.equal(finalRes.data.archive, '/home/vahag/backups/cpmove-vahag.tar.gz');

  client.close();
  await server.stop();
  assert.equal(fs.existsSync(testSocketPath), false);
});
