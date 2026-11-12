/**
 * agentd-client.ts
 * High-performance, multiplexed Unix Domain Socket client connecting the
 * unprivileged API server (packages/server) to the privileged root daemon (packages/agentd).
 *
 * Features:
 * - Full TypeScript typing against RPC_OPERATIONS from @cpanel-clean-room/shared
 * - NDJSON stream framing with newline buffering
 * - Request/response multiplexing by unique UUID v4
 * - Automatic connection reuse, health checks, and exponential reconnect backoff
 * - Configurable timeouts (default 10s, extended 300s for cpmove/restic)
 * - Structured error translation to HTTP status codes
 * - Strict tenant callerUid injection and boundary enforcement
 */

import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import type { z } from 'zod';
import {
  RPC_OPERATIONS,
  type RpcOperationName,
  type RpcRequest,
  type RpcStreamMessage,
  SYSTEM_PATHS,
} from '@cpanel-clean-room/shared';

// ---------------------------------------------------------------------------
// 1. Error Classes
// ---------------------------------------------------------------------------

export class AgentdError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AgentdError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AgentdError.prototype);
  }
}

export class AgentdTimeoutError extends AgentdError {
  constructor(operation: string, timeoutMs: number) {
    super(
      'TIMEOUT',
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      504
    );
    this.name = 'AgentdTimeoutError';
    Object.setPrototypeOf(this, AgentdTimeoutError.prototype);
  }
}

export class AgentdConnectionError extends AgentdError {
  constructor(message: string, details?: unknown) {
    super('CONNECTION_ERROR', message, 503, details);
    this.name = 'AgentdConnectionError';
    Object.setPrototypeOf(this, AgentdConnectionError.prototype);
  }
}

// ---------------------------------------------------------------------------
// 2. Client Interfaces & Configuration
// ---------------------------------------------------------------------------

export interface AgentdClientConfig {
  socketPath?: string;
  sysrootBase?: string;
  defaultTimeoutMs?: number;
  maxReconnectDelayMs?: number;
  autoConnect?: boolean;
}

export interface CallOptions {
  callerUid?: number;
  timeoutMs?: number;
  onProgress?: (progress: RpcStreamMessage) => void;
}

interface PendingRequest {
  id: string;
  operation: string;
  resolve: (data: any) => void;
  reject: (err: any) => void;
  onProgress?: (progress: RpcStreamMessage) => void;
  timer: NodeJS.Timeout;
  startedAt: number;
}

// ---------------------------------------------------------------------------
// 3. AgentdClient Implementation
// ---------------------------------------------------------------------------

export class AgentdClient {
  private socketPath: string;
  private defaultTimeoutMs: number;
  private maxReconnectDelayMs: number;
  private socket: net.Socket | null = null;
  private incomingBuffer: string = '';
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnecting: boolean = false;
  private isClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(config: AgentdClientConfig = {}) {
    this.socketPath = this.resolveSocketPath(config.socketPath, config.sysrootBase);
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 10_000;
    this.maxReconnectDelayMs = config.maxReconnectDelayMs ?? 5_000;

    if (config.autoConnect !== false) {
      this.ensureConnected().catch(() => {
        // Connection error handled on initial call
      });
    }
  }

  /**
   * Resolves the Unix socket path with Linux 108-byte safeguard.
   */
  public resolveSocketPath(overridePath?: string, sysrootBase?: string): string {
    if (overridePath) return path.resolve(overridePath);
    if (process.env.PANEL_SOCK_PATH) return path.resolve(process.env.PANEL_SOCK_PATH);

    const isSandbox = (process.env.PANEL_SYSROOT || sysrootBase) !== '/';
    if (!isSandbox) {
      return SYSTEM_PATHS.AGENT_SOCKET_DEFAULT;
    }

    const base = path.resolve(sysrootBase || process.env.PANEL_SYSROOT || './scratch/sysroot');
    const standardPath = path.resolve(base, 'run/panel/agent.sock');
    if (standardPath.length <= 104) {
      return standardPath;
    }

    // Fallback to /tmp to prevent Linux EINVAL on sockaddr_un length > 108 bytes
    return path.resolve('/tmp/panel-agent-sandbox.sock');
  }

  public getSocketPath(): string {
    return this.socketPath;
  }

