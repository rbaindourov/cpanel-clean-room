/**
 * jwt.ts
 * Self-contained zero-dependency JWT implementation with HS256 signing.
 */

import crypto from 'node:crypto';
import type { UserRole } from '@cpanel-clean-room/shared';

export interface AccessTokenPayload {
  sub: string;            // User UUID
  username: string;       // POSIX username
  email: string;
  role: UserRole;         // 'admin' | 'reseller' | 'customer'
  resellerId?: string;    // If managed by reseller
  jti: string;            // Unique JWT ID for instant revocation
  type: 'access';
  iat: number;            // Issued at (unix seconds)
  exp: number;            // Expires at (unix seconds)
}

export interface RefreshTokenPayload {
  sub: string;            // User UUID
  jti: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export class JwtService {
  private secret: string;

  constructor(secret: string = process.env.PANEL_JWT_SECRET || 'cpanel-clean-room-default-dev-secret-key-64bytes!') {
    this.secret = secret;
  }

  public signAccessToken(user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    resellerId?: string;
  }): { token: string; jti: string; expiresAt: number } {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 15 * 60; // 15 minutes
    const jti = crypto.randomUUID();

    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      jti,
      type: 'access',
      iat: now,
      exp,
    };

    const token = this.sign(payload);
    return { token, jti, expiresAt: exp };
  }

  public signRefreshToken(userId: string): { token: string; jti: string; expiresAt: number } {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 3600; // 7 days
    const jti = crypto.randomUUID();

    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
      type: 'refresh',
      iat: now,
      exp,
    };

    const token = this.sign(payload);
    return { token, jti, expiresAt: exp };
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    const payload = this.verify<AccessTokenPayload>(token);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }
    return payload;
  }

  public verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = this.verify<RefreshTokenPayload>(token);
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }
    return payload;
  }

  public sign(payload: object): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  public verify<T extends { exp: number }>(token: string): T {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT token: must have 3 segments');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid JWT signature');
    }

    const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as T;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error('JWT token has expired');
    }

    return payload;
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str, 'utf8').toString('base64url');
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
}
