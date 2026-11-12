import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { z } from 'zod';
import { SysrootEngine, sysroot as defaultSysroot } from './sysroot.ts';

// Schemas & Types from @cpanel-clean-room/shared
import {
  RpcRequestSchema,
  RpcResponseSchema,
  RpcErrorSchema,
  RPC_OPERATIONS,
} from '@cpanel-clean-room/shared';

// Handler Modules
import { registerTenantHandlers } from './handlers/tenant.ts';
import { registerWebPhpHandlers } from './handlers/web-php.ts';
import { registerDnsBindHandlers } from './handlers/dns-bind.ts';
import { registerMailRspamdHandlers } from './handlers/mail-rspamd.ts';
import { registerMysqlHandlers } from './handlers/mysql.ts';
import { registerFilesHandlers } from './handlers/files.ts';
import { registerWpToolkitHandlers } from './handlers/wp-toolkit.ts';
import { registerCpmoveHandlers } from './handlers/cpmove.ts';

export interface RpcRequest<T = any> {
  id: string;
  operation?: string;
  method?: string;
  params: T;
  callerUid?: number;
}

export interface RpcResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface HandlerContext {
  sysroot: SysrootEngine;
  callerUid?: number;
  emitProgress: (progress: { percent?: number; step?: string; message?: string; data?: any }) => void;
}

export type HandlerFunction<P = any, R = any> = (
  params: P,
  context: HandlerContext
) => Promise<R> | R;

export interface HandlerRegistration {
  handler: HandlerFunction;
  schema?: z.ZodType<any>;
}

export class AgentServer {
  private server: net.Server | null = null;
  private sysroot: SysrootEngine;
  private socketPath: string;
  private handlers = new Map<string, HandlerRegistration>();
  private activeSockets = new Set<net.Socket>();
  private isShuttingDown = false;

  constructor(options?: { sysroot?: SysrootEngine; socketPath?: string }) {
    this.sysroot = options?.sysroot || defaultSysroot;
    this.socketPath = options?.socketPath || this.sysroot.resolveSocketPath();
  }

  public getSysroot(): SysrootEngine {
    return this.sysroot;
  }

  public getSocketPath(): string {
    return this.socketPath;
  }

  public registerHandler<P = any, R = any>(
    operation: string,
    handler: HandlerFunction<P, R>,
    schema?: z.ZodType<any, any, any>
  ): this {
    this.handlers.set(operation, { handler, schema });
    return this;
  }

  public async start(): Promise<string> {
    if (this.server) {
      throw new Error('AgentServer is already running');
    }

    this.sysroot.ensureDir(path.dirname(this.socketPath));

    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Socket cleanup
      }
    }

    this.server = net.createServer((socket) => this.handleConnection(socket));

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(this.socketPath, () => {
        this.server!.removeListener('error', reject);
        resolve();
      });
    });

    try {
      fs.chmodSync(this.socketPath, 0o660);
    } catch {
      // Best-effort in unprivileged dev
    }

    return this.socketPath;
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    if (fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Ignore unlink error on shutdown
      }
    }
    this.isShuttingDown = false;
  }

  private handleConnection(socket: net.Socket): void {
    if (this.isShuttingDown) {
      socket.destroy();
      return;
    }

    this.activeSockets.add(socket);
    socket.on('close', () => {
      this.activeSockets.delete(socket);
    });

    let buffer = '';

    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        await this.processMessage(socket, trimmed);
      }
    });

    socket.on('error', () => {
      // Handle socket error gracefully
    });
  }

  private async processMessage(socket: net.Socket, line: string): Promise<void> {
    let req: any;
    try {
      req = JSON.parse(line);
    } catch (err: any) {
      this.sendResponse(socket, {
        id: 'unknown',
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Malformed NDJSON frame: could not parse JSON',
          details: err.message,
        },
      });
      return;
    }

    if (!req || typeof req !== 'object' || !req.id || (!req.operation && !req.method)) {
      this.sendResponse(socket, {
        id: req?.id || 'unknown',
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: "Request must be an object containing 'id' and 'operation' (or 'method')",
        },
      });
      return;
    }

    const opName = req.operation || req.method;
    const reg = this.handlers.get(opName);
    if (!reg) {
      this.sendResponse(socket, {
        id: req.id,
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown operation '${opName}'`,
        },
      });
      return;
    }

    let params = req.params ?? {};
    if (reg.schema) {
      const parsed = reg.schema.safeParse(params);
      if (!parsed.success) {
        this.sendResponse(socket, {
          id: req.id,
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Parameter validation failed against schema',
            details: parsed.error.issues,
          },
        });
        return;
      }
      params = parsed.data;
    }

    const context: HandlerContext = {
      sysroot: this.sysroot,
      callerUid: req.callerUid,
      emitProgress: (progress) => {
        if (!socket.destroyed) {
          socket.write(
            JSON.stringify({
              id: req.id,
              type: 'progress',
              ...progress,
            }) + '\n'
          );
        }
      },
    };

    try {
      const result = await reg.handler(params, context);
      this.sendResponse(socket, {
        id: req.id,
        success: true,
        data: result,
      });
    } catch (err: any) {
      this.sendResponse(socket, {
        id: req.id,
        success: false,
        error: {
          code: err.code || 'EXEC_FAILED',
          message: err.message || 'Operation execution failed',
          details: err.details,
        },
      });
    }
  }

  private sendResponse(socket: net.Socket, res: RpcResponse): void {
    if (!socket.destroyed) {
      socket.write(JSON.stringify(res) + '\n');
    }
  }
}

/**
 * Creates and configures the standard panel-agentd daemon with all 8 handler subsystems.
 */
export function createAgentDaemon(options?: { sysrootBase?: string; socketPath?: string }): AgentServer {
  const customSysroot = new SysrootEngine(options?.sysrootBase);
  const server = new AgentServer({
    sysroot: customSysroot,
    socketPath: options?.socketPath,
  });

  // Wire all 8 handler subsystems
  registerTenantHandlers(server);
  registerWebPhpHandlers(server);
  registerDnsBindHandlers(server);
  registerMailRspamdHandlers(server);
  registerMysqlHandlers(server);
  registerFilesHandlers(server);
  registerWpToolkitHandlers(server);
  registerCpmoveHandlers(server);

  return server;
}

// Standalone execution entrypoint
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const daemon = createAgentDaemon();
  daemon.getSysroot().scaffold();
  daemon
    .start()
    .then((sock) => {
      console.log(`[panel-agentd] Privileged root daemon listening on ${sock}`);
    })
    .catch((err) => {
      console.error('[panel-agentd] Fatal error during startup:', err);
      process.exit(1);
    });

  const handleSignal = async (sig: string) => {
    console.log(`[panel-agentd] Received ${sig}, shutting down...`);
    await daemon.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}
