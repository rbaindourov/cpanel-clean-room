import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';
import type { AgentServer } from '../index.ts';
import {
  MailUpsertDomainParamsSchema,
  MailUpsertMailboxParamsSchema,
  MailDeleteMailboxParamsSchema,
  MailUpsertForwarderParamsSchema,
  MailUpsertSieveParamsSchema,
  type MailUpsertDomainParams,
  type MailUpsertDomainResult,
  type MailUpsertMailboxParams,
  type MailUpsertMailboxResult,
  type MailDeleteMailboxParams,
  type MailDeleteMailboxResult,
  type MailUpsertForwarderParams,
  type MailUpsertForwarderResult,
  type MailUpsertSieveParams,
  type MailUpsertSieveResult,
} from '@cpanel-clean-room/shared';

export class MailRspamdHandler {
  sysroot: SysrootEngine;

  constructor(sysroot: SysrootEngine) {
    this.sysroot = sysroot;
  }

  private validateLocalPart(localPart: string): void {
    if (!localPart || localPart.includes('..') || localPart.includes('/') || localPart.includes('\\')) {
      const err: any = new Error(`INVALID_PARAMS: Path traversal characters forbidden in localPart: ${localPart}`);
      err.code = 'INVALID_PARAMS';
      throw err;
    }
    if (!/^[a-z0-9]+([._-][a-z0-9]+)*$/i.test(localPart)) {
      const err: any = new Error(`INVALID_PARAMS: Malformed localPart: ${localPart}`);
      err.code = 'INVALID_PARAMS';
      throw err;
    }
  }

