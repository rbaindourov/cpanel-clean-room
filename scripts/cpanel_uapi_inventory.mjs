#!/usr/bin/env node
/**
 * scripts/cpanel_uapi_inventory.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Authenticates to HostGator cPanel for example-store.com and extracts
 * an exhaustive inventory of all installed UI modules, categories, features,
 * server environment specs, and data models via cPanel UAPI and DynamicUI.
 *
 * Output: docs/data/cpanel_feature_manifest.json
 */

import { chromium } from '/home/ella/multipleDomainCMS/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

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

async function runInventory() {
  console.log(`[Inventory] Launching browser to authenticate on https://${env.CPANEL_HOST}:${env.CPANEL_PORT}...`);
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
  await page.goto(`https://${env.CPANEL_HOST}:${env.CPANEL_PORT}`, { waitUntil: 'networkidle', timeout: 30000 });

  await page.fill('#user', env.CPANEL_USER);
  await page.fill('#pass', env.CPANEL_PASS);
  await page.click('#login_submit');
  await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

  const currentUrl = page.url();
  console.log(`[Inventory] Logged in successfully. Current URL: ${currentUrl}`);

  // Extract session token from URL (cpsess##########)
  const cpsessMatch = currentUrl.match(/cpsess\d+/);
  const cpsess = cpsessMatch ? cpsessMatch[0] : '';
  const baseUrl = `https://${env.CPANEL_HOST}:${env.CPANEL_PORT}/${cpsess}`;
  console.log(`[Inventory] Session Prefix: ${cpsess}`);

  const manifest = {
    target: {
      domain: env.CPANEL_HOST,
      port: parseInt(env.CPANEL_PORT, 10),
      cpanelUser: env.CPANEL_USER,
      inspectedAt: new Date().toISOString()
    },
    serverInfo: {},
    dynamicUI: {},
    featuresList: {},
    phpEnvironment: {},
    databaseStats: {},
    emailStats: {},
    sslStatus: {},
    cronJobs: {},
    categories: []
  };

  // Helper to query in-page JSON endpoints using the active authenticated page context
  async function queryUapi(module, func, params = {}) {
    const queryStr = new URLSearchParams(params).toString();
    const endpoint = `${baseUrl}/execute/${module}/${func}${queryStr ? '?' + queryStr : ''}`;
    try {
      const res = await page.evaluate(async (url) => {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
          });
          if (!resp.ok) return { error: `HTTP ${resp.status} ${resp.statusText}` };
          return await resp.json();
        } catch (e) {
          return { error: e.message };
        }
      }, endpoint);
      return res;
    } catch (err) {
      return { error: err.message };
    }
  }

  // 1. Query Server Information
  console.log('[Inventory] Fetching Server Information variables...');
  manifest.serverInfo = await queryUapi('Variables', 'get_server_information');

  // 2. Query DynamicUI retrieve (Jupiter theme groups, features, icons)
  console.log('[Inventory] Fetching DynamicUI / Tools menu hierarchy...');
  manifest.dynamicUI = await queryUapi('DynamicUI', 'retrieve');

  // 3. Query Features list
  console.log('[Inventory] Fetching Features list...');
  manifest.featuresList = await queryUapi('Features', 'list_features');

  // 4. Query Multi-PHP installed & vhost versions
  console.log('[Inventory] Fetching Multi-PHP versions...');
  const phpInstalled = await queryUapi('LangPHP', 'php_get_installed_versions');
  const phpVhosts = await queryUapi('LangPHP', 'php_get_vhost_versions');
  manifest.phpEnvironment = {
    installed: phpInstalled?.data || phpInstalled,
    vhosts: phpVhosts?.data || phpVhosts
  };

  // 5. Query MySQL info
  console.log('[Inventory] Fetching MySQL databases metadata...');
  const mysqlDbs = await queryUapi('Mysql', 'list_databases');
  manifest.databaseStats = {
    databases: mysqlDbs?.data || mysqlDbs
  };

  // 6. Query Email accounts
  console.log('[Inventory] Fetching Email accounts overview...');
  const emailPops = await queryUapi('Email', 'list_pops_with_disk');
  manifest.emailStats = {
    accounts: emailPops?.data || emailPops
  };

  // 7. Query SSL status
  console.log('[Inventory] Fetching SSL hosts...');
  const sslHosts = await queryUapi('SSL', 'installed_hosts');
  manifest.sslStatus = {
    hosts: sslHosts?.data || sslHosts
  };

  // 8. Query Cron
  console.log('[Inventory] Fetching Cron jobs...');
  const cronJobs = await queryUapi('Cron', 'list_cron');
  manifest.cronJobs = {
    jobs: cronJobs?.data || cronJobs
  };

  // 9. Scrape DOM rendered category blocks from Jupiter Tools home page
  console.log('[Inventory] Scraping rendered DOM sections and items from Jupiter Tools dashboard...');
  const domSections = await page.evaluate(() => {
    const sections = [];
    // Jupiter theme groups tools into sections with headings or group cards
    const sectionEls = document.querySelectorAll('section, div.item-group, .cpanel-group, [id^="group-"], [data-group]');
    
    // Also query all individual tool links / anchor cards
    const allLinks = Array.from(document.querySelectorAll('a[id^="item_"], a.item, a[data-item]')).map(a => {
      const titleEl = a.querySelector('.item-title, .cell-title, span') || a;
      const descEl = a.querySelector('.item-desc, .cell-desc, p');
      const iconEl = a.querySelector('img, i, svg, [class*="icon"]');
      return {
        id: a.id || a.getAttribute('data-item') || '',
        title: titleEl ? titleEl.textContent.trim() : a.textContent.trim(),
        description: descEl ? descEl.textContent.trim() : '',
        href: a.getAttribute('href') || '',
        icon: iconEl ? (iconEl.getAttribute('src') || iconEl.className || '') : '',
        group: a.closest('[id^="group-"], section, .item-group')?.id || ''
      };
    });

    return {
      allLinksCount: allLinks.length,
      links: allLinks
    };
  });

  manifest.domItems = domSections;

  // Redact any occurrences of passwords, raw tokens, or sensitive client email addresses
  const rawJson = JSON.stringify(manifest, null, 2);
  const sanitizedJson = rawJson
    .replace(new RegExp(env.CPANEL_PASS, 'g'), '[REDACTED_PASSWORD]')
    .replace(/cpsess\d+/g, 'cpsess[REDACTED]')
    .replace(/acme_k@hotmail\.com/gi, 'client@example.com')
    .replace(/198\.57\.247\.238/g, '198.57.xxx.xxx');

  const outPath = path.resolve('/home/robert/projects/cpanel-clean-room/docs/data/cpanel_feature_manifest.json');
  fs.writeFileSync(outPath, sanitizedJson, 'utf8');
  console.log(`[Inventory] Successfully wrote sanitized manifest to ${outPath} (${(Buffer.byteLength(sanitizedJson)/1024).toFixed(1)} KB)`);

  await browser.close();
}

runInventory().catch(err => {
  console.error('[Inventory] Fatal error:', err);
  process.exit(1);
});
