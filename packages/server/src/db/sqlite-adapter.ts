/**
 * sqlite-adapter.ts
 * Unified synchronous SQLite database adapter supporting better-sqlite3 and node:sqlite.
 */
import { DatabaseSync } from 'node:sqlite';

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement<T = any, P extends any[] = any[]> {
  run(...params: P): RunResult;
  get(...params: P): T | undefined;
  all(...params: P): T[];
}

export interface DatabaseConnection {
  exec(sql: string): void;
  prepare<T = any, P extends any[] = any[]>(sql: string): Statement<T, P>;
  transaction<T>(fn: () => T): () => T;
  close(): void;
  isMemory(): boolean;
  driverName(): 'better-sqlite3' | 'node:sqlite';
}

export interface DatabaseOptions {
  path?: string;
  memory?: boolean;
  verbose?: boolean;
}

/**
 * Better-Sqlite3 Adapter Wrapper
 */
class BetterSqlite3Adapter implements DatabaseConnection {
  private db: any;
  private memory: boolean;

  constructor(dbInstance: any, memory: boolean) {
    this.db = dbInstance;
    this.memory = memory;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare<T = any, P extends any[] = any[]>(sql: string): Statement<T, P> {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: P) => {
        const res = stmt.run(...params);
        return {
          changes: Number(res.changes ?? 0),
          lastInsertRowid: res.lastInsertRowid ?? 0,
        };
      },
      get: (...params: P) => stmt.get(...params) as T | undefined,
      all: (...params: P) => stmt.all(...params) as T[],
    };
  }

  public transaction<T>(fn: () => T): () => T {
    return this.db.transaction(fn);
  }

  public close(): void {
    this.db.close();
  }

  public isMemory(): boolean {
    return this.memory;
  }

  public driverName(): 'better-sqlite3' {
    return 'better-sqlite3';
  }
}

/**
 * Node:sqlite (DatabaseSync) Adapter Wrapper
 */
class NodeSqliteAdapter implements DatabaseConnection {
  private db: any;
  private memory: boolean;

  constructor(dbInstance: any, memory: boolean) {
    this.db = dbInstance;
    this.memory = memory;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare<T = any, P extends any[] = any[]>(sql: string): Statement<T, P> {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: P) => {
        const res = stmt.run(...params);
        return {
          changes: Number(res?.changes ?? 0),
          lastInsertRowid: res?.lastInsertRowid ?? 0,
        };
      },
      get: (...params: P) => stmt.get(...params) as T | undefined,
      all: (...params: P) => stmt.all(...params) as T[],
    };
  }

  public transaction<T>(fn: () => T): () => T {
    return () => {
      this.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        this.exec('COMMIT');
        return result;
      } catch (err) {
        this.exec('ROLLBACK');
        throw err;
      }
    };
  }

  public close(): void {
    this.db.close();
  }

  public isMemory(): boolean {
    return this.memory;
  }

  public driverName(): 'node:sqlite' {
    return 'node:sqlite';
  }
}

/**
 * Factory function creating a DatabaseConnection with automatic driver detection and fallback.
 */
export async function createDatabaseConnection(
  options: DatabaseOptions = {}
): Promise<DatabaseConnection> {
  const isMemory = Boolean(options.memory || options.path === ':memory:' || !options.path);
  const dbPath = isMemory ? ':memory:' : options.path!;

  // 1. Try better-sqlite3 first (production recommendation)
  try {
    const { default: BetterSqlite3 } = await import('better-sqlite3');
    const db = new BetterSqlite3(dbPath, {
      verbose: options.verbose ? console.log : undefined,
    });

    const conn = new BetterSqlite3Adapter(db, isMemory);
    initPragmas(conn, isMemory);
    return conn;
  } catch (_betterSqliteErr) {
    // 2. Fall back to Node 22+ built-in node:sqlite
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const conn = new NodeSqliteAdapter(db, isMemory);
      initPragmas(conn, isMemory);
      return conn;
    } catch (nodeSqliteErr) {
      throw new Error(
        `Failed to initialize SQLite database driver. Neither 'better-sqlite3' nor 'node:sqlite' could be loaded.\n` +
          `node:sqlite error: ${(nodeSqliteErr as Error).message}`
      );
    }
  }
}

function initPragmas(conn: DatabaseConnection, isMemory: boolean): void {
  conn.exec('PRAGMA foreign_keys = ON;');
  conn.exec('PRAGMA busy_timeout = 5000;');
  conn.exec('PRAGMA temp_store = MEMORY;');

  if (!isMemory) {
    try {
      conn.exec('PRAGMA journal_mode = WAL;');
      conn.exec('PRAGMA synchronous = NORMAL;');
      conn.exec('PRAGMA cache_size = -20000;');
    } catch {
      // Some sandbox filesystems might ignore WAL PRAGMA
    }
  }
}

/**
 * Synchronous SQLiteAdapter class implementing DatabaseConnection.
 */
export class SQLiteAdapter implements DatabaseConnection {
  private conn: DatabaseConnection;
  private closed: boolean = false;

  constructor(path: string = ':memory:', options: DatabaseOptions = {}) {
    const isMemory = Boolean(options.memory || path === ':memory:' || !path);
    const dbPath = isMemory ? ':memory:' : path;
    const db = new DatabaseSync(dbPath);
    this.conn = new NodeSqliteAdapter(db, isMemory);
    initPragmas(this.conn, isMemory);
  }

  public exec(sql: string): void {
    this.conn.exec(sql);
  }

  public prepare<T = any, P extends any[] = any[]>(sql: string): Statement<T, P> {
    return this.conn.prepare<T, P>(sql);
  }

  public transaction<T>(fn: () => T): () => T {
    return this.conn.transaction(fn);
  }

  public close(): void {
    this.conn.close();
    this.closed = true;
  }

  public isMemory(): boolean {
    return this.conn.isMemory();
  }

  public driverName(): 'better-sqlite3' | 'node:sqlite' {
    return this.conn.driverName();
  }

  public isAlive(): boolean {
    return !this.closed;
  }
}

