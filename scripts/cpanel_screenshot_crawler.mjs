#!/usr/bin/env node
/**
 * scripts/cpanel_screenshot_crawler.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Authenticates to HostGator cPanel for example-store.com, injects
 * deterministic privacy/token masking into the DOM, and captures crisp
 * screenshots of all major cPanel categories and sub-screens.
 *
 * Saves images to: docs/screenshots/<category>/<tool>.png
 * Writes index to: docs/screenshots/index.json
 */

import { chromium } from '/home/ella/multipleDomainCMS/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Parse .env
const envPath = path.resolve('/home/robert/projects/cpanel-clean-room/.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found at', envPath);
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
  }
}

const TARGETS = [
  // 00-overview
  { category: '00-overview', name: '01-tools-dashboard', path: 'index.html' },
  { category: '00-overview', name: '02-server-information', path: 'home/serverinfo.html' },

  // 01-email
  { category: '01-email', name: '01-email-accounts', path: 'email_accounts/index.html' },
  { category: '01-email', name: '02-forwarders', path: 'mail/fwds.html' },
  { category: '01-email', name: '03-email-routing', path: 'mail/email_routing.html' },
  { category: '01-email', name: '04-autoresponders', path: 'mail/autores.html' },
  { category: '01-email', name: '05-email-filters', path: 'mail/filters/userfilters.html' },
  { category: '01-email', name: '06-email-deliverability', path: 'email_deliverability/' },
  { category: '01-email', name: '07-spam-filters', path: 'mail/spam/index.html' },

  // 02-files
  { category: '02-files', name: '01-file-manager', path: 'filemanager/index.html' },
  { category: '02-files', name: '02-directory-privacy', path: 'htaccess/index.html' },
  { category: '02-files', name: '03-disk-usage', path: 'diskusage/index.html' },
  { category: '02-files', name: '04-ftp-accounts', path: 'ftp/accounts.html' },
  { category: '02-files', name: '05-backup', path: 'backup/index.html' },
  { category: '02-files', name: '06-backup-wizard', path: 'backup/wizard.html' },
  { category: '02-files', name: '07-git-version-control', path: 'version_control/index.html' },

  // 03-databases
  { category: '03-databases', name: '01-mysql-databases', path: 'sql/index.html' },
  { category: '03-databases', name: '02-mysql-wizard', path: 'sql/wizard1.html' },
  { category: '03-databases', name: '03-remote-mysql', path: 'sql/managehost.html' },

  // 04-domains
  { category: '04-domains', name: '01-domains-manager', path: 'domains/index.html' },
  { category: '04-domains', name: '02-zone-editor', path: 'zone_editor/index.html' },
  { category: '04-domains', name: '03-redirects', path: 'mime/redirect.html' },

  // 05-metrics
  { category: '05-metrics', name: '01-visitors', path: 'stats/lastvisitors_landing.html' },
  { category: '05-metrics', name: '02-errors-log', path: 'stats/errlog.html' },
  { category: '05-metrics', name: '03-bandwidth', path: 'stats/bandwidth.html' },
  { category: '05-metrics', name: '04-awstats', path: 'stats/awstats_landing.html' },

  // 06-security
  { category: '06-security', name: '01-ssl-tls-status', path: 'security/tls_wizard/index.html' },
  { category: '06-security', name: '02-ip-blocker', path: 'denyip/index.html' },
  { category: '06-security', name: '03-ssh-access', path: 'telnet/index.html' },
  { category: '06-security', name: '04-api-tokens', path: 'api_tokens/index.html' },
  { category: '06-security', name: '05-hotlink-protection', path: 'mime/hotlink.html' },

  // 07-software
  { category: '07-software', name: '01-multiphp-manager', path: 'multiphp_manager/index.html' },
  { category: '07-software', name: '02-multiphp-ini-editor', path: 'multiphp_ini_editor/index.html' },
  { category: '07-software', name: '03-optimize-website', path: 'optimize/index.html' },
  { category: '07-software', name: '04-application-manager', path: 'passenger/index.html' },

  // 08-advanced
  { category: '08-advanced', name: '01-cron-jobs', path: 'cron/index.html' },
  { category: '08-advanced', name: '02-track-dns', path: 'net/index.html' },
  { category: '08-advanced', name: '03-indexes', path: 'indexmanager/index.html' },
  { category: '08-advanced', name: '04-error-pages', path: 'err/index.html' },
  { category: '08-advanced', name: '05-mime-types', path: 'mime/mime.html' },

  // 09-preferences
  { category: '09-preferences', name: '01-user-manager', path: 'user_manager/index.html' },
  { category: '09-preferences', name: '02-change-password', path: 'passwd/index.html' },
  { category: '09-preferences', name: '03-contact-information', path: 'contact/index.html' }
];

