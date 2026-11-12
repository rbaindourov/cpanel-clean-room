/**
 * migrations.ts
 * Clean transactional migration runner ensuring schema consistency and version tracking.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseConnection } from './sqlite-adapter.ts';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseConnection) => void;
}

export class MigrationRunner {
  private db: DatabaseConnection;
  private migrations: Migration[];

  constructor(db: DatabaseConnection, migrations?: Migration[]) {
    this.db = db;
    this.migrations = migrations ? [...migrations].sort((a, b) => a.version - b.version) : [];
  }

  public registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  public initMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  public getAppliedVersions(): Set<number> {
    this.initMigrationTable();
    const rows = this.db.prepare<{ version: number }>('SELECT version FROM schema_migrations').all();
    return new Set(rows.map((r) => r.version));
  }

  public runPendingMigrations(): { applied: string[]; skipped: number } {
    const appliedVersions = this.getAppliedVersions();
    const appliedNames: string[] = [];
    let skippedCount = 0;

    for (const migration of this.migrations) {
      if (appliedVersions.has(migration.version)) {
        skippedCount++;
        continue;
      }

      // Execute each migration inside an atomic transaction
      const runTx = this.db.transaction(() => {
        migration.up(this.db);
        this.db.prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))"
        ).run(migration.version, migration.name);
      });

      try {
        runTx();
        appliedNames.push(`${migration.version}_${migration.name}`);
      } catch (err) {
        throw new Error(
          `Migration failed at version ${migration.version} (${migration.name}): ${(err as Error).message}`
        );
      }
    }

    return { applied: appliedNames, skipped: skippedCount };
  }
}

/**
 * Loads the initial schema DDL from 001_initial_schema.sql.
 */
export function getInitialSchemaSql(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sqlPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    if (fs.existsSync(sqlPath)) {
      return fs.readFileSync(sqlPath, 'utf8');
    }
  } catch {
    // Fallback if bundled
  }

  // Fallback to relative path lookup
  const altPath = path.resolve('./packages/server/src/db/migrations/001_initial_schema.sql');
  if (fs.existsSync(altPath)) {
    return fs.readFileSync(altPath, 'utf8');
  }

  throw new Error('Could not locate 001_initial_schema.sql on disk');
}

/**
 * Creates a standard MigrationRunner preloaded with core schema migrations.
 */
export function createStandardMigrationRunner(db: DatabaseConnection): MigrationRunner {
  const runner = new MigrationRunner(db);

  runner.registerMigration({
    version: 1,
    name: 'initial_schema',
    up: (database) => {
      const sql = getInitialSchemaSql();
      database.exec(sql);
    },
  });

  runner.registerMigration({
    version: 2,
    name: 'add_last_totp_step',
    up: (database) => {
      const cols = database.prepare<any>("PRAGMA table_info(users)").all();
      const hasCol = cols.some((c: any) => c.name === 'last_totp_step');
      if (!hasCol) {
        database.exec('ALTER TABLE users ADD COLUMN last_totp_step INTEGER NOT NULL DEFAULT 0;');
      }
    },
  });

  return runner;
}
