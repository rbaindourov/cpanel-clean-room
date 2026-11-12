/**
 * index.ts
 * Master WebSocket upgrade dispatcher on unified HTTP port (ADR-02 / ADR-03).
 */

import http from 'node:http';
import net from 'node:net';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';
import { JwtService } from '../auth/jwt.ts';
import { handleTerminalConnection, type TerminalAuthContext } from './terminal.ts';
import { handleLogsConnection } from './logs.ts';
import type { UserRole } from '@cpanel-clean-room/shared';
import { RbacPolicyEngine, type UserEntity } from '../auth/rbac.ts';
import { SessionRevocationService } from '../auth/session-revocation.ts';

export interface WsServerOptions {
  jwtSecret?: string;
  sysrootPath?: string;
  db: DatabaseConnection;
}

export class PanelWebSocketManager {
  private wssTerminal: WebSocketServer;
  private wssLogs: WebSocketServer;
  private options: WsServerOptions;
  private jwt: JwtService;
  private rbac: RbacPolicyEngine;
  private revocations: SessionRevocationService;

  constructor(options: WsServerOptions) {
    this.options = options;
    this.jwt = new JwtService(options.jwtSecret);
    this.rbac = new RbacPolicyEngine();
    this.revocations = new SessionRevocationService(options.db);
    this.wssTerminal = new WebSocketServer({ noServer: true });
    this.wssLogs = new WebSocketServer({ noServer: true });

    this.wssTerminal.on('connection', (ws: WebSocket, req: http.IncomingMessage, auth: TerminalAuthContext) => {
      handleTerminalConnection(ws, req, auth, { sysrootPath: this.options.sysrootPath });
    });

    this.wssLogs.on('connection', (ws: WebSocket, req: http.IncomingMessage, auth: TerminalAuthContext, domain: string) => {
      handleLogsConnection(ws, req, auth, domain, { sysrootPath: this.options.sysrootPath });
    });
  }

  /**
   * Main HTTP server 'upgrade' event handler.
   */
  public handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = parsedUrl.pathname;

    // 1. Extract and verify JWT token
    const token = this.extractToken(req, parsedUrl);
    if (!token) {
      this.rejectUpgrade(socket, 401, 'Unauthorized: Missing JWT token');
      return;
    }

