/**
 * api-tokens.ts
 * Scoped API token generator, validator, and manager.
 */

import crypto from 'node:crypto';
import type { DatabaseConnection } from '../db/sqlite-adapter.ts';

export interface ApiTokenRecord {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Asserts whether a set of token scopes permits a required scope.
 * Supports normalization of delimiters (both ':' and '.' delimiters)
 * so that 'files:*' cleanly matches 'files.write', 'files:write', 'files.delete', etc.
 */
export function hasScope(grantedScopes: string[], requiredScope: string): boolean {
  if (!grantedScopes || !grantedScopes.length) return false;
  if (grantedScopes.includes('*')) return true;

  const normRequired = requiredScope.replace(/\./g, ':');
  const [reqCategory] = normRequired.split(':');

  for (const rawGranted of grantedScopes) {
    const normGranted = rawGranted.replace(/\./g, ':');
    if (normGranted === '*') return true;
    if (normGranted === normRequired) return true;
    if (normGranted === `${reqCategory}:*`) return true;
  }

  return false;
}

export class ApiTokenService {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Creates a new scoped API token.
   * Returns the plaintext bearer token (shown ONCE) and the persisted database record.
   */
  public createToken(
    userId: string,
    name: string,
    scopes: string[] = ['*'],
    expiresInDays?: number
  ): { plaintextToken: string; record: ApiTokenRecord } {
    const id = crypto.randomUUID();
    const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    const secret = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const plaintextToken = `cpr_tok_${prefix}_${secret}`;

    const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');
    const createdAt = new Date().toISOString();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString()
      : null;

    const scopesJson = JSON.stringify(scopes);

    this.db.prepare(
      `INSERT INTO api_tokens (id, user_id, name, token_prefix, token_hash, scopes, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, name, prefix, tokenHash, scopesJson, expiresAt, createdAt);

    const record: ApiTokenRecord = {
      id,
      userId,
      name,
      tokenPrefix: prefix,
      tokenHash,
      scopes,
      expiresAt,
      lastUsedAt: null,
      createdAt,
    };

    return { plaintextToken, record };
  }

  /**
   * Validates a bearer token string.
   * If valid and not expired, updates last_used_at and returns the token record.
   */
  public validateToken(plaintextToken: string): ApiTokenRecord | null {
    if (!plaintextToken || !plaintextToken.startsWith('cpr_tok_')) {
      return null;
    }

    const tokenHash = crypto.createHash('sha256').update(plaintextToken).digest('hex');
    const row = this.db.prepare<any>(
      `SELECT * FROM api_tokens WHERE token_hash = ?`
    ).get(tokenHash);

    if (!row) {
      return null;
    }

    // Check expiration
    if (row.expires_at) {
      const expTime = new Date(row.expires_at).getTime();
      if (Date.now() > expTime) {
        return null;
      }
    }

    // Update last_used_at
    this.db.prepare(
      `UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?`
    ).run(row.id);

    let parsedScopes: string[] = ['*'];
    try {
      parsedScopes = JSON.parse(row.scopes || '["*"]');
    } catch {
      parsedScopes = ['*'];
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenPrefix: row.token_prefix,
      tokenHash: row.token_hash,
      scopes: parsedScopes,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    };
  }


  /**
   * Asserts whether a set of token scopes permits a required scope.
   */
  public hasScope(grantedScopes: string[], requiredScope: string): boolean {
    return hasScope(grantedScopes, requiredScope);
  }

  /**
   * Revokes / deletes an API token.
   */
  public revokeToken(userId: string, tokenId: string): boolean {
    const res = this.db.prepare(
      `DELETE FROM api_tokens WHERE id = ? AND user_id = ?`
    ).run(tokenId, userId);
    return res.changes > 0;
  }

  /**
   * Lists all tokens for a user.
   */
  public listTokens(userId: string): ApiTokenRecord[] {
    const rows = this.db.prepare<any>(
      `SELECT id, user_id, name, token_prefix, token_hash, scopes, expires_at, last_used_at, created_at
       FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId);

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenPrefix: row.token_prefix,
      tokenHash: row.token_hash,
      scopes: JSON.parse(row.scopes || '["*"]'),
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    }));
  }
}
