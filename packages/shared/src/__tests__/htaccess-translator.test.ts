import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { translateHtaccessToNginx } from '../htaccess-translator.ts';

describe('htaccess-translator.ts Rules & Presets', () => {
  test('Translates standard WordPress .htaccess into try_files front controller', () => {
    const wpSample = `
# BEGIN WordPress
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
# END WordPress
    `;
    const result = translateHtaccessToNginx(wpSample);
    assert.equal(result.preset, 'wordpress');
    assert.equal(result.hasFrontController, true);
    assert.ok(result.nginxConfig.includes('try_files $uri $uri/ /index.php?$args;'));
    assert.equal(result.suggestApacheBackend, false);
  });

  test('Translates standard Laravel .htaccess into try_files front controller', () => {
    const laravelSample = `
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
    `;
    const result = translateHtaccessToNginx(laravelSample);
    assert.equal(result.preset, 'laravel');
    assert.equal(result.hasFrontController, true);
    assert.ok(result.nginxConfig.includes('try_files $uri $uri/ /index.php?$query_string;'));
    assert.ok(result.nginxConfig.includes('autoindex off;'));
  });

  test('Strips EasyApache cPanel handler blocks without error', () => {
    const eaSample = `
# php -- BEGIN cPanel-generated handler, do not edit
# Set the “ea-php83” package as the default “PHP” programming language.
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php83 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit

DirectoryIndex index.php index.html
    `;
    const result = translateHtaccessToNginx(eaSample);
    assert.ok(!result.nginxConfig.includes('ea-php83'));
    assert.ok(!result.nginxConfig.includes('AddHandler'));
    assert.ok(result.nginxConfig.includes('index index.php index.html;'));
    assert.ok(result.skippedDirectivesCount > 0);
  });

  test('Translates HTTPS enforcement redirect', () => {
    const httpsSample = `
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
    `;
    const result = translateHtaccessToNginx(httpsSample);
    assert.ok(result.nginxConfig.includes('if ($scheme != "https")'));
    assert.ok(result.nginxConfig.includes('return 301 https://$host$request_uri;'));
  });

  test('Translates 301 and 302 Redirect and RedirectMatch directives', () => {
    const redirectSample = `
Redirect 301 /old-catalog.html /products/
Redirect 302 /promo /special-promo
RedirectMatch 301 ^/article/(\\d+)$ /posts/$1
    `;
    const result = translateHtaccessToNginx(redirectSample);
    assert.ok(result.nginxConfig.includes('location = /old-catalog.html {\n    return 301 /products/;\n}'));
    assert.ok(result.nginxConfig.includes('location = /promo {\n    return 302 /special-promo;\n}'));
    assert.ok(result.nginxConfig.includes('rewrite ^/article/(\\d+)$ /posts/$1 permanent;'));
  });

  test('Translates Directory Privacy HTTP Basic Auth directives', () => {
    const authSample = `
AuthType Basic
AuthName "Vahag Admin Area"
AuthUserFile /home/vahag/.htpasswd
Require valid-user
    `;
    const result = translateHtaccessToNginx(authSample);
    assert.ok(result.nginxConfig.includes('auth_basic "Vahag Admin Area";'));
    assert.ok(result.nginxConfig.includes('auth_basic_user_file /home/vahag/.htpasswd;'));
  });

  test('Translates IP access control: Deny from, Allow from, Require ip', () => {
    const ipSample = `
Order Deny,Allow
Deny from 198.51.100.4
Deny from 203.0.113.0/24
Allow from 192.168.1.50
    `;
    const result = translateHtaccessToNginx(ipSample);
    assert.ok(result.nginxConfig.includes('deny 198.51.100.4;'));
    assert.ok(result.nginxConfig.includes('deny 203.0.113.0/24;'));
    assert.ok(result.nginxConfig.includes('allow 192.168.1.50;'));
  });

  test('Translates Options, ErrorDocument, and Header directives', () => {
    const miscSample = `
Options -Indexes
ErrorDocument 404 /404.html
ErrorDocument 500 /500.html
Header set X-Frame-Options "SAMEORIGIN"
Header always set X-Content-Type-Options "nosniff"
    `;
    const result = translateHtaccessToNginx(miscSample);
    assert.ok(result.nginxConfig.includes('autoindex off;'));
    assert.ok(result.nginxConfig.includes('error_page 404 /404.html;'));
    assert.ok(result.nginxConfig.includes('error_page 500 /500.html;'));
    assert.ok(result.nginxConfig.includes('add_header X-Frame-Options "SAMEORIGIN" always;'));
    assert.ok(result.nginxConfig.includes('add_header X-Content-Type-Options "nosniff" always;'));
  });

  test('Detects unsupported Apache modules and activates suggestApacheBackend flag', () => {
    const complexSample = `
SecFilterEngine On
SecFilterScanPOST On
RewriteMap lowercase int:tolower
php_value memory_limit 1024M
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
    `;
    const result = translateHtaccessToNginx(complexSample);
    assert.equal(result.suggestApacheBackend, true);
    assert.equal(result.unsupportedDirectives.length, 4);
    assert.ok(result.warnings.some((w) => w.includes('Apache2 backend (127.0.0.1:8080)')));
  });
});
