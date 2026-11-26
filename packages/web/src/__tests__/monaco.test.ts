import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageFromFilename, jupiterMonacoTheme } from '../utils/monaco.ts';

test('Monaco Editor Language Detection & Jupiter Theme Suite', async (t) => {
  await t.test('detectLanguageFromFilename correctly maps core web file extensions', () => {
    assert.strictEqual(detectLanguageFromFilename('index.php'), 'php');
    assert.strictEqual(detectLanguageFromFilename('template.phtml'), 'php');
    assert.strictEqual(detectLanguageFromFilename('index.html'), 'html');
    assert.strictEqual(detectLanguageFromFilename('app.js'), 'javascript');
    assert.strictEqual(detectLanguageFromFilename('module.mjs'), 'javascript');
    assert.strictEqual(detectLanguageFromFilename('component.tsx'), 'typescript');
    assert.strictEqual(detectLanguageFromFilename('types.ts'), 'typescript');
    assert.strictEqual(detectLanguageFromFilename('styles.css'), 'css');
    assert.strictEqual(detectLanguageFromFilename('theme.scss'), 'scss');
    assert.strictEqual(detectLanguageFromFilename('schema.sql'), 'sql');
    assert.strictEqual(detectLanguageFromFilename('package.json'), 'json');
  });

  await t.test('detectLanguageFromFilename correctly handles special server configurations, dotfiles, and paths', () => {
    // .htaccess* variants
    assert.strictEqual(detectLanguageFromFilename('.htaccess'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.htaccess.backup'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.htaccess.old'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.htaccess_custom'), 'ini');

    // .env* variants
    assert.strictEqual(detectLanguageFromFilename('.env'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.env.local'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.env.production'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('.env.example'), 'ini');

    // Linux shell dotfiles
    assert.strictEqual(detectLanguageFromFilename('.bashrc'), 'shell');
    assert.strictEqual(detectLanguageFromFilename('.zshrc'), 'shell');
    assert.strictEqual(detectLanguageFromFilename('.profile'), 'shell');
    assert.strictEqual(detectLanguageFromFilename('.bash_profile'), 'shell');
    assert.strictEqual(detectLanguageFromFilename('.bash_aliases'), 'shell');

    // Path resolution
    assert.strictEqual(detectLanguageFromFilename('/home/acme/.bashrc'), 'shell');
    assert.strictEqual(detectLanguageFromFilename('public_html/.htaccess'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('/var/www/.env.production'), 'ini');

    // Dockerfile & Makefile
    assert.strictEqual(detectLanguageFromFilename('Dockerfile'), 'dockerfile');
    assert.strictEqual(detectLanguageFromFilename('Makefile'), 'makefile');

    // Shell scripts
    assert.strictEqual(detectLanguageFromFilename('deploy.sh'), 'shell');

    // Other configurations
    assert.strictEqual(detectLanguageFromFilename('app.py'), 'python');
    assert.strictEqual(detectLanguageFromFilename('config.ini'), 'ini');
    assert.strictEqual(detectLanguageFromFilename('config.yaml'), 'yaml');

    // Dotfile fallbacks and unknowns
    assert.strictEqual(detectLanguageFromFilename('.gitignore'), 'plaintext');
    assert.strictEqual(detectLanguageFromFilename('.npmrc'), 'plaintext');
    assert.strictEqual(detectLanguageFromFilename('unknown.xyz123'), 'plaintext');
  });

  await t.test('jupiterMonacoTheme matches dark styling tokens and rule definitions', () => {
    assert.strictEqual(jupiterMonacoTheme.base, 'vs-dark');
    assert.strictEqual(jupiterMonacoTheme.inherit, true);
    assert.ok(Array.isArray(jupiterMonacoTheme.rules));
    assert.ok(jupiterMonacoTheme.rules.length > 5);

    // Verify key colors match Jupiter design tokens
    assert.strictEqual(jupiterMonacoTheme.colors['editor.background'], '#141721');
    assert.strictEqual(jupiterMonacoTheme.colors['editorCursor.foreground'], '#00D2FF');
    assert.strictEqual(jupiterMonacoTheme.colors['editor.selectionBackground'], '#2A364F');
  });
});
