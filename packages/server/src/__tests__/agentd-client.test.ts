import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  AgentdClient,
  AgentdError,
  AgentdTimeoutError,
} from '../agentd-client.ts';

test('AgentdClient Unix Domain Socket Client Suite', async (t) => {
  const sockPath = path.join(os.tmpdir(), `test-agentd-${crypto.randomBytes(4).toString('hex')}.sock`);

  let server: net.Server;
  const connections: net.Socket[] = [];

  // Start mock NDJSON agentd server
  await new Promise<void>((resolve) => {
    server = net.createServer((socket) => {
      connections.push(socket);
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let newlineIdx: number;

        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (!line) continue;

          try {
            const req = JSON.parse(line);

            if (req.operation === 'test.echo') {
              socket.write(JSON.stringify({ id: req.id, success: true, data: req.params }) + '\n');
            } else if (req.operation === 'test.stream') {
              // Send stream progress event then result
              socket.write(JSON.stringify({
                id: req.id,
                type: 'progress',
                step: 'processing',
                percent: 50,
                message: 'Halfway',
              }) + '\n');

              setTimeout(() => {
                socket.write(JSON.stringify({
                  id: req.id,
                  success: true,
                  data: { finished: true },
                }) + '\n');
              }, 10);
            } else if (req.operation === 'test.error') {
              socket.write(JSON.stringify({
                id: req.id,
                success: false,
                error: {
                  code: 'DATABASE_LOCKED',
                  message: 'Database is locked by another transaction',
                  status: 423,
                },
              }) + '\n');
            } else if (req.operation === 'test.slow') {
              // Intentionally do not reply to test timeout
            } else {
              socket.write(JSON.stringify({
                id: req.id,
                success: true,
                data: { success: true, op: req.operation },
              }) + '\n');
            }
          } catch {
            // Bad frame
          }
        }
      });
    });

    server.listen(sockPath, () => resolve());
  });

  t.after(async () => {
    for (const conn of connections) {
      conn.destroy();
    }
    server.close();
    try {
      if (fs.existsSync(sockPath)) {
        fs.unlinkSync(sockPath);
      }
    } catch {
      // Ignore cleanup error
    }
  });

  await t.test('Client connects and executes an RPC operation', async () => {
    const client = new AgentdClient({
      socketPath: sockPath,
      defaultTimeoutMs: 2000,
      autoConnect: true,
    });

    const res = await client.call<any>('test.echo', { hello: 'world' });
    assert.deepStrictEqual(res, { hello: 'world' });

    await client.close();
  });

  await t.test('Client multiplexes concurrent requests over a single socket', async () => {
    const client = new AgentdClient({
      socketPath: sockPath,
      defaultTimeoutMs: 2000,
      autoConnect: true,
    });

    const promises = Array.from({ length: 10 }, (_, i) =>
      client.call<any>('test.echo', { index: i, nonce: crypto.randomBytes(4).toString('hex') })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 10);

    for (let i = 0; i < 10; i++) {
      assert.strictEqual(results[i].index, i);
      assert.ok(results[i].nonce);
    }

    await client.close();
  });

  await t.test('Client receives streaming progress messages', async () => {
    const client = new AgentdClient({
      socketPath: sockPath,
      defaultTimeoutMs: 2000,
      autoConnect: true,
    });

    const progressMessages: any[] = [];
    const res = await client.call<any>(
      'test.stream',
      { target: 'backup' },
      {
        onProgress: (msg) => {
          progressMessages.push(msg);
        },
      }
    );

    assert.strictEqual(res.finished, true);
    assert.strictEqual(progressMessages.length, 1);
    assert.strictEqual(progressMessages[0].step, 'processing');
    assert.strictEqual(progressMessages[0].percent, 50);

    await client.close();
  });

  await t.test('Client translates structured RPC errors to AgentdError', async () => {
    const client = new AgentdClient({
      socketPath: sockPath,
      defaultTimeoutMs: 2000,
      autoConnect: true,
    });

    await assert.rejects(
      async () => {
        await client.call('test.error' as any, {});
      },
      (err: any) => {
        assert.ok(err instanceof AgentdError);
        assert.strictEqual(err.code, 'DATABASE_LOCKED');
        assert.strictEqual(err.statusCode, 423);
        assert.ok(err.message.includes('locked'));
        return true;
      }
    );

    await client.close();
  });

  await t.test('Client enforces timeout and raises AgentdTimeoutError', async () => {
    const client = new AgentdClient({
      socketPath: sockPath,
      defaultTimeoutMs: 100, // 100ms short timeout
      autoConnect: true,
    });

    await assert.rejects(
      async () => {
        await client.call('test.slow' as any, {}, { timeoutMs: 100 });
      },
      (err: any) => {
        assert.ok(err instanceof AgentdTimeoutError);
        assert.strictEqual(err.code, 'TIMEOUT');
        assert.strictEqual(err.statusCode, 504);
        return true;
      }
    );

    await client.close();
  });
});