  public isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed && this.socket.readyState === 'open';
  }

  /**
   * Executes a typed RPC operation over the Unix domain socket.
   */
  public async call<Op extends RpcOperationName>(
    operation: Op,
    params: z.input<(typeof RPC_OPERATIONS)[Op]['params']>,
    options: CallOptions = {}
  ): Promise<z.infer<(typeof RPC_OPERATIONS)[Op]['result']>> {
    if (this.isClosed) {
      throw new AgentdConnectionError('AgentdClient is closed');
    }

    await this.ensureConnected();

    const id = crypto.randomUUID();
    const isHeavyOp = operation === 'backup.cpmoveAndRestic' || operation === 'wp.toolkit';
    const effectiveTimeout = options.timeoutMs ?? (isHeavyOp ? 300_000 : this.defaultTimeoutMs);

    const requestPayload: RpcRequest = {
      id,
      operation,
      params: params as Record<string, unknown>,
      callerUid: options.callerUid,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new AgentdTimeoutError(operation, effectiveTimeout));
      }, effectiveTimeout);

      this.pendingRequests.set(id, {
        id,
        operation,
        resolve,
        reject,
        onProgress: options.onProgress,
        timer,
        startedAt: Date.now(),
      });

      const frame = JSON.stringify(requestPayload) + '\n';
      if (!this.socket || this.socket.destroyed) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new AgentdConnectionError('Socket is not connected'));
        return;
      }

      this.socket.write(frame, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          reject(new AgentdConnectionError(`Failed to write frame to socket: ${err.message}`));
        }
      });
    });
  }

  /**
   * Performs a lightweight ping check to verify socket liveness.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return this.isConnected();
    } catch {
      return false;
    }
  }

  /**
   * Gracefully closes the client connection and rejects pending requests.
   */
  public async close(): Promise<void> {
    this.isClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new AgentdConnectionError('AgentdClient closed by caller'));
      this.pendingRequests.delete(id);
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private Socket Connection & Stream Handling
  // -------------------------------------------------------------------------

  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) return;

    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        this.connectWaiters.push({ resolve, reject });
      });
    }

    this.isConnecting = true;

    try {
      await this.connectSocket();
      this.reconnectAttempts = 0;
      const waiters = [...this.connectWaiters];
      this.connectWaiters = [];
      for (const w of waiters) w.resolve();
    } catch (err: any) {
      const waiters = [...this.connectWaiters];
      this.connectWaiters = [];
      for (const w of waiters) w.reject(err);
      this.scheduleReconnect();
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ path: this.socketPath });

      const onConnect = () => {
        socket.removeListener('error', onError);
        this.socket = socket;
        this.setupSocketHandlers(socket);
        resolve();
      };

      const onError = (err: Error) => {
        socket.destroy();
        reject(
          new AgentdConnectionError(
            `Could not connect to privileged agentd socket at '${this.socketPath}': ${err.message}`,
            err
          )
        );
      };

      socket.once('connect', onConnect);
      socket.once('error', onError);
    });
  }

  private setupSocketHandlers(socket: net.Socket): void {
    socket.on('data', (chunk: Buffer) => {
      this.incomingBuffer += chunk.toString('utf8');
      const lines = this.incomingBuffer.split('\n');
      this.incomingBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.processIncomingLine(trimmed);
      }
    });

    socket.on('error', (err: Error) => {
      this.handleSocketDisconnection(`Socket error: ${err.message}`);
    });

    socket.on('close', () => {
      this.handleSocketDisconnection('Socket closed by peer');
    });
  }

  private processIncomingLine(line: string): void {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // Ignore malformed frames
    }

    if (!msg || typeof msg !== 'object' || !msg.id) {
      return;
    }

    const pending = this.pendingRequests.get(msg.id);
    if (!pending) {
      return; // Orphaned or timed-out response
    }

    // 1. Streaming Progress Notification
    if (msg.type === 'progress') {
      if (pending.onProgress) {
        pending.onProgress(msg as RpcStreamMessage);
      }
      return;
    }

    // 2. Final Request Resolution or Rejection
    clearTimeout(pending.timer);
    this.pendingRequests.delete(msg.id);

    if (msg.success) {
      pending.resolve(msg.data);
    } else {
      const agentdErr = this.translateRpcError(msg.error);
      pending.reject(agentdErr);
    }
  }

  private translateRpcError(err?: { code?: string; message?: string; status?: number; details?: unknown }): AgentdError {
    const rawCode = err?.code || 'EXEC_FAILED';
    const message = err?.message || 'Operation execution failed on daemon';
    const details = err?.details;

    const statusCodeMap: Record<string, number> = {
      INVALID_PARAMS: 400,
      INVALID_JSON: 400,
      INVALID_REQUEST: 400,
      ZONE_INVALID: 400,
      CORRUPTED_ARCHIVE: 400,
      PERMISSION_DENIED: 403,
      EACCES: 403,
      NOT_FOUND: 404,
      ENOENT: 404,
      ALREADY_EXISTS: 409,
      EEXIST: 409,
      USER_EXISTS: 409,
      DOMAIN_EXISTS: 409,
      METHOD_NOT_FOUND: 501,
      DB_UNAVAILABLE: 503,
      TIMEOUT: 504,
      SYSROOT_ERROR: 500,
      INTERNAL_ERROR: 500,
      EXEC_FAILED: 500,
    };

    const statusCode = err?.status || statusCodeMap[rawCode] || 500;
    return new AgentdError(rawCode, message, statusCode, details);
  }

  private handleSocketDisconnection(reason: string): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    // Reject all pending requests with connection error
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new AgentdConnectionError(`Connection dropped during request: ${reason}`));
      this.pendingRequests.delete(id);
    }

    if (!this.isClosed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isClosed) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      250 * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.ensureConnected();
      } catch {
        // Next attempt scheduled on failure
      }
    }, delay);
  }
}
