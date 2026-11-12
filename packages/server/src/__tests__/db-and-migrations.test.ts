import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';

test('Database Subsystem & Migrations Suite', async (t) => {
  await t.test('SQLiteAdapter opens in-memory database and executes queries', () => {
    const db = new SQLiteAdapter(':memory:');
    assert.strictEqual(db.isAlive(), true);

    db.exec(`
      CREATE TABLE test_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        val INTEGER NOT NULL
      );
    `);

    const insert = db.prepare('INSERT INTO test_items (id, name, val) VALUES (?, ?, ?)');
    insert.run('1', 'alpha', 42);
    insert.run('2', 'beta', 100);

    const getStmt = db.prepare('SELECT * FROM test_items WHERE id = ?');
    const row = getStmt.get('1') as { id: string; name: string; val: number } | undefined;
    assert.ok(row);
    assert.strictEqual(row.name, 'alpha');
    assert.strictEqual(row.val, 42);

    const allStmt = db.prepare('SELECT * FROM test_items ORDER BY val ASC');
    const rows = allStmt.all() as Array<{ id: string; name: string; val: number }>;
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].id, '1');
    assert.strictEqual(rows[1].id, '2');

    db.close();
    assert.strictEqual(db.isAlive(), false);
  });

  await t.test('MigrationRunner applies 001_initial_schema.sql and tracks schema version', () => {
    const db = new SQLiteAdapter(':memory:');
    const runner = createStandardMigrationRunner(db);

    const { applied, skipped } = runner.runPendingMigrations();
    assert.strictEqual(applied.length, 2);
    assert.strictEqual(skipped, 0);
    assert.ok(runner.getAppliedVersions().has(1));
    assert.ok(runner.getAppliedVersions().has(2));

    // Verify all 19 expected tables exist
    const expectedTables = [
      'schema_migrations',
      'users',
      'domains',
      'domain_redirects',
      'dns_zones',
      'dns_records',
      'mailboxes',
      'mail_forwarders',
      'email_autoresponders',
      'mysql_databases',
      'mysql_users',
      'mysql_database_grants',
      'remote_mysql_ips',
      'cron_jobs',
      'api_tokens',
      'sessions_revoked',
      'subusers',
      'contact_preferences',
      'audit_logs',
    ];

    for (const table of expectedTables) {
      const row = db.prepare<{ count: number }>(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);
      assert.ok(row);
      assert.strictEqual(row.count, 1, `Expected table ${table} to exist`);
    }

    // Running migrations again should be a no-op (idempotent)
    const secondRun = runner.runPendingMigrations();
    assert.strictEqual(secondRun.applied.length, 0);
    assert.strictEqual(secondRun.skipped, 2);

    db.close();
  });

  await t.test('Foreign key constraints and cascades behave as expected', () => {
    const db = new SQLiteAdapter(':memory:');
    const runner = createStandardMigrationRunner(db);
    runner.runPendingMigrations();

    // Insert a tenant user
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, plan_name, quota_bytes, created_at)
      VALUES ('usr_1', 'tenant1', 'hash', 'customer', 'tenant1@example.com', 'Starter', 1073741824, datetime('now'))
    `).run();

    // Insert a domain
    db.prepare(`
      INSERT INTO domains (id, user_id, domain_name, type, docroot, php_version, created_at)
      VALUES ('dom_1', 'usr_1', 'example.com', 'primary', '/home/tenant1/public_html', '8.2', datetime('now'))
    `).run();

    // Insert a mailbox
    db.prepare(`
      INSERT INTO mailboxes (id, user_id, domain_id, email, local_part, domain_name, password_hash, created_at)
      VALUES ('mbx_1', 'usr_1', 'dom_1', 'admin@example.com', 'admin', 'example.com', 'hash', datetime('now'))
    `).run();

    // Delete the domain, cascading to mailbox
    db.prepare('DELETE FROM domains WHERE id = ?').run('dom_1');

    const mbxCount = db.prepare<{ count: number }>('SELECT count(*) as count FROM mailboxes WHERE id = ?').get('mbx_1');
    assert.strictEqual(mbxCount?.count, 0);

    db.close();
  });
});
