/**
 * packages/web/src/utils/monaco.ts
 * Extension to Monaco language mapping & Jupiter theme.
 */

export function detectLanguageFromFilename(filename: string): string {
  const base = (filename.split(/[/\\]/).pop() || filename).toLowerCase();

  // Special dotfiles and exact filename matching
  if (base.startsWith('.htaccess')) return 'ini';
  if (base.startsWith('.env')) return 'ini';
  if (
    base === '.bashrc' ||
    base === '.zshrc' ||
    base === '.profile' ||
    base === '.bash_profile' ||
    base === '.bash_login' ||
    base === '.bash_logout' ||
    base === '.bash_aliases' ||
    base === '.zprofile' ||
    base === '.zshenv'
  ) {
    return 'shell';
  }
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'makefile';

  const ext = base.split('.').pop() || '';
  const languageMap: Record<string, string> = {
    php: 'php',
    phtml: 'php',
    html: 'html',
    htm: 'html',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    py: 'python',
    rb: 'ruby',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',
    log: 'plaintext',
    ini: 'ini',
    conf: 'ini',
    env: 'ini',
  };

  return languageMap[ext] || 'plaintext';
}

export const jupiterMonacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', background: '141721', foreground: 'E2E8F0' },
    { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C084FC', fontStyle: 'bold' },
    { token: 'string', foreground: '4ADE80' },
    { token: 'number', foreground: 'FBBF24' },
    { token: 'type', foreground: '38BDF8' },
    { token: 'delimiter', foreground: '94A3B8' },
    { token: 'tag', foreground: 'F87171' },
    { token: 'attribute.name', foreground: '00D2FF' },
  ],
  colors: {
    'editor.background': '#141721',
    'editor.foreground': '#E2E8F0',
    'editor.lineHighlightBackground': '#1B2030',
    'editor.selectionBackground': '#2A364F',
    'editorCursor.foreground': '#00D2FF',
    'editorLineNumber.foreground': '#475569',
    'editorLineNumber.activeForeground': '#00D2FF',
    'editorGutter.background': '#10131C',
    'editorWidget.background': '#1B1E2B',
    'editorWidget.border': '#334155',
  },
};