async function applyMasking(page) {
  await page.evaluate(() => {
    // 1. Text node walker to replace IP addresses, emails, and session strings
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    const ipRegex = /\b198\.57\.\d+\.\d+\b/g;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@hotmail\.com\b/gi;
    const sessRegex = /cpsess\d+/g;
    
    while ((node = walker.nextNode())) {
      if (node.nodeValue) {
        let val = node.nodeValue;
        val = val.replace(ipRegex, '198.57.xxx.xxx');
        val = val.replace(emailRegex, 'client@example.com');
        val = val.replace(sessRegex, 'cpsess[REDACTED]');
        node.nodeValue = val;
      }
    }

    // 2. Redact input values
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      if (input.type === 'password') input.value = '••••••••••••';
      if (input.value && ipRegex.test(input.value)) {
        input.value = input.value.replace(ipRegex, '198.57.xxx.xxx');
      }
      if (input.value && emailRegex.test(input.value)) {
        input.value = input.value.replace(emailRegex, 'client@example.com');
      }
    });

    // 3. Inject Clean-Room Audit Watermark
    if (!document.getElementById('cleanroom-watermark')) {
      const bar = document.createElement('div');
      bar.id = 'cleanroom-watermark';
      bar.style.position = 'fixed';
      bar.style.top = '0';
      bar.style.left = '0';
      bar.style.right = '0';
      bar.style.height = '24px';
      bar.style.backgroundColor = '#1e293b';
      bar.style.color = '#38bdf8';
      bar.style.fontSize = '11px';
      bar.style.fontFamily = 'monospace';
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.justifyContent = 'space-between';
      bar.style.padding = '0 16px';
      bar.style.zIndex = '999999';
      bar.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
      bar.innerHTML = '<span>🔒 <strong>CLEAN-ROOM SYSTEM AUDIT</strong> &bull; HostGator cPanel Jupiter Reference</span><span>CONFIDENTIAL &bull; REDACTED</span>';
      document.body.appendChild(bar);
      document.body.style.paddingTop = '24px';
    }
  });
}

async function runCrawler() {
  console.log('[Crawler] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // 1. Capture Login Screen first
  console.log('[Crawler] Capturing Login Screen...');
  await page.goto(`https://${env.CPANEL_HOST}:${env.CPANEL_PORT}`, { waitUntil: 'networkidle', timeout: 30000 });
  const loginDir = path.resolve('/home/robert/projects/cpanel-clean-room/docs/screenshots/00-overview');
  fs.mkdirSync(loginDir, { recursive: true });
  const loginPath = path.join(loginDir, '00-login-screen.png');
  await page.screenshot({ path: loginPath, fullPage: false });
  console.log(`[Crawler] Saved: ${loginPath}`);

  // 2. Perform Login
  console.log('[Crawler] Authenticating...');
  await page.fill('#user', env.CPANEL_USER);
  await page.fill('#pass', env.CPANEL_PASS);
  await page.click('#login_submit');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

  const currentUrl = page.url();
  const cpsessMatch = currentUrl.match(/cpsess\d+/);
  const cpsess = cpsessMatch ? cpsessMatch[0] : '';
  console.log(`[Crawler] Authenticated. Active session: ${cpsess}`);
  const baseSessionUrl = `https://${env.CPANEL_HOST}:${env.CPANEL_PORT}/${cpsess}/frontend/jupiter`;

  const indexManifest = [];

  // Record login screen in manifest
  const loginBytes = fs.readFileSync(loginPath);
  indexManifest.push({
    category: '00-overview',
    name: '00-login-screen',
    file: '00-overview/00-login-screen.png',
    bytes: loginBytes.length,
    sha256: crypto.createHash('sha256').update(loginBytes).digest('hex')
  });

  // 3. Iterate through all target screens
  for (const t of TARGETS) {
    const targetUrl = `${baseSessionUrl}/${t.path}`;
    const targetDir = path.resolve(`/home/robert/projects/cpanel-clean-room/docs/screenshots/${t.category}`);
    fs.mkdirSync(targetDir, { recursive: true });
    const targetFile = path.join(targetDir, `${t.name}.png`);

    console.log(`[Crawler] [${t.category}] Navigating to ${t.name} (${t.path})...`);
    try {
      const resp = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      // Allow minor stabilization for Vue/Angular/React widgets
      await page.waitForTimeout(1500);

      // Apply privacy and watermark masks
      await applyMasking(page);
      await page.waitForTimeout(300);

      // Capture screenshot
      await page.screenshot({ path: targetFile, fullPage: false });
      const imgBytes = fs.readFileSync(targetFile);

      indexManifest.push({
        category: t.category,
        name: t.name,
        file: `${t.category}/${t.name}.png`,
        bytes: imgBytes.length,
        sha256: crypto.createHash('sha256').update(imgBytes).digest('hex'),
        httpStatus: resp ? resp.status() : 200
      });

      console.log(`[Crawler] Saved: ${targetFile} (${(imgBytes.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.warn(`[Crawler] Warning: Failed to capture ${t.name}:`, err.message);
    }
  }

  // 4. Save screenshots manifest
  const manifestPath = path.resolve('/home/robert/projects/cpanel-clean-room/docs/screenshots/index.json');
  fs.writeFileSync(manifestPath, JSON.stringify(indexManifest, null, 2), 'utf8');
  console.log(`[Crawler] Completed! Captured ${indexManifest.length} screenshots. Manifest written to ${manifestPath}`);

  await browser.close();
}

runCrawler().catch(err => {
  console.error('[Crawler] Fatal error:', err);
  process.exit(1);
});
