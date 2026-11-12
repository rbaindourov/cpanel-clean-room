import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modeToBreakdown,
  breakdownToMode,
  modeToOctalString,
  parseOctalString,
  formatFileSize,
} from '../utils/permissions.ts';

test('File Permissions & Octal Math Suite', async (t) => {
  await t.test('modeToBreakdown correctly decomposes 0644 (rw-r--r--)', () => {
    const bd = modeToBreakdown(0o644);
    assert.deepStrictEqual(bd.user, { r: true, w: true, x: false });
    assert.deepStrictEqual(bd.group, { r: true, w: false, x: false });
    assert.deepStrictEqual(bd.others, { r: true, w: false, x: false });
  });

  await t.test('modeToBreakdown correctly decomposes 0755 (rwxr-xr-x)', () => {
    const bd = modeToBreakdown(0o755);
    assert.deepStrictEqual(bd.user, { r: true, w: true, x: true });
    assert.deepStrictEqual(bd.group, { r: true, w: false, x: true });
    assert.deepStrictEqual(bd.others, { r: true, w: false, x: true });
  });

  await t.test('modeToBreakdown correctly decomposes 0600 (rw-------)', () => {
    const bd = modeToBreakdown(0o600);
    assert.deepStrictEqual(bd.user, { r: true, w: true, x: false });
    assert.deepStrictEqual(bd.group, { r: false, w: false, x: false });
    assert.deepStrictEqual(bd.others, { r: false, w: false, x: false });
  });

  await t.test('breakdownToMode round-trips correctly for standard permission sets', () => {
    const modes = [0o644, 0o755, 0o600, 0o777, 0o700, 0o664, 0o400];
    for (const mode of modes) {
      const bd = modeToBreakdown(mode);
      const computed = breakdownToMode(bd);
      assert.strictEqual(computed, mode, `Failed round-trip for octal mode 0${mode.toString(8)}`);
    }
  });

  await t.test('modeToOctalString formats 3-digit and 4-digit octal representations', () => {
    assert.strictEqual(modeToOctalString(0o644), '0644');
    assert.strictEqual(modeToOctalString(0o755), '0755');
    assert.strictEqual(modeToOctalString(0o600), '0600');
    assert.strictEqual(modeToOctalString(0o700), '0700');
  });

  await t.test('parseOctalString parses octal strings with or without leading zero', () => {
    assert.strictEqual(parseOctalString('0644'), 0o644);
    assert.strictEqual(parseOctalString('644'), 0o644);
    assert.strictEqual(parseOctalString('0755'), 0o755);
    assert.strictEqual(parseOctalString('755'), 0o755);
    assert.strictEqual(parseOctalString('0600'), 0o600);
    assert.strictEqual(parseOctalString('0700'), 0o700);
    assert.strictEqual(parseOctalString('0400'), 0o400);
    assert.strictEqual(parseOctalString('0777'), 0o777);
    assert.strictEqual(parseOctalString('000'), 0);
    assert.strictEqual(parseOctalString('0'), 0);
    assert.strictEqual(parseOctalString('0000'), 0);
    assert.strictEqual(parseOctalString('  0755  '), 0o755, 'Whitespace must be trimmed before parsing');
  });

  await t.test('parseOctalString strictly validates octal strings and falls back to 0o644 on invalid inputs', () => {
    // Non-octal digits (e.g. 8 and 9) must not be partially parsed or truncated
    assert.strictEqual(parseOctalString('758'), 0o644, 'Typo 758 must not truncate to 61 (0o75); must fall back to 0o644');
    assert.strictEqual(parseOctalString('789'), 0o644, '789 contains invalid octal digits 8 and 9');
    assert.strictEqual(parseOctalString('888'), 0o644);
    assert.strictEqual(parseOctalString('999'), 0o644);
    assert.strictEqual(parseOctalString('0758'), 0o644);

    // Empty and whitespace-only strings must safely default to 0o644
    assert.strictEqual(parseOctalString(''), 0o644, 'Empty string must fall back safely to 0o644 instead of 0');
    assert.strictEqual(parseOctalString('   '), 0o644, 'Whitespace string must fall back to 0o644');

    // Negative and signed strings
    assert.strictEqual(parseOctalString('-1'), 0o644, 'Negative string -1 must fall back to 0o644');
    assert.strictEqual(parseOctalString('-755'), 0o644, 'Negative string -755 must fall back to 0o644');
    assert.strictEqual(parseOctalString('+755'), 0o644);

    // Alphabetic and mixed strings
    assert.strictEqual(parseOctalString('invalid'), 0o644);
    assert.strictEqual(parseOctalString('abc'), 0o644);
    assert.strictEqual(parseOctalString('xyz'), 0o644);
    assert.strictEqual(parseOctalString('abc755'), 0o644);
    assert.strictEqual(parseOctalString('755abc'), 0o644);

    // Floats and punctuation
    assert.strictEqual(parseOctalString('644.0'), 0o644);
    assert.strictEqual(parseOctalString('0x755'), 0o644);

    // Special bit permissions
    assert.strictEqual(parseOctalString('4755'), 0o4755);
    assert.strictEqual(parseOctalString('2755'), 0o2755);
    assert.strictEqual(parseOctalString('1777'), 0o1777);

    // Untyped inputs (defensive runtime checks)
    assert.strictEqual(parseOctalString(undefined as any), 0o644);
    assert.strictEqual(parseOctalString(null as any), 0o644);
  });

  await t.test('formatFileSize formats byte amounts into human-readable strings', () => {
    assert.strictEqual(formatFileSize(0), '0 B');
    assert.strictEqual(formatFileSize(512), '512 B');
    assert.strictEqual(formatFileSize(1024), '1.0 KB');
    assert.strictEqual(formatFileSize(1048576), '1.0 MB');
    assert.strictEqual(formatFileSize(1073741824), '1.0 GB');
  });
});
