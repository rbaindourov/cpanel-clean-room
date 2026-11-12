import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { seedVahagData } from '../seed-vahag.ts';

test('Authentic Vahag Dataset Pre-Seeder Suite', async (t) => {
  const testSysroot = path.resolve('./scratch/test_seed_vahag_sysroot');

  t.after(() => {
    // Keep directory or cleanup non-destructively
  });

  await t.test('seedVahagData populates database and creates authentic filesystem structures', () => {
    const db = new SQLiteAdapter(':memory:');
    createStandardMigrationRunner(db).runPendingMigrations();

    const result = seedVahagData({
      db,
      sysrootPath: testSysroot,
    });

    assert.ok(result.userId);
    assert.strictEqual(result.username, 'vahag');
    assert.ok(result.domainsSeeded.length >= 4);
    assert.ok(result.databasesSeeded.length >= 2);
    assert.ok(result.mailboxesSeeded.length >= 4);
    assert.ok(result.filesCreated.length > 0);

    // Verify user in DB
    const user = db.prepare<any>('SELECT * FROM users WHERE username = ?').get('vahag');
    assert.ok(user);
    assert.strictEqual(user.role, 'customer');
    assert.strictEqual(user.uid, 1001);
    assert.strictEqual(user.gid, 1001);
    assert.strictEqual(user.home_dir, '/home/vahag');

    // Verify domains in DB
    const primaryDom = db.prepare<any>('SELECT * FROM domains WHERE domain_name = ?').get('architecturalnumbers.com');
    assert.ok(primaryDom);
    assert.strictEqual(primaryDom.type, 'primary');
    assert.strictEqual(primaryDom.php_version, '8.2');

    // Verify mailboxes in DB
    const mbx = db.prepare<any>('SELECT * FROM mailboxes WHERE email = ?').get('vahag@architecturalnumbers.com');
    assert.ok(mbx);
    assert.strictEqual(mbx.local_part, 'vahag');

    // Verify MySQL databases in DB
    const wpDb = db.prepare<any>('SELECT * FROM mysql_databases WHERE db_name = ?').get('vahag_architecturalnumbers');
    assert.ok(wpDb);

    // Verify seeded files in sysroot
    const wpConfigPath = path.join(testSysroot, 'home/vahag/public_html/wp-config.php');
    assert.ok(fs.existsSync(wpConfigPath));
    const wpConfigContent = fs.readFileSync(wpConfigPath, 'utf8');
    assert.ok(wpConfigContent.includes('DB_NAME'));
    assert.ok(wpConfigContent.includes('vahag_architecturalnumbers'));

    // Test Idempotence: calling seedVahagData a second time succeeds without errors
    const secondResult = seedVahagData({
      db,
      sysrootPath: testSysroot,
    });
    assert.strictEqual(secondResult.userId, result.userId);

    db.close();
  });
});
