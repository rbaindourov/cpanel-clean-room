import crypto from 'node:crypto';
import path from 'node:path';

/**
 * Deterministic .htaccess to Nginx rule translator
 */
export function translateHtaccess(htaccessContent) {
  const lines = htaccessContent.split(/\r?\n/);
  const nginxRules = [];
  let inRewrite = false;
  let hasWordPressTryFiles = false;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // EasyApache handler lines to remove
    if (line.match(/^AddHandler\s+application\/x-httpd-ea-php/i)) {
      continue;
    }

    if (line.match(/^RewriteEngine\s+On/i)) {
      inRewrite = true;
      continue;
    }

    // WordPress rewrite block detection
    if (line.includes('REQUEST_FILENAME') && (line.includes('!-f') || line.includes('!-d'))) {
      if (!hasWordPressTryFiles) {
        nginxRules.push('try_files $uri $uri/ /index.php?$args;');
        hasWordPressTryFiles = true;
      }
      continue;
    }

    if (line.match(/^RewriteRule\s+\.\s+\/index\.php\s+\[L\]/i)) {
      if (!hasWordPressTryFiles) {
        nginxRules.push('try_files $uri $uri/ /index.php?$args;');
        hasWordPressTryFiles = true;
      }
      continue;
    }

    // General RewriteRule ^pattern$ replacement [flags]
    const rewriteMatch = line.match(/^RewriteRule\s+\^?([^\s]+)\s+([^\s]+)(?:\s+\[(.*)\])?/i);
    if (rewriteMatch) {
      const [, source, target, flags = ''] = rewriteMatch;
      if (source === '.' && target.includes('index.php')) continue;

      let nginxFlag = 'last';
      if (flags.includes('R=301') || flags.includes('permanent')) nginxFlag = 'permanent';
      else if (flags.includes('R=302') || flags.includes('redirect')) nginxFlag = 'redirect';
      else if (flags.includes('L')) nginxFlag = 'last';

      // Clean rewrite target
      let cleanTarget = target.startsWith('/') ? target : `/${target}`;
      nginxRules.push(`rewrite ^/${source.replace(/^\^/, '')} ${cleanTarget} ${nginxFlag};`);
      continue;
    }

    // Auth basic
    if (line.match(/^AuthType\s+Basic/i)) {
      nginxRules.push('auth_basic "Protected Area";');
      continue;
    }
    if (line.match(/^AuthUserFile\s+(.*)/i)) {
      const match = line.match(/^AuthUserFile\s+(.*)/i);
      nginxRules.push(`auth_basic_user_file ${match[1].trim()};`);
      continue;
    }
  }

  return nginxRules.join('\n');
}

/**
 * Generates an Nginx VirtualHost configuration
 */
