import test from 'node:test';
import assert from 'node:assert/strict';
import { RPC_OPERATIONS, APPLIANCE_PORTS } from '@cpanel-clean-room/shared';

test('shared package workspace resolution in agentd', () => {
  assert.equal(Object.keys(RPC_OPERATIONS).length, 24);
  assert.equal(APPLIANCE_PORTS.PANEL_DEFAULT_HTTPS, 8443);
});
