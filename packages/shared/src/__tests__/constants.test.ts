import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLIANCE_PORTS,
  SUPPORTED_PHP_VERSIONS,
  DEFAULT_PHP_VERSION,
  DEFAULT_PLAN_LIMITS,
  SYSTEM_PATHS,
  DEFAULT_DNS_SETTINGS,
} from '../constants.ts';

describe('constants.ts Appliance Constants', () => {
  test('Appliance network ports are unique and correctly defined', () => {
    assert.equal(APPLIANCE_PORTS.PANEL_DEFAULT_HTTPS, 8443);
    assert.equal(APPLIANCE_PORTS.CPANEL_HTTPS, 2083);
    assert.equal(APPLIANCE_PORTS.WHM_HTTPS, 2087);
    assert.equal(APPLIANCE_PORTS.WEBMAIL_HTTPS, 2096);
    assert.equal(APPLIANCE_PORTS.APACHE_BACKEND_PORT, 8080);
    assert.equal(APPLIANCE_PORTS.APACHE_BACKEND_HOST, '127.0.0.1');
    assert.equal(APPLIANCE_PORTS.MYSQL_PORT, 3306);
    assert.equal(APPLIANCE_PORTS.DNS_PORT, 53);
    assert.equal(APPLIANCE_PORTS.IMAP_PORT, 143);
    assert.equal(APPLIANCE_PORTS.IMAPS_PORT, 993);
    assert.equal(APPLIANCE_PORTS.MANAGESIEVE_PORT, 4190);
  });

  test('Supported PHP versions range from 5.6 to 8.5 with valid default', () => {
    assert.ok(SUPPORTED_PHP_VERSIONS.includes('5.6'));
    assert.ok(SUPPORTED_PHP_VERSIONS.includes('7.4'));
    assert.ok(SUPPORTED_PHP_VERSIONS.includes('8.3'));
    assert.ok(SUPPORTED_PHP_VERSIONS.includes('8.4'));
    assert.ok(SUPPORTED_PHP_VERSIONS.includes('8.5'));
    assert.equal(DEFAULT_PHP_VERSION, '8.3');
    assert.ok(SUPPORTED_PHP_VERSIONS.includes(DEFAULT_PHP_VERSION));
  });

  test('Default plan limits provide realistic hosting quotas', () => {
    assert.equal(DEFAULT_PLAN_LIMITS.diskQuotaBytes, 10737418240); // 10 GB
    assert.equal(DEFAULT_PLAN_LIMITS.bandwidthLimitBytes, 107374182400); // 100 GB
    assert.equal(DEFAULT_PLAN_LIMITS.maxDomains, 10);
    assert.equal(DEFAULT_PLAN_LIMITS.cpuQuotaPercent, 200);
    assert.equal(DEFAULT_PLAN_LIMITS.memoryMaxBytes, 2147483648);
  });

  test('System paths match production and sandbox requirements', () => {
    assert.equal(SYSTEM_PATHS.PRODUCTION_SYSROOT, '/');
    assert.equal(SYSTEM_PATHS.SANDBOX_SYSROOT, './scratch/sysroot');
    assert.equal(SYSTEM_PATHS.AGENT_SOCKET_DEFAULT, '/run/panel/agent.sock');
    assert.equal(SYSTEM_PATHS.AGENT_SOCKET_SANDBOX, './scratch/sysroot/run/panel/agent.sock');
  });

  test('Default DNS settings match RFC 1035 defaults', () => {
    assert.equal(DEFAULT_DNS_SETTINGS.DEFAULT_TTL, 300);
    assert.equal(DEFAULT_DNS_SETTINGS.DEFAULT_PRIMARY_NS, 'ns1.winwinhost.com.');
    assert.equal(DEFAULT_DNS_SETTINGS.DEFAULT_SOA_REFRESH, 10800);
  });
});
