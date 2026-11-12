import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';
import type { AgentServer } from '../index.ts';
import {
  WebUpsertVhostParamsSchema,
  WebDeleteVhostParamsSchema,
  WebSetPhpVersionParamsSchema,
  WebUpdatePhpIniParamsSchema,
  WebIssueSslParamsSchema,
  type WebUpsertVhostParams,
  type WebUpsertVhostResult,
  type WebDeleteVhostParams,
  type WebDeleteVhostResult,
  type WebSetPhpVersionParams,
  type WebSetPhpVersionResult,
  type WebUpdatePhpIniParams,
  type WebUpdatePhpIniResult,
  type WebIssueSslParams,
  type WebIssueSslResult,
} from '@cpanel-clean-room/shared';

export class WebPhpHandler {
  sysroot: SysrootEngine;

  constructor(sysroot: SysrootEngine) {
    this.sysroot = sysroot;
  }

  public async upsertVhost(params: WebUpsertVhostParams): Promise<WebUpsertVhostResult> {
    const {
      username,
      domain,
      aliases = [],
      documentRoot,
      phpVersion,
      useApacheBackend = false,
      forceHttps = true,
      ssl,
      nginxDirectives = [],
    } = params;

    const cleanVer = phpVersion.replace('.', '');
    const socketPath = `/run/php/php${cleanVer}-fpm-${domain}.sock`;

    // 1. Generate PHP-FPM Pool Configuration
    const poolConfig = `[${username}-${domain}]
user = ${username}
group = ${username}
listen = ${socketPath}
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 20
pm.process_idle_timeout = 10s
php_admin_value[open_basedir] = /home/${username}/:/tmp/
`;
    const poolPath = `/etc/php/${phpVersion}/fpm/pool.d/${username}-${domain}.conf`;
    this.sysroot.atomicWriteFile(poolPath, poolConfig, { mode: 0o644 });

    // 2. Generate Nginx Virtual Host Configuration
    const serverNames = [domain, ...aliases].join(' ');
    const sslEnabled = ssl?.enabled ?? false;
    const certPath = ssl?.certPath || `/etc/ssl/certs/${domain}.crt`;
    const keyPath = ssl?.keyPath || `/etc/ssl/private/${domain}.key`;

    let vhostContent = '';

    if (sslEnabled && forceHttps) {
      vhostContent += `server {
    listen 80;
    server_name ${serverNames};
    location /.well-known/acme-challenge/ {
        root ${documentRoot};
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

`;
    }

    const listenDirective = sslEnabled ? 'listen 443 ssl http2;' : 'listen 80;';

    vhostContent += `server {
    ${listenDirective}
    server_name ${serverNames};
    root ${documentRoot};
    index index.php index.html index.htm;
`;

    if (sslEnabled) {
      vhostContent += `
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
`;
    }

    // Hidden files & ACME protection
    vhostContent += `
    location ~ /\\.(?!well-known/) {
        deny all;
        return 404;
    }
`;

    if (useApacheBackend) {
      // Reverse proxy to Apache2 backend (ADR-04)
      vhostContent += `
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
`;
    } else {
      // Pure Nginx + PHP-FPM
      vhostContent += `
    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass unix:${socketPath};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
`;
    }

    if (nginxDirectives.length > 0) {
      vhostContent += `\n    # Custom Directives\n    ${nginxDirectives.join('\n    ')}\n`;
    }

    vhostContent += `}\n`;

    const vhostPath = `/etc/nginx/sites-available/${domain}.conf`;
    const enabledPath = `/etc/nginx/sites-enabled/${domain}.conf`;

    this.sysroot.atomicWriteFile(vhostPath, vhostContent, { mode: 0o644 });

    // 3. Create symlink in sites-enabled
    const resolvedAvailable = this.sysroot.resolve(vhostPath);
    const resolvedEnabled = this.sysroot.resolve(enabledPath);
    this.sysroot.ensureDir(path.dirname(resolvedEnabled));

    if (fs.existsSync(resolvedEnabled)) {
      try {
        fs.unlinkSync(resolvedEnabled);
      } catch {
        // Ignored
      }
    }
    try {
      fs.symlinkSync(resolvedAvailable, resolvedEnabled);
    } catch {
      // Fallback copy if symlink fails in restricted sandbox
      fs.copyFileSync(resolvedAvailable, resolvedEnabled);
    }

    // 4. Validate syntax and reload
    const testResult = await this.sysroot.execCommand('nginx', ['-t']);
    if (testResult.code !== 0) {
      const err: any = new Error(`Nginx syntax check failed: ${testResult.stderr}`);
      err.code = 'EXEC_FAILED';
      throw err;
    }

    await this.sysroot.execCommand('systemctl', ['reload', 'nginx']);
    await this.sysroot.execCommand('systemctl', ['reload', `php${phpVersion}-fpm`]);

    return {
      vhostPath,
      enabledPath,
      reloaded: true,
    };
  }

  public async deleteVhost(params: WebDeleteVhostParams): Promise<WebDeleteVhostResult> {
    const { username, domain, phpVersion } = params;

    const vhostPath = `/etc/nginx/sites-available/${domain}.conf`;
    const enabledPath = `/etc/nginx/sites-enabled/${domain}.conf`;
    const poolPath = `/etc/php/${phpVersion}/fpm/pool.d/${username}-${domain}.conf`;

    this.sysroot.removeFile(enabledPath);
    this.sysroot.removeFile(vhostPath);
    this.sysroot.removeFile(poolPath);

    await this.sysroot.execCommand('systemctl', ['reload', 'nginx']);
    await this.sysroot.execCommand('systemctl', ['reload', `php${phpVersion}-fpm`]);

    return {
      deleted: true,
      reloaded: true,
    };
  }

