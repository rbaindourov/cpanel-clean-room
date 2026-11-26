import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { seedDemoData } from '../seed-demo.ts';

test('Authentic Acme Hosting Tenant Dataset Pre-Seeder Suite', async (t) => {
  const testSysroot = path.resolve('./scratch/test_seed_demo_sysroot');

  t.after(() => {
    // Keep directory or cleanup non-destructively
  });

  await t.test('seedDemoData populates database and creates authentic filesystem structures', () => {
    const db = new SQLiteAdapter(':memory:');
    createStandardMigrationRunner(db).runPendingMigrations();

    const result = seedDemoData({
      db,
      sysrootPath: testSysroot,
    });

    assert.ok(result.userId);
    assert.strictEqual(result.username, 'acme');
    assert.ok(result.domainsSeeded.length >= 4);
    assert.ok(result.databasesSeeded.length >= 2);
    assert.ok(result.mailboxesSeeded.length >= 4);
    assert.ok(result.filesCreated.length > 0);

    // Verify user in DB
    const user = db.prepare<any>('SELECT * FROM users WHERE username = ?').get('acme');
    assert.ok(user);
    assert.strictEqual(user.role, 'customer');
    assert.strictEqual(user.uid, 1001);
    assert.strictEqual(user.gid, 1001);
    assert.strictEqual(user.home_dir, '/home/acme');

    // Verify domains in DB
    const primaryDom = db.prepare<any>('SELECT * FROM domains WHERE domain_name = ?').get('example-store.com');
    assert.ok(primaryDom);
    assert.strictEqual(primaryDom.type, 'primary');
    assert.strictEqual(primaryDom.php_version, '8.2');

    // Verify mailboxes in DB
    const mbx = db.prepare<any>('SELECT * FROM mailboxes WHERE email = ?').get('acme@example-store.com');
    assert.ok(mbx);
    assert.strictEqual(mbx.local_part, 'acme');

    // Verify MySQL databases in DB
    const wpDb = db.prepare<any>('SELECT * FROM mysql_databases WHERE db_name = ?').get('acme_store');
    assert.ok(wpDb);

    // Verify seeded files in sysroot
    const wpConfigPath = path.join(testSysroot, 'home/acme/public_html/wp-config.php');
    assert.ok(fs.existsSync(wpConfigPath));
    const wpConfigContent = fs.readFileSync(wpConfigPath, 'utf8');
    assert.ok(wpConfigContent.includes('DB_NAME'));
    assert.ok(wpConfigContent.includes('acme_store'));

    // Test Idempotence: calling seedDemoData a second time succeeds without errors
    const secondResult = seedDemoData({
      db,
      sysrootPath: testSysroot,
    });
    assert.strictEqual(secondResult.userId, result.userId);

    db.close();
  });
});
