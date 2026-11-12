/**
 * session-revocation.ts
 * Instant token revocation manager for logouts and compromised credentials.
 */

import type { DatabaseConnection } from '../db/sqlite-adapter.ts';

export class SessionRevocationService {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Revokes a token by its unique JWT ID (jti).
   */
  public revokeToken(tokenId: string, userId: string, expiresAtUnix: number): void {
    const expiresAtIso = new Date(expiresAtUnix * 1000).toISOString();
    this.db.prepare(
      `INSERT OR REPLACE INTO sessions_revoked (token_id, user_id, revoked_at, expires_at)
       VALUES (?, ?, datetime('now'), ?)`
    ).run(tokenId, userId, expiresAtIso);
  }

  /**
   * Checks whether a token ID has been revoked.
   */
  public isRevoked(tokenId: string): boolean {
    const row = this.db.prepare<{ token_id: string }>(
      `SELECT token_id FROM sessions_revoked WHERE token_id = ?`
    ).get(tokenId);
    return Boolean(row);
  }

  /**
   * Garbage-collects expired revocation records to keep the table compact.
   * Compares ISO strings directly using parameterized current ISO timestamp,
   * preserving lexical ordering and avoiding ASCII 'T' vs ' ' divergence.
   */
  public purgeExpired(nowDate: Date = new Date()): number {
    const nowIso = nowDate.toISOString();
    const res = this.db.prepare(
      `DELETE FROM sessions_revoked WHERE expires_at < ?`
    ).run(nowIso);
    return res.changes;
  }
}