  private validateSieveSyntax(script: string): { valid: boolean; error?: string } {
    const trimmed = script.trim();
    if (!trimmed) return { valid: true };

    let inString = false;
    let inBlockComment = false;
    let escape = false;
    const bracketStack: string[] = [];

    for (let i = 0; i < script.length; i++) {
      const ch = script[i];
      const next = script[i + 1] || '';

      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; i++; }
        continue;
      }
      if (!inString && ch === '#') {
        while (i < script.length && script[i] !== '\n') { i++; }
        continue;
      }
      if (!inString && ch === '/' && next === '*') {
        inBlockComment = true; i++; continue;
      }
      if (inString) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = false; continue; }
        if (ch === '\n') { return { valid: false, error: 'Unclosed string literal across line break' }; }
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{' || ch === '[' || ch === '(') { bracketStack.push(ch); continue; }
      if (ch === '}' || ch === ']' || ch === ')') {
        const last = bracketStack.pop();
        const expected = ch === '}' ? '{' : ch === ']' ? '[' : '(';
        if (last !== expected) return { valid: false, error: `Mismatched bracket: expected closing for ${last}, got ${ch}` };
        continue;
      }
      if (/[!@$%^&*~`|]/.test(ch)) {
        return { valid: false, error: `Illegal Sieve token character: '${ch}'` };
      }
    }
    if (inString) return { valid: false, error: 'Unclosed string literal' };
    if (inBlockComment) return { valid: false, error: 'Unclosed block comment' };
    if (bracketStack.length > 0) return { valid: false, error: `Unclosed bracket: ${bracketStack.pop()}` };
    return { valid: true };
  }

  public async upsertDomain(params: MailUpsertDomainParams): Promise<MailUpsertDomainResult> {
    const { domain, dkimSelector = 'default', keyType = 'rsa2048' } = params;

    let privateKeyPem = '';
    let publicKeyB64 = '';

    if (keyType === 'ed25519') {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
      privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const pubSpki = publicKey.export({ type: 'spki', format: 'der' });
      publicKeyB64 = pubSpki.toString('base64');
    } else {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const pubSpki = publicKey.export({ type: 'spki', format: 'der' });
      publicKeyB64 = pubSpki.toString('base64');
    }

    const dkimDir = '/var/lib/rspamd/dkim';
    this.sysroot.ensureDir(dkimDir);
    const dkimKeyPath = `${dkimDir}/${domain}.dkim.key`;
    this.sysroot.atomicWriteFile(dkimKeyPath, privateKeyPem, { mode: 0o640 });

    const keyTypeStr = keyType === 'ed25519' ? 'ed25519' : 'rsa';
    const dkimValue = `v=DKIM1; k=${keyTypeStr}; p=${publicKeyB64}`;

    return {
      dkimKeyPath,
      dkimSelector,
      dkimDnsRecord: {
        name: `${dkimSelector}._domainkey.${domain}`,
        type: 'TXT',
        value: dkimValue,
      },
    };
  }

  public async upsertMailbox(params: MailUpsertMailboxParams): Promise<MailUpsertMailboxResult> {
    const { username, domain, localPart, passwordHash, quotaBytes = 1073741824 } = params;
    this.validateLocalPart(localPart);
    const email = `${localPart}@${domain}`;
    const { uid, gid } = this.sysroot.getTenantUidGid(username);

    // 1. Scaffold Maildir++ structure with cur, new, tmp in all subfolders
    const maildirRel = `/home/${username}/mail/${domain}/${localPart}`;
    for (const topSub of ['cur', 'new', 'tmp']) {
      this.sysroot.ensureDir(path.join(maildirRel, topSub));
    }
    const maildirSubfolders = ['.Drafts', '.Sent', '.Trash', '.Junk', '.Archive'];
    for (const sub of maildirSubfolders) {
      const subPath = path.join(maildirRel, sub);
      this.sysroot.ensureDir(subPath);
      this.sysroot.ensureDir(path.join(subPath, 'cur'));
      this.sysroot.ensureDir(path.join(subPath, 'new'));
      this.sysroot.ensureDir(path.join(subPath, 'tmp'));
      const maildirfolderFile = path.join(subPath, 'maildirfolder');
      if (!this.sysroot.exists(maildirfolderFile)) {
        this.sysroot.atomicWriteFile(maildirfolderFile, '', { mode: 0o600 });
      }
    }

    // 2. Update /etc/dovecot/passwd
    const passwdRel = '/etc/dovecot/passwd';
    let passwdContent = '';
    if (this.sysroot.exists(passwdRel)) {
      passwdContent = this.sysroot.readFile(passwdRel);
    }

    const maildirFull = this.sysroot.resolve(maildirRel);
    const entryLine = `${email}:${passwordHash}:${uid}:${gid}::${maildirFull}::userdb_mail=maildir:${maildirFull} userdb_quota_rule=*:storage=${quotaBytes}\n`;

    const lines = passwdContent.split('\n').filter((l) => l.trim() && !l.startsWith(`${email}:`));
    lines.push(entryLine.trim());
    this.sysroot.atomicWriteFile(passwdRel, lines.join('\n') + '\n', { mode: 0o640 });

    await this.sysroot.execCommand('systemctl', ['reload', 'dovecot']);

    return {
      email,
      maildirPath: maildirRel,
      quotaBytes,
    };
  }

  public async deleteMailbox(params: MailDeleteMailboxParams): Promise<MailDeleteMailboxResult> {
    const { username, domain, localPart, purgeMaildir = false } = params;
    this.validateLocalPart(localPart);
    const email = `${localPart}@${domain}`;

    const passwdRel = '/etc/dovecot/passwd';
    if (this.sysroot.exists(passwdRel)) {
      const content = this.sysroot.readFile(passwdRel);
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith(`${email}:`));
      this.sysroot.atomicWriteFile(passwdRel, lines.join('\n') + (lines.length > 0 ? '\n' : ''), {
        mode: 0o640,
      });
    }

    if (purgeMaildir) {
      const maildirRel = `/home/${username}/mail/${domain}/${localPart}`;
      const resolved = this.sysroot.resolve(maildirRel);
      if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    }

    await this.sysroot.execCommand('systemctl', ['reload', 'dovecot']);

    return { deleted: true };
  }

  public async upsertForwarder(params: MailUpsertForwarderParams): Promise<MailUpsertForwarderResult> {
    const { source, destinations } = params;

    const virtualRel = '/etc/postfix/virtual';
    let virtualContent = '';
    if (this.sysroot.exists(virtualRel)) {
      virtualContent = this.sysroot.readFile(virtualRel);
    }

    const destString = destinations.join(',');
    const newLine = `${source} ${destString}`;

    const lines = virtualContent.split('\n').filter((l) => l.trim() && !l.startsWith(`${source} `));
    lines.push(newLine);

    this.sysroot.atomicWriteFile(virtualRel, lines.join('\n') + '\n', { mode: 0o644 });

    const resolvedVirtual = this.sysroot.resolve(virtualRel);
    await this.sysroot.execCommand('postmap', [resolvedVirtual]);
    await this.sysroot.execCommand('systemctl', ['reload', 'postfix']);

    return {
      updated: true,
      mapEntriesCount: lines.length,
    };
  }

  public async upsertSieve(params: MailUpsertSieveParams): Promise<MailUpsertSieveResult> {
    const { username, domain, localPart, sieveScript } = params;
    this.validateLocalPart(localPart);

    const syntaxCheck = this.validateSieveSyntax(sieveScript);
    if (!syntaxCheck.valid) {
      const err: any = new Error(`SIEVE_SYNTAX_ERROR: Sieve syntax validation failed: ${syntaxCheck.error}`);
      err.code = 'SIEVE_SYNTAX_ERROR';
      throw err;
    }

    const sieveRel = `/home/${username}/mail/${domain}/${localPart}/.dovecot.sieve`;
    this.sysroot.atomicWriteFile(sieveRel, sieveScript, { mode: 0o600 });

    const resolved = this.sysroot.resolve(sieveRel);
    const compileRes = await this.sysroot.execCommand('sievec', [resolved]);
    if (compileRes.code !== 0) {
      const err: any = new Error(`sievec compilation failed: ${compileRes.stderr}`);
      err.code = 'SIEVE_COMPILE_FAILED';
      throw err;
    }

    return {
      compiled: true,
      sievePath: sieveRel,
    };
  }
}

export function registerMailRspamdHandlers(server: AgentServer): void {
  const handler = new MailRspamdHandler(server.getSysroot());

  server.registerHandler('mail.upsertDomain', (p) => handler.upsertDomain(p), MailUpsertDomainParamsSchema);
  server.registerHandler('mail.upsertMailbox', (p) => handler.upsertMailbox(p), MailUpsertMailboxParamsSchema);
  server.registerHandler('mail.deleteMailbox', (p) => handler.deleteMailbox(p), MailDeleteMailboxParamsSchema);
  server.registerHandler('mail.upsertForwarder', (p) => handler.upsertForwarder(p), MailUpsertForwarderParamsSchema);
  server.registerHandler('mail.upsertSieve', (p) => handler.upsertSieve(p), MailUpsertSieveParamsSchema);
}
