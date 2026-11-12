/**
 * seed-vahag.ts
 * Authentic Vahag Kazanchyan Dataset Pre-Seeder (ADR-11).
 * Seeds SQLite tables and filesystem sysroot structures idempotently.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseConnection } from './db/sqlite-adapter.ts';

export interface SeederOptions {
  db: DatabaseConnection;
  sysrootPath?: string;
}

export interface SeedResult {
  userId: string;
  username: string;
  domainsSeeded: string[];
  databasesSeeded: string[];
  mailboxesSeeded: string[];
  filesCreated: string[];
}

export function seedVahagData(options: SeederOptions): SeedResult {
  const db = options.db;
  const sysrootPath = options.sysrootPath ?? process.env.PANEL_SYSROOT ?? './scratch/sysroot';
  const isSandbox = sysrootPath !== '/' && sysrootPath !== '';
  const resolve = (p: string) => isSandbox ? path.resolve(sysrootPath, p.replace(/^\//, '')) : path.resolve(p);

  const filesCreated: string[] = [];
  const ensureDir = (dirPath: string) => {
    const full = resolve(dirPath);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  };

  const writeFile = (filePath: string, content: string, mode: number = 0o644) => {
    const full = resolve(filePath);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(full, content, { mode });
    filesCreated.push(full);
  };

  // =========================================================================
  // 1. Seed SQLite Database Records (Idempotent)
  // =========================================================================

  // 1.1 Tenant User: vahag
  // Pre-hashed password for demo/test login: 'vahag123!'
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync('vahag123!', Buffer.from(passwordSalt, 'hex'), 64).toString('hex');
  const fullHash = `$scrypt$ln=14,r=8,p=1$${passwordSalt}$${passwordHash}`;
  const dovecotMailboxHash = `{SCRYPT}${fullHash}`;

  const existingUser = db.prepare<any>('SELECT id FROM users WHERE username = ?').get('vahag');
  let userId: string;

  if (!existingUser) {
    userId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, quota_bytes, uid, gid, home_dir, shell, status, created_at)
      VALUES (?, ?, ?, 'customer', 'vahag@architecturalnumbers.com', 21474836480, 1001, 1001, '/home/vahag', '/bin/bash', 'active', datetime('now'))
    `).run(userId, 'vahag', fullHash);
  } else {
    userId = existingUser.id;
  }

  // Also ensure default admin user exists: admin / admin123!
  const existingAdmin = db.prepare<any>('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminHash = crypto.scryptSync('admin123!', Buffer.from(adminSalt, 'hex'), 64).toString('hex');
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, quota_bytes, uid, gid, home_dir, shell, status, created_at)
      VALUES (?, 'admin', ?, 'admin', 'admin@winwinhost.com', 107374182400, 0, 0, '/root', '/bin/bash', 'active', datetime('now'))
    `).run(crypto.randomUUID(), `$scrypt$ln=14,r=8,p=1$${adminSalt}$${adminHash}`);
  }

  // 1.2 Domains & Subdomains
  const domains = [
    { name: 'architecturalnumbers.com', type: 'primary', docroot: '/home/vahag/public_html', php: '8.2', ssl: 1 },
    { name: 'trace4less.com', type: 'addon', docroot: '/home/vahag/trace4less.com', php: '8.2', ssl: 1 },
    { name: 'armenianlistings.com', type: 'addon', docroot: '/home/vahag/armenianlistings.com', php: '7.4', ssl: 1 },
    { name: 'westonletters.com', type: 'addon', docroot: '/home/vahag/westonletters.com', php: '8.1', ssl: 1 },
    { name: 'shop.architecturalnumbers.com', type: 'subdomain', docroot: '/home/vahag/public_html/shop', php: '8.2', ssl: 1 },
  ];

  const domainIds: Record<string, string> = {};
  for (const d of domains) {
    const existing = db.prepare<any>('SELECT id FROM domains WHERE domain_name = ?').get(d.name);
    if (!existing) {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO domains (id, user_id, domain_name, type, docroot, php_version, ssl_enabled, ssl_status, force_https, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, datetime('now'))
      `).run(id, userId, d.name, d.type, d.docroot, d.php, d.ssl);
      domainIds[d.name] = id;
    } else {
      domainIds[d.name] = existing.id;
    }
  }

  // 1.3 DNS Zones & Records
  for (const d of domains) {
    if (d.type === 'subdomain') continue;
    const domId = domainIds[d.name];
    const existingZone = db.prepare<any>('SELECT id FROM dns_zones WHERE domain_name = ?').get(d.name);
    let zoneId: string;
    if (!existingZone) {
      zoneId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO dns_zones (id, domain_id, domain_name, primary_ns, admin_email, serial, created_at)
        VALUES (?, ?, ?, 'ns1.winwinhost.com.', 'hostmaster.winwinhost.com.', 2026111201, datetime('now'))
      `).run(zoneId, domId, d.name);

      // Seed core A, CNAME, MX, TXT records
      db.prepare(`
        INSERT INTO dns_records (id, zone_id, domain_id, name, type, value, ttl, created_at)
        VALUES (?, ?, ?, '@', 'A', '127.0.0.1', 300, datetime('now'))
      `).run(crypto.randomUUID(), zoneId, domId);

      db.prepare(`
        INSERT INTO dns_records (id, zone_id, domain_id, name, type, value, ttl, created_at)
        VALUES (?, ?, ?, 'www', 'CNAME', ?, 300, datetime('now'))
      `).run(crypto.randomUUID(), zoneId, domId, `${d.name}.`);

      db.prepare(`
        INSERT INTO dns_records (id, zone_id, domain_id, name, type, value, ttl, priority, created_at)
        VALUES (?, ?, ?, '@', 'MX', ?, 300, 0, datetime('now'))
      `).run(crypto.randomUUID(), zoneId, domId, `mail.${d.name}.`);

      db.prepare(`
        INSERT INTO dns_records (id, zone_id, domain_id, name, type, value, ttl, created_at)
        VALUES (?, ?, ?, '@', 'TXT', '"v=spf1 +mx +a ~all"', 300, datetime('now'))
      `).run(crypto.randomUUID(), zoneId, domId);
    }
  }

  // 1.4 MySQL Databases & Users
  const databases = [
    { name: 'vahag_architecturalnumbers', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
    { name: 'vahag_trace4less', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' },
  ];
  const dbIds: Record<string, string> = {};
  for (const dbInfo of databases) {
    const exists = db.prepare<any>('SELECT id FROM mysql_databases WHERE db_name = ?').get(dbInfo.name);
    if (!exists) {
      const dbId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO mysql_databases (id, user_id, db_name, charset, collation, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(dbId, userId, dbInfo.name, dbInfo.charset, dbInfo.collation);
      dbIds[dbInfo.name] = dbId;
    } else {
      dbIds[dbInfo.name] = exists.id;
    }
  }

  const dbUsers = [
    { username: 'vahag_wp1', db: 'vahag_architecturalnumbers' },
    { username: 'vahag_store', db: 'vahag_trace4less' },
  ];
  for (const u of dbUsers) {
    let uId: string;
    const exists = db.prepare<any>('SELECT id FROM mysql_users WHERE db_user = ?').get(u.username);
    if (!exists) {
      uId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO mysql_users (id, user_id, db_user, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(uId, userId, u.username);
    } else {
      uId = exists.id;
    }

    // Grant
    const dbId = dbIds[u.db];
    if (dbId) {
      const existsGrant = db.prepare<any>(
        'SELECT id FROM mysql_database_grants WHERE database_id = ? AND database_user_id = ?'
      ).get(dbId, uId);
      if (!existsGrant) {
        db.prepare(`
          INSERT INTO mysql_database_grants (id, database_id, database_user_id, privileges, created_at)
          VALUES (?, ?, ?, 'ALL PRIVILEGES', datetime('now'))
        `).run(crypto.randomUUID(), dbId, uId);
      }
    }
  }

  // 1.5 Mailboxes & Forwarders
  const mailboxes = [
    { email: 'vahag@architecturalnumbers.com', domain: 'architecturalnumbers.com', quota: 5242880000 },
    { email: 'info@architecturalnumbers.com', domain: 'architecturalnumbers.com', quota: 2097152000 },
    { email: 'production@architecturalnumbers.com', domain: 'architecturalnumbers.com', quota: 3145728000 },
    { email: 'sales@trace4less.com', domain: 'trace4less.com', quota: 3145728000 },
  ];
  for (const m of mailboxes) {
    const exists = db.prepare<any>('SELECT id FROM mailboxes WHERE email = ?').get(m.email);
    if (!exists) {
      const [localPart, domainName] = m.email.split('@');
      db.prepare(`
        INSERT INTO mailboxes (id, user_id, domain_id, email, local_part, domain_name, quota_bytes, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(crypto.randomUUID(), userId, domainIds[m.domain], m.email, localPart, domainName, m.quota, dovecotMailboxHash);
    }
  }

  // Forwarder: info@architecturalnumbers.com -> sales@architecturalnumbers.com
  const existingFwd = db.prepare<any>(
    'SELECT id FROM mail_forwarders WHERE source_address = ? AND destination_address = ?'
  ).get('info@architecturalnumbers.com', 'sales@architecturalnumbers.com');
  if (!existingFwd) {
    db.prepare(`
      INSERT INTO mail_forwarders (id, user_id, domain_id, source_address, destination_address, is_catch_all, created_at)
      VALUES (?, ?, ?, 'info@architecturalnumbers.com', 'sales@architecturalnumbers.com', 0, datetime('now'))
    `).run(crypto.randomUUID(), userId, domainIds['architecturalnumbers.com']);
  }

  // 1.6 Cron Jobs
  const cronCommand = '/usr/bin/php8.2 /home/vahag/public_html/wp-cron.php >/dev/null 2>&1';
  const existsCron = db.prepare<any>('SELECT id FROM cron_jobs WHERE command = ?').get(cronCommand);
  if (!existsCron) {
    db.prepare(`
      INSERT INTO cron_jobs (id, user_id, minute, hour, day, month, weekday, command, enabled, description, created_at)
      VALUES (?, ?, '0', '2', '*', '*', '*', ?, 1, 'WordPress Daily Maintenance Cron', datetime('now'))
    `).run(crypto.randomUUID(), userId, cronCommand);
  }

  // =========================================================================
  // 2. Seed Filesystem Sysroot Structures
  // =========================================================================

  // 2.1 Document roots and starter web content
  // Primary: WordPress starter
  writeFile('/home/vahag/public_html/index.php', `<?php
/**
 * Front to the WordPress application.
 */
