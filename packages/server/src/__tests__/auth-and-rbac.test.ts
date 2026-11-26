import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../db/sqlite-adapter.ts';
import { createStandardMigrationRunner } from '../db/migrations.ts';
import { PasswordService } from '../auth/password.ts';
import { TotpService } from '../auth/totp.ts';
import { JwtService } from '../auth/jwt.ts';
import { RbacPolicyEngine } from '../auth/rbac.ts';
import { ApiTokenService } from '../auth/api-tokens.ts';
import { SessionRevocationService } from '../auth/session-revocation.ts';

test('Auth, RBAC, Tokens & Session Security Suite', async (t) => {
  await t.test('PasswordService hashes and verifies passwords with timing safety', async () => {
    const passwordSvc = new PasswordService();
    const rawPass = 'SuperSecretAcmePass2026!';

    const hash = await passwordSvc.hash(rawPass);
    assert.ok(hash.length > 20);

    const valid = await passwordSvc.verify(rawPass, hash);
    assert.strictEqual(valid, true);

    const wrong = await passwordSvc.verify('WrongPassword123!', hash);
    assert.strictEqual(wrong, false);

    const empty = await passwordSvc.verify('', hash);
    assert.strictEqual(empty, false);
  });

  await t.test('TotpService generates RFC 6238 secrets, codes, and handles drift & recovery codes', () => {
    const totpSvc = new TotpService();
    const enrollment = totpSvc.generateEnrollment('acme', 'cPanel Clean-Room');

    assert.ok(enrollment.secret.length >= 16);
    assert.ok(enrollment.uri.startsWith('otpauth://totp/'));
    assert.strictEqual(enrollment.recoveryCodes.length, 8);
    assert.strictEqual(enrollment.hashedRecoveryCodes.length, 8);

    // Current code verification
    const currentCode = totpSvc.generateCode(enrollment.secret);
    assert.strictEqual(totpSvc.verifyCode(currentCode, enrollment.secret), true);

    // Code with drift +1 step (valid in window 1)
    const driftCode = totpSvc.generateCode(enrollment.secret, 1);
    assert.strictEqual(totpSvc.verifyCode(driftCode, enrollment.secret, 1), true);

    // Invalid code
    assert.strictEqual(totpSvc.verifyCode('000000', enrollment.secret), false);

    // Recovery code burn
    const codeToBurn = enrollment.recoveryCodes[0];
    const burnResult = totpSvc.verifyAndConsumeRecoveryCode(codeToBurn, enrollment.hashedRecoveryCodes);
    assert.strictEqual(burnResult.valid, true);
    assert.strictEqual(burnResult.remainingHashedCodes.length, 7);

    // Replay of burned code fails
    const replayResult = totpSvc.verifyAndConsumeRecoveryCode(codeToBurn, burnResult.remainingHashedCodes);
    assert.strictEqual(replayResult.valid, false);
  });

  await t.test('JwtService signs and verifies HS256 access and refresh tokens', () => {
    const jwtSvc = new JwtService('test-secret-signing-key-for-jwt-32-chars-long!');

    const { token, jti, expiresAt } = jwtSvc.signAccessToken({
      id: 'usr_1',
      username: 'acme',
      email: 'acme@example-store.com',
      role: 'customer',
    });

    assert.ok(token.split('.').length === 3);
    assert.ok(jti.length > 10);
    assert.ok(expiresAt > Math.floor(Date.now() / 1000));

    const payload = jwtSvc.verifyAccessToken(token);
    assert.strictEqual(payload.sub, 'usr_1');
    assert.strictEqual(payload.username, 'acme');
    assert.strictEqual(payload.role, 'customer');
    assert.strictEqual(payload.jti, jti);

    // Refresh token
    const refresh = jwtSvc.signRefreshToken('usr_1');
    const refreshPayload = jwtSvc.verifyRefreshToken(refresh.token);
    assert.strictEqual(refreshPayload.sub, 'usr_1');
    assert.strictEqual(refreshPayload.type, 'refresh');

    // Attempting to verify refresh token as access token should throw
    assert.throws(() => jwtSvc.verifyAccessToken(refresh.token));
  });

  await t.test('RbacPolicyEngine enforces 3-tier rules and 1-click impersonation boundaries', () => {
    const rbac = new RbacPolicyEngine();

    const adminUser = {
      id: 'usr_admin',
      username: 'root',
      email: 'root@host.com',
      role: 'admin' as const,
      status: 'active' as const,
      quotaBytes: 0,
    };

    const resellerUser = {
      id: 'usr_reseller',
      username: 'reseller1',
      email: 'reseller@host.com',
      role: 'reseller' as const,
      status: 'active' as const,
      quotaBytes: 107374182400,
    };

    const customerAcme = {
      id: 'usr_acme',
      username: 'acme',
      email: 'acme@example-store.com',
      role: 'customer' as const,
      resellerId: 'usr_reseller',
      status: 'active' as const,
      quotaBytes: 10737418240,
    };

    const otherCustomer = {
      id: 'usr_other',
      username: 'other',
      email: 'other@example.com',
      role: 'customer' as const,
      resellerId: 'usr_other_reseller',
      status: 'active' as const,
      quotaBytes: 10737418240,
    };

    // 1. Admin can impersonate reseller and customer
    assert.strictEqual(rbac.canImpersonate(adminUser, resellerUser).allowed, true);
    assert.strictEqual(rbac.canImpersonate(adminUser, customerAcme).allowed, true);

    // 2. Admin CANNOT impersonate another admin
    const peerAdmin = { ...adminUser, id: 'usr_admin_2', username: 'admin2' };
    assert.strictEqual(rbac.canImpersonate(adminUser, peerAdmin).allowed, false);

    // 3. Reseller CAN impersonate customer they own
    assert.strictEqual(rbac.canImpersonate(resellerUser, customerAcme).allowed, true);

    // 4. Reseller CANNOT impersonate customer owned by someone else
    assert.strictEqual(rbac.canImpersonate(resellerUser, otherCustomer).allowed, false);

    // 5. Customer CANNOT impersonate anyone
    assert.strictEqual(rbac.canImpersonate(customerAcme, resellerUser).allowed, false);
    assert.strictEqual(rbac.canImpersonate(customerAcme, otherCustomer).allowed, false);
  });

  await t.test('ApiTokenService creates, verifies, and revokes scoped tokens', () => {
    const db = new SQLiteAdapter(':memory:');
    createStandardMigrationRunner(db).runPendingMigrations();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, plan_name, quota_bytes, created_at)
      VALUES ('usr_acme', 'acme', 'hash', 'customer', 'acme@example.com', 'Standard', 10737418240, datetime('now'))
    `).run();

    const tokenSvc = new ApiTokenService(db);
    const { plaintextToken, record } = tokenSvc.createToken(
      'usr_acme',
      'Deploy CI Key',
      ['files.write', 'web.upsertVhost'],
      30
    );

    assert.ok(plaintextToken.startsWith('cpr_tok_'));
    assert.strictEqual(record.name, 'Deploy CI Key');

    // Validate token
    const validated = tokenSvc.validateToken(plaintextToken);
    assert.ok(validated);
    assert.strictEqual(validated.userId, 'usr_acme');

    // Test scope checks
    assert.strictEqual(tokenSvc.hasScope(validated.scopes, 'files.write'), true);
    assert.strictEqual(tokenSvc.hasScope(validated.scopes, 'mysql.dropDatabase'), false);

    // Revoke token
    const revoked = tokenSvc.revokeToken('usr_acme', record.id);
    assert.strictEqual(revoked, true);

    // Validated after revoke should return null
    assert.strictEqual(tokenSvc.validateToken(plaintextToken), null);

    db.close();
  });

  await t.test('SessionRevocationService tracks revoked JWT JTIs', () => {
    const db = new SQLiteAdapter(':memory:');
    createStandardMigrationRunner(db).runPendingMigrations();

    // Insert user for foreign key constraint
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, email, plan_name, quota_bytes, created_at)
      VALUES ('usr_acme', 'acme', 'hash', 'customer', 'acme@example.com', 'Standard', 10737418240, datetime('now'))
    `).run();

    const revMgr = new SessionRevocationService(db);
    const testJti = 'test-jti-session-12345';

    assert.strictEqual(revMgr.isRevoked(testJti), false);

    const expiresAtUnix = Math.floor(Date.now() / 1000) + 3600;
    revMgr.revokeToken(testJti, 'usr_acme', expiresAtUnix);

    assert.strictEqual(revMgr.isRevoked(testJti), true);

    db.close();
  });
});