export function generateNginxVhost(opts) {
  const {
    domain,
    docroot,
    phpVersion = '8.3',
    user = 'acme',
    ssl = null, // { certPath, keyPath, forceHttps }
    aliases = [],
    ipBlocklist = [],
    hotlinkProtection = null, // { allowedDomains, fileExts }
    directoryPrivacy = null, // { realm, authUserFile }
    customErrorPages = {}, // { 404: '/custom_404.html' }
    customRewrites = ''
  } = opts;

  const serverNames = [domain, ...aliases].join(' ');
  const phpSocket = `/run/php/php${phpVersion}-fpm-${user}.sock`;

  let config = '';

  if (ssl && ssl.forceHttps) {
    config += `server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};
    return 301 https://$host$request_uri;
}

`;
  }

  const listenPort = ssl ? '443 ssl http2' : '80';
  config += `server {
    listen ${listenPort};
    server_name ${serverNames};
    root ${docroot};
    index index.php index.html index.htm;

`;

  if (ssl) {
    config += `    ssl_certificate ${ssl.certPath};
    ssl_certificate_key ${ssl.keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

`;
  }

  // IP Blocklist
  if (ipBlocklist && ipBlocklist.length > 0) {
    for (const ip of ipBlocklist) {
      config += `    deny ${ip};\n`;
    }
    config += '\n';
  }

  // Directory Privacy
  if (directoryPrivacy) {
    config += `    auth_basic "${directoryPrivacy.realm || 'Restricted Area'}";
    auth_basic_user_file ${directoryPrivacy.authUserFile};

`;
  }

  // Custom Error Pages
  for (const [code, pagePath] of Object.entries(customErrorPages)) {
    config += `    error_page ${code} ${pagePath};\n`;
  }

  // Hotlink protection
  if (hotlinkProtection && hotlinkProtection.allowedDomains) {
    const exts = hotlinkProtection.fileExts || 'jpg|jpeg|png|gif|webp';
    const referrers = hotlinkProtection.allowedDomains.join(' ');
    config += `    location ~* \\.(${exts})$ {
        valid_referers none blocked server_names ${referrers};
        if ($invalid_referer) {
            return 403;
        }
    }

`;
  }

  // Rewrites / htaccess
  if (customRewrites) {
    const indentedRewrites = customRewrites.split('\n').map(l => `    ${l}`).join('\n');
    config += `${indentedRewrites}\n\n`;
  } else {
    config += `    location / {
        try_files $uri $uri/ /index.php?$args;
    }

`;
  }

  // PHP-FPM execution block
  config += `    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;

  return config;
}

/**
 * Generates PHP-FPM Pool Configuration
 */
export function generatePhpFpmPool(opts) {
  const {
    user = 'acme',
    domain = 'example-store.com',
    phpVersion = '8.3',
    memoryLimit = '512M',
    uploadMaxFilesize = '512M',
    postMaxSize = '520M',
    maxExecutionTime = 90
  } = opts;

  return `[${user}-${domain}]
user = ${user}
group = ${user}
listen = /run/php/php${phpVersion}-fpm-${user}.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = ondemand
pm.max_children = 20
pm.process_idle_timeout = 10s
pm.max_requests = 500

php_admin_value[memory_limit] = ${memoryLimit}
php_admin_value[upload_max_filesize] = ${uploadMaxFilesize}
php_admin_value[post_max_size] = ${postMaxSize}
php_admin_value[max_execution_time] = ${maxExecutionTime}
php_admin_value[open_basedir] = /home/${user}/:/tmp/
`;
}

/**
 * Generates RFC 1035 BIND9 Zone File
 */
export function generateBindZone(opts) {
  const {
    domain,
    serial = parseInt(`${new Date().toISOString().slice(0, 10).replace(/-/g, '')}01`, 10),
    ttl = 86400,
    adminEmail = `hostmaster.${domain}.`,
    nameservers = [`ns1.${domain}.`, `ns2.${domain}.`],
    records = [],
    dkim = null, // { selector, publicKeyBase64 }
    spf = null
  } = opts;

  let out = `$TTL ${ttl}
@       IN      SOA     ${nameservers[0]} ${adminEmail} (
                        ${serial}      ; Serial
                        3600            ; Refresh (1 hour)
                        1800            ; Retry (30 mins)
                        1209600         ; Expire (2 weeks)
                        86400 )         ; Minimum (1 day)

; Name Servers
`;

  for (const ns of nameservers) {
    out += `@       IN      NS      ${ns}\n`;
  }

  out += '\n; Standard Records\n';
  for (const rec of records) {
    out += `${rec.name.padEnd(16)} IN ${rec.type.padEnd(8)} ${rec.data}\n`;
  }

  if (spf) {
    out += `@                IN TXT     "${spf}"\n`;
  }

  if (dkim) {
    const sel = `${dkim.selector}._domainkey`;
    out += `${sel.padEnd(16)} IN TXT     "v=DKIM1; k=rsa; p=${dkim.publicKeyBase64}"\n`;
  }

  return out;
}

/**
 * Generates RSA DKIM keypair using node:crypto
 */
export function generateDkimKeyPair(modulusLength = 2048) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Extract base64 body from public key pem
  const b64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');

  return { publicKey, privateKey, publicKeyBase64: b64 };
}

/**
 * Generates systemd cgroups v2 resource slice
 */
export function generateCgroupsSlice(opts) {
  const {
    sliceName = 'user-1001.slice',
    cpuQuota = '200%',
    memoryMax = '512M',
    tasksMax = '100'
  } = opts;

  return `[Unit]
Description=Tenant Cgroup Slice ${sliceName}
Before=slices.target

[Slice]
CPUQuota=${cpuQuota}
MemoryMax=${memoryMax}
TasksMax=${tasksMax}
`;
}

/**
 * Generates phpMyAdmin SignonSession HMAC token
 */
export function generatePhpMyAdminSSO(opts) {
  const { user, dbUser, secret = 'panel_sso_secret_key', validSeconds = 60 } = opts;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    user,
    dbUser,
    iat: now,
    exp: now + validSeconds
  };
  const payloadStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return {
    payload,
    token: Buffer.from(payloadStr).toString('base64url'),
    signature: hmac,
    redirectUrl: `/phpmyadmin/index.php?sso_token=${Buffer.from(payloadStr).toString('base64url')}&sig=${hmac}`
  };
}

/**
 * Validates phpMyAdmin SignonSession HMAC token
 */
export function verifyPhpMyAdminSSO(tokenStr, signature, secret = 'panel_sso_secret_key') {
  try {
    const jsonStr = Buffer.from(tokenStr, 'base64url').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', secret).update(jsonStr).digest('hex');
    if (signature !== expectedHmac) return { valid: false, error: 'SIGNATURE_MISMATCH' };

    const payload = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return { valid: false, error: 'TOKEN_EXPIRED' };

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'MALFORMED_TOKEN', details: err.message };
  }
}