define('WP_USE_THEMES', true);
echo "Welcome to Architectural Numbers - Premium Cast Metal Letters & Numbers";
?>\n`);

  writeFile('/home/vahag/public_html/.htaccess', `# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress\n`);

  writeFile('/home/vahag/public_html/wp-config.php', `<?php
define('DB_NAME', 'vahag_architecturalnumbers');
define('DB_USER', 'vahag_wp1');
define('DB_PASSWORD', 'WpPass2026!#');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
$table_prefix = 'wp_';
?>\n`);

  // Subdomain storefront
  writeFile('/home/vahag/public_html/shop/index.html', `<!DOCTYPE html>
<html>
<head><title>Architectural Numbers Store</title></head>
<body><h1>Storefront - Architectural Bronze & Aluminum Numbers</h1></body>
</html>\n`);

  // Addon domains
  writeFile('/home/vahag/trace4less.com/index.php', `<?php
echo "Trace4Less Order Tracking & Legacy Portal";
?>\n`);
  writeFile('/home/vahag/trace4less.com/.htaccess', `RewriteEngine On\nRewriteRule ^item/([0-9]+)$ /detail.php?id=$1 [L,QSA]\n`);

  writeFile('/home/vahag/armenianlistings.com/index.php', `<?php
echo "Armenian Listings Business Directory";
?>\n`);

  writeFile('/home/vahag/westonletters.com/index.php', `<?php
echo "Weston Letters Custom Signage";
?>\n`);

  // 2.2 Maildir directories and seed mail files
  for (const m of mailboxes) {
    const [userPart, domainPart] = m.email.split('@');
    const mailBase = `/home/vahag/mail/${domainPart}/${userPart}`;
    ensureDir(`${mailBase}/cur`);
    ensureDir(`${mailBase}/new`);
    ensureDir(`${mailBase}/tmp`);

    writeFile(`${mailBase}/new/1700000000.M1234P5678.server`, `Return-Path: <system@winwinhost.com>
From: WinWinHost Notification <system@winwinhost.com>
To: ${m.email}
Subject: Welcome to your new mailbox
Date: Thu, 12 Nov 2026 12:00:00 +0000

Hello ${userPart},
Your mailbox on ${domainPart} has been successfully provisioned.
Storage Quota: ${Math.round(m.quota / 1024 / 1024)} MB.
`);
  }

  // 2.3 System config files: Nginx Vhosts
  for (const d of domains) {
    if (d.type === 'subdomain') continue;
    const vhostContent = `server {
    listen 80;
    server_name ${d.name} www.${d.name};
    root ${d.docroot};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:/run/php/php${d.php}-fpm-vahag.sock;
    }
}\n`;
    writeFile(`/etc/nginx/sites-available/${d.name}.conf`, vhostContent);
  }

  // 2.4 MultiPHP FPM Pool configurations with authentic limits
  const phpPools = [
    { ver: '7.4', domain: 'armenianlistings.com', mem: '256M', upload: '64M', execTime: 60 },
    { ver: '8.1', domain: 'westonletters.com', mem: '256M', upload: '128M', execTime: 90 },
    { ver: '8.2', domain: 'architecturalnumbers.com', mem: '512M', upload: '512M', execTime: 120 },
  ];

  for (const pool of phpPools) {
    const poolConfig = `[vahag-${pool.domain}]
user = vahag
group = vahag
listen = /run/php/php${pool.ver}-fpm-vahag.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 20
pm.process_idle_timeout = 10s

php_admin_value[memory_limit] = ${pool.mem}
php_admin_value[upload_max_filesize] = ${pool.upload}
php_admin_value[post_max_size] = ${pool.upload}
php_admin_value[max_execution_time] = ${pool.execTime}
php_admin_value[open_basedir] = /home/vahag/:/tmp/
`;
    writeFile(`/etc/php/${pool.ver}/fpm/pool.d/vahag-${pool.domain}.conf`, poolConfig);
  }

  // 2.5 BIND9 DNS Zones
  for (const d of domains) {
    if (d.type === 'subdomain') continue;
    const zoneContent = `; Zone file for ${d.name}
$TTL 86400
@ IN SOA ns1.winwinhost.com. hostmaster.winwinhost.com. ( 2026111201 10800 3600 604800 300 )
@ IN NS ns1.winwinhost.com.
@ IN NS ns2.winwinhost.com.
@ IN A 127.0.0.1
www IN CNAME ${d.name}.
mail IN A 127.0.0.1
@ IN MX 0 mail.${d.name}.
@ IN TXT "v=spf1 +mx +a ~all"
default._domainkey IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"
`;
    writeFile(`/etc/bind/zones/${d.name}.db`, zoneContent);
  }

  // 2.6 Dovecot Passwd & Postfix Virtual
  let passwd = '';
  for (const m of mailboxes) {
    const [userPart, domainPart] = m.email.split('@');
    passwd += `${m.email}:${dovecotMailboxHash}:1001:1001::/home/vahag/mail/${domainPart}/${userPart}::userdb_quota_rule=*:storage=${Math.round(m.quota / 1024 / 1024)}M\n`;
  }
  writeFile('/etc/dovecot/passwd', passwd, 0o600);
  writeFile('/etc/postfix/virtual', 'info@architecturalnumbers.com sales@architecturalnumbers.com\n');

  // 2.7 Tenant Cron
  writeFile('/etc/cron.d/tenant-vahag', `0 2 * * * vahag ${cronCommand}\n`);

  // 2.8 Database seed dumps
  writeFile('/var/lib/mysql/vahag_architecturalnumbers.sql', `CREATE DATABASE IF NOT EXISTS \`vahag_architecturalnumbers\`;
USE \`vahag_architecturalnumbers\`;
CREATE TABLE \`wp_options\` (\`option_id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT, \`option_name\` varchar(191) NOT NULL, \`option_value\` longtext NOT NULL, PRIMARY KEY (\`option_id\`));
INSERT INTO \`wp_options\` VALUES (1, 'siteurl', 'https://architecturalnumbers.com'), (2, 'blogname', 'Architectural Numbers');
`);

  writeFile('/var/lib/mysql/vahag_trace4less.sql', `CREATE DATABASE IF NOT EXISTS \`vahag_trace4less\`;
USE \`vahag_trace4less\`;
CREATE TABLE \`items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`title\` varchar(100), PRIMARY KEY (\`id\`));
INSERT INTO \`items\` VALUES (1, 'Sample Legacy Catalog Item');
`);

  // 2.9 User cPanel NVData Preferences
  writeFile(
    '/home/vahag/.cpanel/nvdata.json',
    JSON.stringify(
      {
        theme: 'jupiter',
        filemanager_showhidden: 1,
        email_default_domain: 'architecturalnumbers.com',
        notify_email: 'vahag@architecturalnumbers.com',
        notify_disk_limit: 80,
        notify_bandwidth_limit: 80,
      },
      null,
      2
    ) + '\n',
    0o600
  );

  return {
    userId,
    username: 'vahag',
    domainsSeeded: domains.map((d) => d.name),
    databasesSeeded: databases.map((d) => d.name),
    mailboxesSeeded: mailboxes.map((m) => m.email),
    filesCreated,
  };
}
