/**
 * htaccess-translator.ts
 * Deterministic Apache .htaccess to Nginx rule converter.
 */

export interface UnsupportedDirective {
  line: number;
  rawDirective: string;
  reason: string;
}

export interface HtaccessTranslationResult {
  nginxConfig: string;
  hasFrontController: boolean;
  preset: 'wordpress' | 'laravel' | 'custom' | 'none';
  suggestApacheBackend: boolean;
  convertedDirectivesCount: number;
  skippedDirectivesCount: number;
  unsupportedDirectives: UnsupportedDirective[];
  warnings: string[];
}

export interface TranslatorOptions {
  stripEasyApacheHandlers?: boolean;
  defaultIndex?: string[];
  customTryFiles?: string;
}

/**
 * Translates an Apache .htaccess configuration into Nginx server/location directives.
 */
export function translateHtaccessToNginx(
  htaccessContent: string,
  options: TranslatorOptions = {}
): HtaccessTranslationResult {
  const { stripEasyApacheHandlers = true } = options;

  const rawLines = htaccessContent.split(/\r?\n/);
  const locationBlocks: string[] = [];
  const serverLevelDirectives: string[] = [];
  const unsupportedDirectives: UnsupportedDirective[] = [];
  const warnings: string[] = [];

  let convertedCount = 0;
  let skippedCount = 0;

  let hasWpRewrite = false;
  let hasLaravelRewrite = false;
  let rewriteEngineOn = false;
  let rewriteBase = '/';
  let insideEasyApacheBlock = false;
  let ifModuleDepth = 0;

  // Track pending RewriteCond conditions
  const pendingConds: Array<{ variable: string; pattern: string; flags?: string }> = [];

  // Track HTTP Basic Auth directives
  let authType: string | null = null;
  let authName: string | null = null;
  let authUserFile: string | null = null;
  let authRequireValidUser = false;

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNumber = idx + 1;
    const rawLine = rawLines[idx] ?? '';
    const trimmed = rawLine.trim();

    // 1. Skip empty lines
    if (!trimmed) {
      continue;
    }

    // 2. Handle EasyApache cPanel-generated comment blocks
    if (trimmed.includes('# php -- BEGIN cPanel-generated handler') || trimmed.includes('# BEGIN cPanel-generated handler')) {
      insideEasyApacheBlock = true;
      skippedCount++;
      continue;
    }
    if (trimmed.includes('# php -- END cPanel-generated handler') || trimmed.includes('# END cPanel-generated handler')) {
      insideEasyApacheBlock = false;
      skippedCount++;
      continue;
    }
    if (insideEasyApacheBlock && stripEasyApacheHandlers) {
      skippedCount++;
      continue;
    }

    // 3. Skip regular comments
    if (trimmed.startsWith('#')) {
      skippedCount++;
      continue;
    }

    // 4. Handle wrapper tags: <IfModule ...>, </IfModule>
    if (/^<IfModule\s+.*>$/i.test(trimmed)) {
      ifModuleDepth++;
      skippedCount++;
      continue;
    }
    if (/^<\/IfModule>$/i.test(trimmed)) {
      if (ifModuleDepth > 0) {
        ifModuleDepth--;
      }
      skippedCount++;
      continue;
    }

    // 5. EasyApache AddHandler stripping
    if (/^AddHandler\s+application\/x-httpd-ea-php\S*\s+\.php/i.test(trimmed)) {
      if (stripEasyApacheHandlers) {
        skippedCount++;
        continue;
      }
    }

    // 6. RewriteEngine On/Off
    if (/^RewriteEngine\s+On$/i.test(trimmed)) {
      rewriteEngineOn = true;
      convertedCount++;
      continue;
    }
    if (/^RewriteEngine\s+Off$/i.test(trimmed)) {
      rewriteEngineOn = false;
      convertedCount++;
      continue;
    }

    // 7. RewriteBase
    const rewriteBaseMatch = trimmed.match(/^RewriteBase\s+(\S+)$/i);
    if (rewriteBaseMatch && rewriteBaseMatch[1]) {
      rewriteBase = rewriteBaseMatch[1];
      convertedCount++;
      continue;
    }

    // 8. RewriteCond
    const condMatch = trimmed.match(/^RewriteCond\s+(\S+)\s+(\S+)(?:\s+\[(.*)\])?$/i);
    if (condMatch && condMatch[1] && condMatch[2]) {
      pendingConds.push({
        variable: condMatch[1],
        pattern: condMatch[2],
        flags: condMatch[3],
      });
      continue;
    }

    // 9. RewriteRule
    const ruleMatch = trimmed.match(/^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[(.*)\])?$/i);
    if (ruleMatch && ruleMatch[1] && ruleMatch[2]) {
      const pattern = ruleMatch[1];
      const target = ruleMatch[2];
      const flags = ruleMatch[3] ? ruleMatch[3].toUpperCase().split(',') : [];
      const hasNotFile = pendingConds.some(
        (c) => c.variable.includes('REQUEST_FILENAME') && c.pattern === '!-f'
      );
      const hasNotDir = pendingConds.some(
        (c) => c.variable.includes('REQUEST_FILENAME') && c.pattern === '!-d'
      );

      // Check for Authorization header environment variable pass-through (standard WordPress & Laravel):
      // RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
      const hasAuthEnvFlag = flags.some(
        (f) => f.startsWith('E=HTTP_AUTHORIZATION') || f.startsWith('ENV=HTTP_AUTHORIZATION')
      );
      if (hasAuthEnvFlag || (target === '-' && flags.some((f) => f.startsWith('E=') || f.startsWith('ENV=')))) {
        // FastCGI/PHP-FPM passes Authorization header natively in Nginx; mark converted without Apache fallback
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Check for Laravel trailing slash redirect:
      // RewriteCond %{REQUEST_FILENAME} !-d
      // RewriteCond %{REQUEST_URI} (.+)/$
      // RewriteRule ^ %1 [L,R=301]
      const hasTrailingSlashCond = pendingConds.some(
        (c) => c.variable.includes('REQUEST_URI') && c.pattern.includes('/$')
      );
      if (hasNotDir && hasTrailingSlashCond && pattern === '^' && target === '%1' && flags.some((f) => f.includes('R=301') || f.includes('R=PERMANENT'))) {
        serverLevelDirectives.push('rewrite ^/(.*)/$ /$1 permanent;');
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Check for Laravel preset pattern:
      // RewriteCond %{REQUEST_FILENAME} !-d
      // RewriteCond %{REQUEST_FILENAME} !-f
      // RewriteRule ^ index.php [L]
      if (hasNotFile && hasNotDir && pattern === '^' && (target === 'index.php' || target === '/index.php')) {
        hasLaravelRewrite = true;
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Check for WordPress preset pattern:
      // RewriteCond %{REQUEST_FILENAME} !-f
      // RewriteCond %{REQUEST_FILENAME} !-d
      // RewriteRule . /index.php [L]  (or index.php)
      if (
        (hasNotFile && hasNotDir && pattern !== '^' && (target === '/index.php' || target === 'index.php' || target === '/index.php [L]')) ||
        (pattern === '^index\\.php$' && target === '-') ||
        (pattern === '.' && target.includes('index.php'))
      ) {
        hasWpRewrite = true;
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Check for HTTPS enforcement:
      // RewriteCond %{HTTPS} off (or %{HTTPS} !=on)
      // RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
      const isHttpsCheck = pendingConds.some(
        (c) =>
          c.variable.includes('HTTPS') &&
          (c.pattern === 'off' || c.pattern === '!=on' || c.pattern === '!on')
      );
      if (isHttpsCheck && target.startsWith('https://')) {
        serverLevelDirectives.push('if ($scheme != "https") {\n    return 301 https://$host$request_uri;\n}');
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Standard Redirects in RewriteRule: [R=301] or [R=302]
      const is301 = flags.includes('R=301') || flags.includes('R=PERMANENT');
      const is302 = flags.includes('R') || flags.includes('R=302') || flags.includes('R=TEMP');

      if (is301 || is302) {
        const redirectType = is301 ? 'permanent' : 'redirect';
        const normalizedPattern = pattern.startsWith('^') ? pattern : `^${pattern}`;
        serverLevelDirectives.push(`rewrite ${normalizedPattern} ${target} ${redirectType};`);
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // General internal rewrite: [L]
      if (flags.includes('L')) {
        const normalizedPattern = pattern.startsWith('^') ? pattern : `^${pattern}`;
        serverLevelDirectives.push(`rewrite ${normalizedPattern} ${target} last;`);
        pendingConds.length = 0;
        convertedCount++;
        continue;
      }

      // Unhandled complex RewriteRule
      unsupportedDirectives.push({
        line: lineNumber,
        rawDirective: trimmed,
        reason: 'Complex or unmapped RewriteRule flags: ' + (flags.join(',') || 'none'),
      });
      pendingConds.length = 0;
      continue;
    }

    // Clear conds if non-rewrite directive encountered
    pendingConds.length = 0;

    // 10. Directives: Redirect & RedirectMatch
    const redirectMatch = trimmed.match(/^Redirect\s+(301|302|permanent|temp)?\s+(\S+)\s+(\S+)/i);
    if (redirectMatch && redirectMatch[2] && redirectMatch[3]) {
      const code =
        redirectMatch[1]?.toLowerCase() === '302' || redirectMatch[1]?.toLowerCase() === 'temp'
          ? '302'
          : '301';
      const fromPath = redirectMatch[2];
      const targetUrl = redirectMatch[3];
      serverLevelDirectives.push(`location = ${fromPath} {\n    return ${code} ${targetUrl};\n}`);
      convertedCount++;
      continue;
    }

    const redirectMatchRegex = trimmed.match(/^RedirectMatch\s+(301|302|permanent|temp)?\s+(\S+)\s+(\S+)/i);
    if (redirectMatchRegex && redirectMatchRegex[2] && redirectMatchRegex[3]) {
      const isPerm =
        redirectMatchRegex[1]?.toLowerCase() !== '302' &&
        redirectMatchRegex[1]?.toLowerCase() !== 'temp';
      const redirectType = isPerm ? 'permanent' : 'redirect';
      const fromRegex = redirectMatchRegex[2];
      const targetUrl = redirectMatchRegex[3];
      serverLevelDirectives.push(`rewrite ${fromRegex} ${targetUrl} ${redirectType};`);
      convertedCount++;
      continue;
    }

    // 11. DirectoryIndex
    const indexMatch = trimmed.match(/^DirectoryIndex\s+(.+)/i);
    if (indexMatch && indexMatch[1]) {
      serverLevelDirectives.push(`index ${indexMatch[1]};`);
      convertedCount++;
      continue;
    }

    // 12. Options -Indexes / Options +Indexes
    if (/^Options\s+.*-Indexes/i.test(trimmed)) {
      serverLevelDirectives.push('autoindex off;');
      convertedCount++;
      continue;
    }
    if (/^Options\s+.*\+Indexes/i.test(trimmed)) {
      serverLevelDirectives.push('autoindex on;');
      convertedCount++;
      continue;
    }

    // 13. ErrorDocument
    const errorMatch = trimmed.match(/^ErrorDocument\s+(\d{3})\s+(\S+)/i);
    if (errorMatch && errorMatch[1] && errorMatch[2]) {
      serverLevelDirectives.push(`error_page ${errorMatch[1]} ${errorMatch[2]};`);
      convertedCount++;
      continue;
    }

    // 14. Header set / Header always set
    const headerMatch = trimmed.match(/^Header\s+(?:always\s+)?set\s+(\S+)\s+(.+)/i);
    if (headerMatch && headerMatch[1] && headerMatch[2]) {
      serverLevelDirectives.push(`add_header ${headerMatch[1]} ${headerMatch[2]} always;`);
      convertedCount++;
      continue;
    }

    // 15. IP Access Control: Order, Deny from, Allow from, Require ip
    const denyMatch = trimmed.match(/^Deny\s+from\s+(\S+)/i);
    if (denyMatch && denyMatch[1]) {
      serverLevelDirectives.push(`deny ${denyMatch[1]};`);
      convertedCount++;
      continue;
    }
    const allowMatch = trimmed.match(/^Allow\s+from\s+(\S+)/i);
    if (allowMatch && allowMatch[1]) {
      serverLevelDirectives.push(`allow ${allowMatch[1]};`);
      convertedCount++;
      continue;
    }
    const requireIpMatch = trimmed.match(/^Require\s+ip\s+(\S+)/i);
    if (requireIpMatch && requireIpMatch[1]) {
      serverLevelDirectives.push(`allow ${requireIpMatch[1]};`);
      convertedCount++;
      continue;
    }
    const requireNotIpMatch = trimmed.match(/^Require\s+not\s+ip\s+(\S+)/i);
    if (requireNotIpMatch && requireNotIpMatch[1]) {
      serverLevelDirectives.push(`deny ${requireNotIpMatch[1]};`);
      convertedCount++;
      continue;
    }

    // 16. HTTP Basic Auth
    const authTypeMatch = trimmed.match(/^AuthType\s+(\S+)/i);
    if (authTypeMatch && authTypeMatch[1]) {
      authType = authTypeMatch[1];
      convertedCount++;
      continue;
    }
    const authNameMatch = trimmed.match(/^AuthName\s+["']?([^"']+)["']?/i);
    if (authNameMatch && authNameMatch[1]) {
      authName = authNameMatch[1];
      convertedCount++;
      continue;
    }
    const authUserFileMatch = trimmed.match(/^AuthUserFile\s+(\S+)/i);
    if (authUserFileMatch && authUserFileMatch[1]) {
      authUserFile = authUserFileMatch[1];
      convertedCount++;
      continue;
    }
    if (/^Require\s+valid-user/i.test(trimmed)) {
      authRequireValidUser = true;
      convertedCount++;
      continue;
    }

    // 17. Detect Apache-specific unsupported directives requiring fallback
    const isUnsupported =
      /^SecFilter/i.test(trimmed) ||
      /^SecRule/i.test(trimmed) ||
      /^RewriteMap/i.test(trimmed) ||
      /^php_value/i.test(trimmed) ||
      /^php_flag/i.test(trimmed) ||
      /^php_admin_value/i.test(trimmed) ||
      /^SetHandler/i.test(trimmed) ||
      /^Action\s+/i.test(trimmed) ||
      /^XSendFilePath/i.test(trimmed);

    if (isUnsupported) {
      unsupportedDirectives.push({
        line: lineNumber,
        rawDirective: trimmed,
        reason: 'Apache module directive cannot be replicated in Nginx vhost directly.',
      });
      continue;
    }

    // Default: Unrecognized line
    warnings.push(`Line ${lineNumber}: Ignored unrecognized directive "${trimmed}"`);
    skippedCount++;
  }

  // Assemble HTTP Basic Auth block if complete
  if (authType?.toLowerCase() === 'basic' && authUserFile) {
    const realm = authName ?? 'Restricted Area';
    locationBlocks.push(
      `auth_basic "${realm}";\nauth_basic_user_file ${authUserFile};`
    );
    if (!authRequireValidUser) {
      warnings.push('AuthUserFile specified without explicit "Require valid-user"');
    }
  }

  // Check state tracking
  if (!rewriteEngineOn && (hasWpRewrite || hasLaravelRewrite)) {
    warnings.push('Rewrite rules present without explicit RewriteEngine On');
  }
  if (rewriteBase !== '/') {
    warnings.push(`Notice: RewriteBase is set to ${rewriteBase}`);
  }
  if (ifModuleDepth > 0) {
    warnings.push('Unclosed <IfModule> tag detected');
  }

  // Determine preset & front controller
  let preset: 'wordpress' | 'laravel' | 'custom' | 'none' = 'none';
  let hasFrontController = false;

  if (hasWpRewrite) {
    preset = 'wordpress';
    hasFrontController = true;
    locationBlocks.unshift('location / {\n    try_files $uri $uri/ /index.php?$args;\n}');
  } else if (hasLaravelRewrite) {
    preset = 'laravel';
    hasFrontController = true;
    locationBlocks.unshift('location / {\n    try_files $uri $uri/ /index.php?$query_string;\n}');
  } else if (options.customTryFiles) {
    preset = 'custom';
    hasFrontController = true;
    locationBlocks.unshift(`location / {\n    ${options.customTryFiles}\n}`);
  }

  // Determine if Apache backend fallback should be recommended (ADR-04)
  const suggestApacheBackend = unsupportedDirectives.length > 0;
  if (suggestApacheBackend) {
    warnings.push(
      `Detected ${unsupportedDirectives.length} Apache-specific directive(s). Per ADR-04, routing to Apache2 backend (127.0.0.1:8080) is recommended for full fidelity.`
    );
  }

  // Combine generated Nginx directives
  const allDirectives = [...serverLevelDirectives, ...locationBlocks];
  const nginxConfig = allDirectives.join('\n\n');

  return {
    nginxConfig,
    hasFrontController,
    preset,
    suggestApacheBackend,
    convertedDirectivesCount: convertedCount,
    skippedDirectivesCount: skippedCount,
    unsupportedDirectives,
    warnings,
  };
}