    let authContext: TerminalAuthContext;
    try {
      const payload = this.jwt.verifyAccessToken(token);

      // 1. Session Revocation Check (Defect 2)
      if (this.revocations.isRevoked(payload.jti)) {
        this.rejectUpgrade(socket, 401, 'Unauthorized: Token has been revoked');
        return;
      }

      // 2. Query authenticated caller user metadata from DB
      const callerRow = this.options.db.prepare<any>(
        'SELECT id, username, email, role, reseller_id, status, quota_bytes, uid, gid, home_dir FROM users WHERE id = ?'
      ).get(payload.sub);

      if (!callerRow) {
        this.rejectUpgrade(socket, 401, 'Unauthorized: User record does not exist');
        return;
      }

      if (callerRow.status === 'suspended') {
        this.rejectUpgrade(socket, 403, 'Forbidden: User account is suspended');
        return;
      }

      const callerUser: UserEntity = {
        id: callerRow.id,
        username: callerRow.username,
        email: callerRow.email,
        role: callerRow.role as UserRole,
        resellerId: callerRow.reseller_id,
        status: callerRow.status,
        quotaBytes: callerRow.quota_bytes,
        uid: callerRow.uid || 1001,
        gid: callerRow.gid || 1001,
        homeDir: callerRow.home_dir || `/home/${callerRow.username}`,
      };

      // 3. 1-Click User Impersonation Validation via RbacPolicyEngine (Defect 1 / ADR-03)
      const impersonateHeader = req.headers['x-impersonate-user'] as string | undefined;
      let targetUser: UserEntity = callerUser;
      let isImpersonating = false;

      if (impersonateHeader && impersonateHeader !== callerUser.username) {
        if (callerUser.role === 'customer') {
          this.rejectUpgrade(socket, 403, 'Forbidden: Customers are strictly forbidden from impersonating users');
          return;
        }

        const targetRow = this.options.db.prepare<any>(
          'SELECT id, username, email, role, reseller_id, status, quota_bytes, uid, gid, home_dir FROM users WHERE username = ?'
        ).get(impersonateHeader);

        if (!targetRow) {
          this.rejectUpgrade(socket, 403, `Forbidden: Target tenant '${impersonateHeader}' does not exist`);
          return;
        }

        const candidateTarget: UserEntity = {
          id: targetRow.id,
          username: targetRow.username,
          email: targetRow.email,
          role: targetRow.role as UserRole,
          resellerId: targetRow.reseller_id,
          status: targetRow.status,
          quotaBytes: targetRow.quota_bytes,
          uid: targetRow.uid || 1001,
          gid: targetRow.gid || 1001,
          homeDir: targetRow.home_dir || `/home/${targetRow.username}`,
        };

        const check = this.rbac.canImpersonate(callerUser, candidateTarget);
        if (!check.allowed) {
          this.rejectUpgrade(socket, 403, `Forbidden: ${check.reason || 'Unauthorized impersonation request'}`);
          return;
        }

        targetUser = candidateTarget;
        isImpersonating = true;
      }

      authContext = {
        userId: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        uid: targetUser.uid || 1001,
        gid: targetUser.gid || 1001,
        homeDir: targetUser.homeDir || `/home/${targetUser.username}`,
        isImpersonated: isImpersonating,
        operatorUsername: isImpersonating ? callerUser.username : undefined,
      };
    } catch (_err) {
      this.rejectUpgrade(socket, 401, 'Unauthorized: Invalid or expired JWT token');
      return;
    }

    // 2. Route upgrade based on path pattern
    if (pathname === '/ws/terminal') {
      this.wssTerminal.handleUpgrade(req, socket, head, (ws) => {
        this.wssTerminal.emit('connection', ws, req, authContext);
      });
      return;
    }

    const logsMatch = pathname.match(/^\/ws\/logs\/([^/?]+)$/);
    if (logsMatch) {
      const domain = logsMatch[1];

      // Ownership check: Customer must own domain; Admin/Reseller can view all
      if (authContext.role === 'customer') {
        const domainRow = this.options.db.prepare<any>(
          'SELECT id FROM domains WHERE domain_name = ? AND user_id = ?'
        ).get(domain, authContext.userId);

        if (!domainRow) {
          this.rejectUpgrade(socket, 403, `Forbidden: You do not own domain '${domain}'`);
          return;
        }
      }

      this.wssLogs.handleUpgrade(req, socket, head, (ws) => {
        this.wssLogs.emit('connection', ws, req, authContext, domain);
      });
      return;
    }

    // Unmatched path
    this.rejectUpgrade(socket, 404, 'Not Found: Unknown WebSocket endpoint');
  }

  private extractToken(req: http.IncomingMessage, parsedUrl: URL): string | null {
    // Priority 1: Query param ?token=...
    const queryToken = parsedUrl.searchParams.get('token');
    if (queryToken) return queryToken;

    // Priority 2: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Priority 3: Sec-WebSocket-Protocol token
    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (protocolHeader) {
      const protocols = protocolHeader.split(',').map((p) => p.trim());
      const tokenProtocol = protocols.find((p) => p.startsWith('token.'));
      if (tokenProtocol) {
        return tokenProtocol.substring(6);
      }
    }

    return null;
  }

  private rejectUpgrade(socket: net.Socket, statusCode: number, message: string): void {
    const body = JSON.stringify({ error: message });
    const response =
      `HTTP/1.1 ${statusCode} ${http.STATUS_CODES[statusCode] || 'Error'}\r\n` +
      'Content-Type: application/json\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      'Connection: close\r\n\r\n' +
      body;
    socket.write(response);
    socket.destroy();
  }

  public close(): void {
    this.wssTerminal.close();
    this.wssLogs.close();
  }
}