  public async setPhpVersion(params: WebSetPhpVersionParams): Promise<WebSetPhpVersionResult> {
    const { username, domain, fromVersion, toVersion } = params;

    const oldPoolPath = `/etc/php/${fromVersion}/fpm/pool.d/${username}-${domain}.conf`;
    const newPoolPath = `/etc/php/${toVersion}/fpm/pool.d/${username}-${domain}.conf`;

    const cleanTo = toVersion.replace('.', '');
    const newSocket = `/run/php/php${cleanTo}-fpm-${domain}.sock`;

    let poolContent = '';
    if (this.sysroot.exists(oldPoolPath)) {
      poolContent = this.sysroot.readFile(oldPoolPath);
      this.sysroot.removeFile(oldPoolPath);
    } else {
      poolContent = `[${username}-${domain}]\nuser = ${username}\ngroup = ${username}\npm = ondemand\npm.max_children = 20\n`;
    }

    poolContent = poolContent.replace(/listen\s*=.*(\r?\n|$)/, `listen = ${newSocket}\n`);
    this.sysroot.atomicWriteFile(newPoolPath, poolContent, { mode: 0o644 });

    // Update Nginx socket
    const vhostPath = `/etc/nginx/sites-available/${domain}.conf`;
    if (this.sysroot.exists(vhostPath)) {
      let vhostContent = this.sysroot.readFile(vhostPath);
      vhostContent = vhostContent.replace(/fastcgi_pass unix:[^;]+;/, `fastcgi_pass unix:${newSocket};`);
      this.sysroot.atomicWriteFile(vhostPath, vhostContent, { mode: 0o644 });
    }

    await this.sysroot.execCommand('nginx', ['-t']);
    await this.sysroot.execCommand('systemctl', ['reload', 'nginx']);
    await this.sysroot.execCommand('systemctl', ['reload', `php${fromVersion}-fpm`]);
    await this.sysroot.execCommand('systemctl', ['reload', `php${toVersion}-fpm`]);

    return {
      newSocket,
      reloaded: true,
    };
  }

  public async updatePhpIni(params: WebUpdatePhpIniParams): Promise<WebUpdatePhpIniResult> {
    const { username, domain, phpVersion, directives } = params;

    const poolPath = `/etc/php/${phpVersion}/fpm/pool.d/${username}-${domain}.conf`;
    let poolContent = '';
    if (this.sysroot.exists(poolPath)) {
      poolContent = this.sysroot.readFile(poolPath);
    } else {
      poolContent = `[${username}-${domain}]\nuser = ${username}\ngroup = ${username}\n`;
    }

    for (const [key, val] of Object.entries(directives)) {
      const regex = new RegExp(`php_admin_value\\[${key}\\]\\s*=.*(\\r?\\n|$)`);
      const directiveLine = `php_admin_value[${key}] = ${val}\n`;
      if (regex.test(poolContent)) {
        poolContent = poolContent.replace(regex, directiveLine);
      } else {
        poolContent += directiveLine;
      }
    }

    this.sysroot.atomicWriteFile(poolPath, poolContent, { mode: 0o644 });
    await this.sysroot.execCommand('systemctl', ['reload', `php${phpVersion}-fpm`]);

    return {
      updated: true,
      poolPath,
      reloaded: true,
    };
  }

  public async issueSsl(params: WebIssueSslParams): Promise<WebIssueSslResult> {
    const { domain, sanDomains = [] } = params;

    const certPath = `/etc/ssl/certs/${domain}.crt`;
    const keyPath = `/etc/ssl/private/${domain}.key`;

    if (!this.sysroot.isSandbox()) {
      const domainsList = [domain, ...sanDomains];
      const certbotArgs = [
        'certonly',
        '--webroot',
        '-w',
        `/home/${domain}/public_html`,
        '--non-interactive',
        '--agree-tos',
        '-m',
        params.email,
        ...domainsList.flatMap((d) => ['-d', d]),
      ];
      await this.sysroot.execCommand('certbot', certbotArgs);
    } else {
      // Mock certificate and key generation in sandbox
      const mockKey = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n`;
      const mockCert = `-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIU...\n-----END CERTIFICATE-----\n`;

      this.sysroot.atomicWriteFile(keyPath, mockKey, { mode: 0o600 });
      this.sysroot.atomicWriteFile(certPath, mockCert, { mode: 0o644 });
    }

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    return {
      certPath,
      keyPath,
      expiresAt,
      sanDomains: [domain, ...sanDomains],
    };
  }
}

export function registerWebPhpHandlers(server: AgentServer): void {
  const handler = new WebPhpHandler(server.getSysroot());

  server.registerHandler('web.upsertVhost', (p) => handler.upsertVhost(p), WebUpsertVhostParamsSchema);
  server.registerHandler('web.deleteVhost', (p) => handler.deleteVhost(p), WebDeleteVhostParamsSchema);
  server.registerHandler('web.setPhpVersion', (p) => handler.setPhpVersion(p), WebSetPhpVersionParamsSchema);
  server.registerHandler('web.updatePhpIni', (p) => handler.updatePhpIni(p), WebUpdatePhpIniParamsSchema);
  server.registerHandler('web.issueSsl', (p) => handler.issueSsl(p), WebIssueSslParamsSchema);
}
