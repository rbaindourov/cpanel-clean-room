import test from 'node:test';
import assert from 'node:assert/strict';
import { CPANEL_CATEGORIES, ALL_68_TOOLS, EXTENDED_TOOLS, ALL_TOOLS } from '../data/tools.ts';

test('cPanel Tools Catalog & Category Hierarchy Suite', async (t) => {
  await t.test('ALL_68_TOOLS contains exactly 68 core cPanel baseline tools', () => {
    assert.strictEqual(ALL_68_TOOLS.length, 68);
  });

  await t.test('CPANEL_CATEGORIES contains exactly 9 standard cPanel categories', () => {
    assert.strictEqual(CPANEL_CATEGORIES.length, 9);
    const categoryIds = CPANEL_CATEGORIES.map((c) => c.id);
    assert.deepStrictEqual(categoryIds, [
      'files',
      'databases',
      'domains',
      'email',
      'metrics',
      'security',
      'software',
      'advanced',
      'preferences',
    ]);
  });

  await t.test('every tool in ALL_68_TOOLS satisfies complete metadata constraints', () => {
    const codes = new Set<string>();

    for (const tool of ALL_68_TOOLS) {
      assert.ok(tool.code, `Tool missing code: ${JSON.stringify(tool)}`);
      assert.ok(tool.name, `Tool ${tool.code} missing name`);
      assert.ok(tool.description, `Tool ${tool.code} missing description`);
      assert.ok(tool.path, `Tool ${tool.code} missing path`);
      assert.ok(tool.category, `Tool ${tool.code} missing category`);
      assert.ok(Array.isArray(tool.keywords), `Tool ${tool.code} keywords not array`);
      assert.ok(tool.keywords.length > 0, `Tool ${tool.code} has empty keywords`);

      // Ensure unique tool code
      assert.ok(!codes.has(tool.code), `Duplicate tool code detected: ${tool.code}`);
      codes.add(tool.code);
    }
  });

  await t.test('all 9 cPanel categories have associated tools in ALL_68_TOOLS', () => {
    for (const cat of CPANEL_CATEGORIES) {
      const toolsInCat = ALL_68_TOOLS.filter((tool) => tool.category === cat.id);
      assert.ok(
        toolsInCat.length > 0,
        `Category '${cat.id}' has 0 tools in ALL_68_TOOLS`
      );
    }
  });

  await t.test('ALL_TOOLS includes both baseline 68 tools and clean-room extended additions', () => {
    assert.strictEqual(ALL_TOOLS.length, ALL_68_TOOLS.length + EXTENDED_TOOLS.length);
    assert.strictEqual(ALL_TOOLS.length, 77);

    // Verify critical tools are reachable by path
    const fileManager = ALL_TOOLS.find((t) => t.code === 'FIL-01');
    assert.ok(fileManager);
    assert.strictEqual(fileManager.path, '/files');

    const terminal = ALL_TOOLS.find((t) => t.code === 'ADV-01');
    assert.ok(terminal);
    assert.strictEqual(terminal.path, '/terminal');

    const phpMyAdmin = ALL_TOOLS.find((t) => t.code === 'DB-01');
    assert.ok(phpMyAdmin);
    assert.ok(phpMyAdmin.path.startsWith('/databases'));

    const domainsManager = ALL_TOOLS.find((t) => t.code === 'DOM-01');
    assert.ok(domainsManager);
    assert.strictEqual(domainsManager.path, '/domains');

    const zoneEditor = ALL_TOOLS.find((t) => t.code === 'DOM-03');
    assert.ok(zoneEditor);
    assert.ok(zoneEditor.path.startsWith('/domains'));
  });
});
