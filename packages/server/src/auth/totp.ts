/**
 * totp.ts
 * RFC 6238 compliant Time-Based One-Time Password engine with zero external dependencies.
 */

import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TotpEnrollment {
  secret: string;          // Base32 secret string
  uri: string;             // otpauth:// URI for QR code generators
  recoveryCodes: string[]; // 8 plaintext recovery codes shown once
  hashedRecoveryCodes: string[]; // SHA-256 hashes to store in database
}

export interface TotpVerificationResult {
  valid: boolean;
  step: number;
}

export class TotpService {
  /**
   * Generates a new 160-bit (20-byte) secret and enrollment payload.
   */
  public generateEnrollment(username: string, issuer = 'cPanel Clean-Room'): TotpEnrollment {
    const rawSecret = crypto.randomBytes(20);
    const secret = this.base32Encode(rawSecret);
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    const recoveryCodes: string[] = [];
    const hashedRecoveryCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
      recoveryCodes.push(code);
      hashedRecoveryCodes.push(crypto.createHash('sha256').update(code).digest('hex'));
    }

    return { secret, uri, recoveryCodes, hashedRecoveryCodes };
  }

  /**
   * Verifies a 6-digit TOTP code against a Base32 secret with +/- window drift
   * and enforces time-step counter monotonicity (replay protection per RFC 6238 §5.2).
   */
  public verifyStep(
    code: string,
    secret: string,
    lastVerifiedStep = 0,
    window = 1
  ): TotpVerificationResult {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return { valid: false, step: 0 };
    }

    const key = this.base32Decode(secret);
    const currentCounter = Math.floor(Date.now() / 1000 / 30);

    for (let delta = -window; delta <= window; delta++) {
      const counter = currentCounter + delta;
      // Replay prevention: counter must be strictly greater than lastVerifiedStep
      if (counter <= lastVerifiedStep) {
        continue;
      }

      const expectedCode = this.generateCodeForCounter(key, counter);
      if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
        return { valid: true, step: counter };
      }
    }

    return { valid: false, step: 0 };
  }

  /**
   * Verifies a 6-digit TOTP code against a Base32 secret with +/- 1 drift window.
   * Optional lastVerifiedStep parameter prevents time-step replay attacks.
   */
  public verifyCode(
    code: string,
    secret: string,
    window = 1,
    lastVerifiedStep = 0
  ): boolean {
    return this.verifyStep(code, secret, lastVerifiedStep, window).valid;
  }

  /**
   * Generates the current TOTP code for a given secret (useful for testing).
   */
  public generateCode(secret: string, offsetSteps = 0): string {
    const key = this.base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30) + offsetSteps;
    return this.generateCodeForCounter(key, counter);
  }

  /**
   * Verifies and burns a one-time recovery code.
   * Returns { valid: boolean, remainingHashedCodes: string[] }
   */
  public verifyAndConsumeRecoveryCode(
    providedCode: string,
    storedHashedCodes: string[]
  ): { valid: boolean; remainingHashedCodes: string[] } {
    const cleanedCode = providedCode.trim().toUpperCase();
    const providedHash = crypto.createHash('sha256').update(cleanedCode).digest('hex');

    const index = storedHashedCodes.findIndex((h) => h === providedHash);
    if (index === -1) {
      return { valid: false, remainingHashedCodes: storedHashedCodes };
    }

    const updated = [...storedHashedCodes];
    updated.splice(index, 1);
    return { valid: true, remainingHashedCodes: updated };
  }

  private generateCodeForCounter(key: Buffer, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  public base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  public base32Decode(base32Str: string): Buffer {
    const cleanStr = base32Str.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}
