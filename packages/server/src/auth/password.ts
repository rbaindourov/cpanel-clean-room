/**
 * password.ts
 * Cryptographically secure password hashing and verification with Argon2id and scrypt.
 */

import crypto from 'node:crypto';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export class PasswordService implements PasswordHasher {
  private hasNativeArgon2: boolean = false;
  private argon2Module: any = null;
  private argon2Detected: boolean = false;
  private argon2InitPromise: Promise<void> | null = null;

  constructor() {
    this.ensureArgon2().catch(() => {});
  }

  private async ensureArgon2(): Promise<void> {
    if (this.argon2Detected) return;
    if (!this.argon2InitPromise) {
      this.argon2InitPromise = (async () => {
        try {
          this.argon2Module = await import('argon2');
          this.hasNativeArgon2 = true;
        } catch {
          this.hasNativeArgon2 = false;
        } finally {
          this.argon2Detected = true;
        }
      })();
    }
    await this.argon2InitPromise;
  }

  public async hash(password: string): Promise<string> {
    await this.ensureArgon2();
    if (this.hasNativeArgon2 && this.argon2Module) {
      try {
        const raw = await this.argon2Module.hash(password, {
          type: this.argon2Module.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        });
        return `{ARGON2ID}${raw}`;
      } catch {
        // Fallback to scrypt on error
      }
    }

    const scryptHash = await this.hashScrypt(password);
    return `{SCRYPT}${scryptHash}`;
  }

  public async verify(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash || !password) return false;

    // Plaintext $test$ bypass REMOVED permanently per security review.
    if (storedHash.startsWith('$test$')) {
      return false;
    }

    // Strip Dovecot scheme prefix if present (e.g. {ARGON2ID}$, {SCRYPT}$)
    let cleanHash = storedHash;
    if (cleanHash.startsWith('{ARGON2ID}')) {
      cleanHash = cleanHash.slice('{ARGON2ID}'.length);
    } else if (cleanHash.startsWith('{SCRYPT}')) {
      cleanHash = cleanHash.slice('{SCRYPT}'.length);
    }

    // 1. Argon2id format ($argon2id$)
    if (cleanHash.startsWith('$argon2id$')) {
      await this.ensureArgon2();
      if (this.hasNativeArgon2 && this.argon2Module) {
        try {
          return await this.argon2Module.verify(cleanHash, password);
        } catch {
          return false;
        }
      }
      return false;
    }

    // 2. Scrypt modular format ($scrypt$ln=14,r=8,p=1$...)
    if (cleanHash.startsWith('$scrypt$')) {
      return this.verifyScrypt(password, cleanHash);
    }

    // 2b. Simple scrypt format (scrypt:<salt>:<hash>)
    if (cleanHash.startsWith('scrypt:')) {
      return this.verifySimpleScrypt(password, cleanHash);
    }

    return false;
  }

  public needsRehash(hash: string): boolean {
    const clean = hash.replace(/^\{(ARGON2ID|SCRYPT)\}/i, '');
    if (this.hasNativeArgon2 && !clean.startsWith('$argon2id$')) {
      return true;
    }
    return false;
  }

  private async hashScrypt(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });

    return `$scrypt$ln=14,r=8,p=1$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  private async verifyScrypt(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    // Format: ["", "scrypt", "ln=14,r=8,p=1", "<salt_hex>", "<key_hex>"]
    if (parts.length !== 5) return false;

    const salt = Buffer.from(parts[3], 'hex');
    const expectedKey = Buffer.from(parts[4], 'hex');

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, expectedKey.length, { N: 16384, r: 8, p: 1 }, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    if (derivedKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  }

  private async verifySimpleScrypt(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    // Format: ["scrypt", "<salt_hex>", "<hash_hex>"]
    if (parts.length !== 3) return false;

    const salt = Buffer.from(parts[1], 'hex');
    const expectedKey = Buffer.from(parts[2], 'hex');

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, expectedKey.length, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    if (derivedKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  }
}
