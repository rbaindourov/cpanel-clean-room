/**
 * logs.ts
 * Real-time log tailing WebSocket bridge (/ws/logs/:domain?token=<jwt>)
 * with history backlog streaming and file-offset watcher.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { WebSocket } from 'ws';
import type { TerminalAuthContext } from './terminal.ts';

export interface LogStreamMessage {
  type: 'log' | 'history' | 'error';
  source: 'nginx-error' | 'nginx-access' | 'php-fpm';
  domain: string;
  timestamp: string;
  line: string;
  level?: 'error' | 'warn' | 'info';
}

export interface LogsOptions {
  sysrootPath?: string;
}

export async function handleLogsConnection(
  ws: WebSocket,
  _req: http.IncomingMessage,
  _auth: TerminalAuthContext,
  domain: string,
  options: LogsOptions = {}
): Promise<void> {
  const sysroot = options.sysrootPath ?? process.env.PANEL_SYSROOT ?? './scratch/sysroot';
  const isSandbox = sysroot !== '/' && sysroot !== '';
  const basePath = isSandbox ? sysroot : '';

  // Determine target log files
  const errorLogPath = path.resolve(basePath, `var/log/nginx/${domain}.error.log`);

  // Ensure log directory exists in sandbox
  const logDir = path.dirname(errorLogPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create empty file if it doesn't exist yet to prevent ENOENT
  if (!fs.existsSync(errorLogPath)) {
    fs.writeFileSync(errorLogPath, `[${new Date().toISOString()}] [notice] Log initialized for ${domain}\n`);
  }

  // 1. Send recent history backlog (last 50 lines)
  const historyLines = await readLastLines(errorLogPath, 50);
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: 'history',
      domain,
      source: 'nginx-error',
      lines: historyLines.map((line) => formatLogEnvelope('nginx-error', domain, line)),
    }));
  }

  // 2. Active file watching and tail streaming
  let lastSize = fs.existsSync(errorLogPath) ? fs.statSync(errorLogPath).size : 0;
  let watcher: fs.FSWatcher | null = null;

  try {
    watcher = fs.watch(errorLogPath, async (eventType) => {
      if (eventType !== 'change' || ws.readyState !== ws.OPEN) return;

      try {
        const stats = fs.statSync(errorLogPath);
        if (stats.size < lastSize) {
          // File was truncated or rotated
          lastSize = 0;
        }

        if (stats.size > lastSize) {
          const stream = fs.createReadStream(errorLogPath, {
            start: lastSize,
            end: stats.size,
            encoding: 'utf8',
          });

          lastSize = stats.size;
          const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

          for await (const line of rl) {
            if (line.trim() && ws.readyState === ws.OPEN) {
              const payload = formatLogEnvelope('nginx-error', domain, line);
              ws.send(JSON.stringify(payload));
            }
          }
        }
      } catch {
        // Read error during rotation
      }
    });
  } catch (_err) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        domain,
        line: 'Failed to initialize filesystem log watcher',
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // Clean-up on close
  ws.on('close', () => {
    if (watcher) watcher.close();
  });
  ws.on('error', () => {
    if (watcher) watcher.close();
  });
}

function formatLogEnvelope(
  source: 'nginx-error' | 'nginx-access' | 'php-fpm',
  domain: string,
  rawLine: string
): LogStreamMessage {
  let level: 'error' | 'warn' | 'info' = 'info';
  if (rawLine.includes('[error]')) level = 'error';
  else if (rawLine.includes('[warn]')) level = 'warn';

  return {
    type: 'log',
    source,
    domain,
    timestamp: new Date().toISOString(),
    line: rawLine,
    level,
  };
}

async function readLastLines(filePath: string, maxLines: number): Promise<string[]> {
  if (!fs.existsSync(filePath)) return [];
  const lines: string[] = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) lines.push(line);
    if (lines.length > maxLines * 2) lines.shift();
  }
  return lines.slice(-maxLines);
}
