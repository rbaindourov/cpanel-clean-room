import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SYSROOT_ROOT, resolveSysroot, writeSysrootFile } from './sysroot-sandbox.mjs';

/**
 * Creates an authentic cpmove fixture directory on disk for user 'acme'
 */
export function createDemoCpmoveTree(destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  // 1. cp/acme metadata
  const cpDir = path.join(destDir, 'cp');
  fs.mkdirSync(cpDir, { recursive: true });
  fs.writeFileSync(path.join(cpDir, 'acme'), [
    'USER=acme',
    'DNS=example-store.com',
    'PLAN=unlimited',
    'OWNER=root',
    'CONTACTEMAIL=acme@example.com',
    'MAXSQL=unlimited',
    'MAXPOP=unlimited',
    'BWLIMIT=unlimited'
  ].join('\n'), 'utf8');

  // 2. userdata/
  const userdataDir = path.join(destDir, 'userdata');
  fs.mkdirSync(userdataDir, { recursive: true });
  fs.writeFileSync(path.join(userdataDir, 'main'), JSON.stringify({
    main_domain: 'example-store.com',
    addon_domains: { 'legacy-crm.org': 'legacy-crm.org' },
    sub_domains: ['store.example-store.com', 'preview.example-store.com']
  }, null, 2), 'utf8');

  fs.writeFileSync(path.join(userdataDir, 'example-store.com'), [
    'documentroot: /home/acme/public_html',
    'has_cgi: 1',
    'homedir: /home/acme',
    'ip: 127.0.0.1',
    'ipv6: none',
    'phpversion: ea-php84',
    'serveradmin: webmaster@example-store.com',
    'servername: example-store.com',
    'usecanonicalname: Off',
    'user: acme'
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(userdataDir, 'legacy-crm.org'), [
    'documentroot: /home/acme/legacy-crm.org',
    'has_cgi: 1',
    'homedir: /home/acme',
    'ip: 127.0.0.1',
    'phpversion: ea-php72',
    'servername: legacy-crm.org',
    'user: acme'
  ].join('\n'), 'utf8');

  // 3. homedir/
  const homedir = path.join(destDir, 'homedir');
  const pubHtml = path.join(homedir, 'public_html');
  const traceDir = path.join(homedir, 'legacy-crm.org');
  fs.mkdirSync(pubHtml, { recursive: true });
  fs.mkdirSync(traceDir, { recursive: true });

  fs.writeFileSync(path.join(pubHtml, 'index.php'), `<?php echo "Welcome to Example Store WordPress"; ?>\n`, 'utf8');
  fs.writeFileSync(path.join(pubHtml, 'wp-config.php'), `<?php\ndefine('DB_NAME', 'acme_store');\ndefine('DB_USER', 'acme_k');\ndefine('DB_PASSWORD', 'testpass123');\n`, 'utf8');
  fs.writeFileSync(path.join(pubHtml, '.htaccess'), [
    '# BEGIN WordPress',
    'RewriteEngine On',
    'RewriteBase /',
    'RewriteRule ^index\\.php$ - [L]',
    'RewriteCond %{REQUEST_FILENAME} !-f',
    'RewriteCond %{REQUEST_FILENAME} !-d',
    'RewriteRule . /index.php [L]',
    '# END WordPress'
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(traceDir, 'index.php'), `<?php echo "Legacy CRM Legacy System"; ?>\n`, 'utf8');
  fs.writeFileSync(path.join(traceDir, '.htaccess'), [
    'RewriteEngine On',
    'RewriteRule ^item/(.*)$ /detail.php?id=$1 [L,QSA]'
  ].join('\n'), 'utf8');

  // Maildir structures
  const mailDir = path.join(homedir, 'mail', 'example-store.com');
  const accounts = ['production', 'sales', 'webmaster', 'amazon'];
  for (const acc of accounts) {
    const accDir = path.join(mailDir, acc);
    fs.mkdirSync(path.join(accDir, 'cur'), { recursive: true });
    fs.mkdirSync(path.join(accDir, 'new'), { recursive: true });
    fs.mkdirSync(path.join(accDir, 'tmp'), { recursive: true });
    // Write sample email file
    fs.writeFileSync(path.join(accDir, 'new', '1700000000.M123P456.server'), `From: test@example.com\nSubject: Welcome to ${acc}\n\nHello ${acc}`, 'utf8');
  }

  // 4. mysql/
  const mysqlDir = path.join(destDir, 'mysql');
  fs.mkdirSync(mysqlDir, { recursive: true });
  fs.writeFileSync(path.join(mysqlDir, 'acme_store.sql'), [
    '-- MySQL dump for acme_store',
    'CREATE TABLE `wp_options` (`option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT, `option_name` varchar(191) NOT NULL, `option_value` longtext NOT NULL, PRIMARY KEY (`option_id`));',
    'INSERT INTO `wp_options` VALUES (1, "siteurl", "https://example-store.com");',
    'INSERT INTO `wp_options` VALUES (2, "blogname", "Example Store");'
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(mysqlDir, 'acme_crm.sql'), [
    '-- MySQL dump for acme_crm',
    'CREATE TABLE `items` (`id` int NOT NULL, `title` varchar(100), PRIMARY KEY (`id`));',
    'INSERT INTO `items` VALUES (1, "Sample Item");'
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(destDir, 'mysql.sql'), [
    'GRANT USAGE ON *.* TO `acme_k`@`localhost` IDENTIFIED BY PASSWORD "*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19";',
    'GRANT ALL PRIVILEGES ON `acme_store`.* TO `acme_k`@`localhost`;',
    'GRANT ALL PRIVILEGES ON `acme_crm`.* TO `acme_k`@`localhost`;'
  ].join('\n'), 'utf8');

  // 5. dnszones/
  const dnsDir = path.join(destDir, 'dnszones');
  fs.mkdirSync(dnsDir, { recursive: true });
  fs.writeFileSync(path.join(dnsDir, 'example-store.com.db'), [
    '; Zone file for example-store.com',
    '$TTL 86400',
    '@ IN SOA ns1.example-store.com. hostmaster.example-store.com. ( 2026111201 3600 1800 1209600 86400 )',
    '@ IN NS ns1.example-store.com.',
    '@ IN NS ns2.example-store.com.',
    '@ IN A 127.0.0.1',
    'www IN CNAME example-store.com.',
    'mail IN A 127.0.0.1',
    '@ IN MX 0 mail.example-store.com.',
    '@ IN TXT "v=spf1 +mx +a ~all"',
    'default._domainkey IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"'
  ].join('\n'), 'utf8');

  // 6. cron/
  const cronDir = path.join(destDir, 'cron');
  fs.mkdirSync(cronDir, { recursive: true });
  fs.writeFileSync(path.join(cronDir, 'acme'), [
    '# cPanel cron for user acme',
    '0 2 * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/acme/public_html/wp-cron.php >/dev/null 2>&1'
  ].join('\n'), 'utf8');

  // 7. valiases/
  const valiasesDir = path.join(destDir, 'valiases');
  fs.mkdirSync(valiasesDir, { recursive: true });
  fs.writeFileSync(path.join(valiasesDir, 'example-store.com'), [
    'info@example-store.com: sales@example-store.com',
    'support@example-store.com: production@example-store.com',
    '*: :fail: No such mailbox here'
  ].join('\n'), 'utf8');

  return destDir;
}

/**
 * Packages a directory into a .tar.gz archive
 */
export function packageTarGz(sourceDir, targetTarGz) {
  fs.mkdirSync(path.dirname(targetTarGz), { recursive: true });
  execFileSync('tar', ['-czf', targetTarGz, '-C', sourceDir, '.']);
  return targetTarGz;
}

/**
 * Extracts a .tar.gz archive into a target directory
 */
export function extractTarGz(tarGzPath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  execFileSync('tar', ['-xzf', tarGzPath, '-C', targetDir]);
  return targetDir;
}

/**
 * Ingests an extracted cpmove directory into sysroot sandbox
 */
export function importCpmoveToSysroot(extractedDir) {
  const result = {
    user: 'acme',
    domains: [],
    databases: [],
    mailboxes: [],
    cronJobs: [],
    configsWritten: []
  };

  // 1. Read metadata
  const cpAcme = path.join(extractedDir, 'cp', 'acme');
  if (fs.existsSync(cpAcme)) {
    result.user = 'acme';
  }

  // 2. Read userdata and generate vhosts & pools
  const udDir = path.join(extractedDir, 'userdata');
  if (fs.existsSync(udDir)) {
    for (const f of fs.readdirSync(udDir)) {
      if (f === 'main') continue;
      const domainName = f;
      result.domains.push(domainName);

      // Write mock vhost into sysroot
      const vhostContent = `# Auto-generated Nginx vhost from cpmove for ${domainName}\nserver { server_name ${domainName}; root /home/acme/${domainName === 'example-store.com' ? 'public_html' : domainName}; }\n`;
      const vhostPath = writeSysrootFile(`etc/nginx/sites-available/${domainName}.conf`, vhostContent);
      result.configsWritten.push(vhostPath);
    }
  }

  // 3. Copy homedir files
  const homedir = path.join(extractedDir, 'homedir');
  if (fs.existsSync(homedir)) {
    const destHome = resolveSysroot('home/acme');
    fs.cpSync(homedir, destHome, { recursive: true });
    result.configsWritten.push(destHome);
  }

  // 4. Ingest databases
  const mysqlDir = path.join(extractedDir, 'mysql');
  if (fs.existsSync(mysqlDir)) {
    for (const f of fs.readdirSync(mysqlDir)) {
      if (f.endsWith('.sql')) {
        result.databases.push(f.replace('.sql', ''));
      }
    }
  }

  // 5. Ingest DNS zones
  const dnsDir = path.join(extractedDir, 'dnszones');
  if (fs.existsSync(dnsDir)) {
    for (const f of fs.readdirSync(dnsDir)) {
      const content = fs.readFileSync(path.join(dnsDir, f), 'utf8');
      const zPath = writeSysrootFile(`etc/bind/zones/${f}`, content);
      result.configsWritten.push(zPath);
    }
  }

  // 6. Ingest crons
  const cronDir = path.join(extractedDir, 'cron');
  if (fs.existsSync(cronDir)) {
    for (const f of fs.readdirSync(cronDir)) {
      const content = fs.readFileSync(path.join(cronDir, f), 'utf8');
      const cPath = writeSysrootFile(`etc/cron.d/tenant-${f}`, content);
      result.cronJobs.push(content);
      result.configsWritten.push(cPath);
    }
  }

  return result;
}
