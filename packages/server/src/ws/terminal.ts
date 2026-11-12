/**
 * terminal.ts
 * Interactive PTY and shell streaming bridge (/ws/terminal?token=<jwt>)
 * using node-pty with graceful child_process.spawn fallback.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { WebSocket } from 'ws';

export interface TerminalAuthContext {
  userId: string;
  username: string;
  role: 'admin' | 'reseller' | 'customer';
  uid?: number;
  gid?: number;
  homeDir: string;
  isImpersonated?: boolean;
  operatorUsername?: string;
}

export interface TerminalOptions {
  sysrootPath?: string;
}

export interface IPtyProcess {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
}

export async function handleTerminalConnection(
  ws: WebSocket,
  _req: http.IncomingMessage,
  auth: TerminalAuthContext,
  options: TerminalOptions = {}
): Promise<void> {
  const sysroot = options.sysrootPath ?? process.env.PANEL_SYSROOT ?? './scratch/sysroot';
  const isSandbox = sysroot !== '/' && sysroot !== '';
  const homeTarget = isSandbox
    ? path.resolve(sysroot, `home/${auth.username}`)
    : auth.homeDir;

  if (!fs.existsSync(homeTarget)) {
    fs.mkdirSync(homeTarget, { recursive: true });
  }

  const shell = process.env.SHELL || (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh');
  const env: Record<string, string> = {
    ...process.env,
    HOME: homeTarget,
    USER: auth.username,
    LOGNAME: auth.username,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games',
  };

  // Attempt native node-pty with graceful child_process fallback
  let ptyInstance: IPtyProcess;
  try {
    const nodePty = await import('node-pty');
    const ptySpawn = nodePty.spawn || (nodePty as any).default?.spawn;

    const ptyOpts: any = {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: homeTarget,
      env,
    };
    if (!isSandbox && process.getuid && process.getuid() === 0 && auth.uid && auth.gid) {
      ptyOpts.uid = auth.uid;
      ptyOpts.gid = auth.gid;
    }

    const ptyProc = ptySpawn(shell, [], ptyOpts);

    ptyInstance = {
      write: (d: string) => ptyProc.write(d),
      resize: (cols: number, rows: number) => ptyProc.resize(cols, rows),
      kill: (sig?: string) => ptyProc.kill(sig),
      onData: (cb: (data: string) => void) => ptyProc.onData(cb),
      onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => ptyProc.onExit(cb),
    };
  } catch (_err) {
    // Graceful fallback to Node.js child_process.spawn
    ptyInstance = createChildProcessFallback(shell, homeTarget, env, !isSandbox ? auth : undefined);
  }

  // PTY -> WebSocket stream
  const dataSub = ptyInstance.onData((data: string) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  ptyInstance.onExit((e) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: e.exitCode, signal: e.signal }));
      ws.close(1000, 'Shell process exited');
    }
  });

  // Clean-up on disconnect with idempotent latch
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    clearInterval(pingInterval);
    if (dataSub && typeof dataSub.dispose === 'function') {
      try {
        dataSub.dispose();
      } catch {
        // Ignored
      }
    }

    try {
      ptyInstance.kill('SIGTERM');
    } catch {
      // Ignored
    }

    const killTimer = setTimeout(() => {
      try {
        ptyInstance.kill('SIGKILL');
      } catch {
        // Ignored
      }
    }, 1000);
    if (killTimer.unref) {
      killTimer.unref();
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  // WebSocket -> PTY stream
  ws.on('message', (message: Buffer | string) => {
    if (isCleanedUp || ws.readyState !== ws.OPEN) return;
    const msgStr = typeof message === 'string' ? message : message.toString('utf8');

    // Check for JSON control packet
    if (msgStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(msgStr);
        if (parsed.type === 'resize' && typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
          ptyInstance.resize(parsed.cols, parsed.rows);
          return;
        }
        if (parsed.type === 'stdin' && typeof parsed.data === 'string') {
          ptyInstance.write(parsed.data);
          return;
        }
        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
      } catch {
        // Fall-through to raw stdin write
      }
    }

    // Direct raw VT100 / keyboard keystrokes
    ptyInstance.write(msgStr);
  });

  // Keep-alive heartbeat
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);
  if (pingInterval.unref) {
    pingInterval.unref();
  }
}

/**
 * Fallback pseudo-terminal wrapper using standard child_process.spawn
 */
function createChildProcessFallback(
  shell: string,
  cwd: string,
  env: Record<string, string>,
  auth?: TerminalAuthContext
): IPtyProcess {
  const spawnOpts: any = {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  if (auth && process.getuid && process.getuid() === 0 && auth.uid && auth.gid) {
    spawnOpts.uid = auth.uid;
    spawnOpts.gid = auth.gid;
  }

  const cp: ChildProcess = spawn(shell, ['-i'], spawnOpts);
  const dataCallbacks: Array<(data: string) => void> = [];
  const exitCallbacks: Array<(e: { exitCode: number; signal?: number }) => void> = [];

  // Stream error listeners to prevent uncaughtException on pipe teardown / broken pipe (Defect 3)
  cp.stdin?.on('error', (_err: any) => {
    // EPIPE / EOF occurs normally when child process exits while bytes are buffered or in flight
  });
  cp.stdout?.on('error', (_err: any) => {
    // Ignore stdout pipe errors on process termination
  });
  cp.stderr?.on('error', (_err: any) => {
    // Ignore stderr pipe errors on process termination
  });
  cp.on('error', (_err: any) => {
    // Catch process execution/spawn errors
  });

  cp.stdout?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    for (const cb of dataCallbacks) cb(text);
  });

  cp.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    for (const cb of dataCallbacks) cb(text);
  });

  cp.on('close', (code, signal) => {
    for (const cb of exitCallbacks) {
      cb({ exitCode: code ?? 0, signal: signal ? 1 : 0 });
    }
  });

  return {
    write: (data: string) => {
      if (cp.stdin && !cp.stdin.destroyed && cp.stdin.writable) {
        try {
          cp.stdin.write(data, (_err) => {
            // Error-consuming callback prevents unhandled error event emission
          });
        } catch {
          // Synchronous stream write errors caught safely
        }
      }
    },
    resize: (_cols: number, _rows: number) => {
      // Ignored in non-PTY fallback
    },
    kill: (sig?: string) => {
      try {
        if (cp.exitCode === null && cp.signalCode === null) {
          if (cp.stdin && !cp.stdin.destroyed) {
            try {
              cp.stdin.destroy();
            } catch {
              // Ignore stdin destruction errors
            }
          }
          cp.kill((sig as NodeJS.Signals) || 'SIGTERM');
        }
      } catch {
        // Ignored if process already terminated
      }
    },
    onData: (cb: (data: string) => void) => {
      dataCallbacks.push(cb);
      return {
        dispose: () => {
          const idx = dataCallbacks.indexOf(cb);
          if (idx >= 0) dataCallbacks.splice(idx, 1);
        },
      };
    },
    onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => {
      exitCallbacks.push(cb);
      return {
        dispose: () => {
          const idx = exitCallbacks.indexOf(cb);
          if (idx >= 0) exitCallbacks.splice(idx, 1);
        },
      };
    },
  };
}
