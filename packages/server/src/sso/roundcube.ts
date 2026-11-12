/**
 * roundcube.ts
 * 1-Click Roundcube Webmail SSO bridge (ADR-08 / EML-01).
 * Cryptographically signed HMAC-SHA256 token generator.
 */

import crypto from 'node:crypto';

export interface RoundcubeSsoOptions {
  email: string;
  username: string;
  ssoSecret?: string;
  validityWindowSeconds?: number;
}

export interface RoundcubeSsoResult {
  ssoToken: string;
  email: string;
  redirectUrl: string;
  expiresAt: string;
}

export function createRoundcubeSignonToken(options: RoundcubeSsoOptions): RoundcubeSsoResult {
  const {
    email,
    username,
    ssoSecret = process.env.PANEL_SSO_SECRET ||
      process.env.PANEL_ROUNDCUBE_SSO_SECRET ||
      'panel-roundcube-sso-secret-key-32bytes!',
    validityWindowSeconds = 300, // 5 minutes
  } = options;

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAtUnix = timestamp + validityWindowSeconds;

  const payload = {
    email,
    username,
    timestamp,
    nonce,
    expiresAt: expiresAtUnix,
  };

  const signature = crypto
    .createHmac('sha256', ssoSecret)
    .update(`${email}:${timestamp}:${nonce}`)
    .digest('hex');

  const ssoToken = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + signature;
  const redirectUrl = `/webmail/?_autologin=1&_user=${encodeURIComponent(email)}&_token=${ssoToken}`;

  return {
    ssoToken,
    email,
    redirectUrl,
    expiresAt: new Date(expiresAtUnix * 1000).toISOString(),
  };
}

export function verifyRoundcubeSignonToken(
  ssoToken: string,
  ssoSecret = process.env.PANEL_SSO_SECRET ||
    process.env.PANEL_ROUNDCUBE_SSO_SECRET ||
    'panel-roundcube-sso-secret-key-32bytes!'
): { valid: boolean; payload?: any } {
  try {
    const parts = ssoToken.split('.');
    if (parts.length !== 2) return { valid: false };

    const [b64Payload, signature] = parts;
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));

    const expectedSig = crypto
      .createHmac('sha256', ssoSecret)
      .update(`${payload.email}:${payload.timestamp}:${payload.nonce}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt && payload.expiresAt < now) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}
