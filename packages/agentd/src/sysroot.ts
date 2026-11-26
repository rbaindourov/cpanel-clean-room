import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  uid?: number;
  gid?: number;
  allowRealInSandbox?: boolean;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  mocked: boolean;
}

export interface MockExecutionRecord {
  timestamp: string;
  cmd: string;
  args: string[];
  cwd?: string;
  uid?: number;
  gid?: number;
}

export class SysrootEngine {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    const envSysroot = process.env.PANEL_SYSROOT;
    this.baseDir = path.resolve(customBaseDir || envSysroot || './scratch/sysroot');
  }

  public isSandbox(): boolean {
    return this.baseDir !== '/';
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Resolves any system absolute path to either host root (in production)
   * or the sandboxed sysroot directory (in sandbox mode).
   * Throws SecurityError if path escapes sysroot boundary.
   */
  public resolve(targetPath: string): string {
    if (!this.isSandbox()) {
      return path.resolve(targetPath);
    }
    const normalized = path.resolve(targetPath);
    if (normalized === this.baseDir || normalized.startsWith(this.baseDir + path.sep)) {
      return normalized;
    }
    const stripped = targetPath.replace(/^[a-zA-Z]:[\\\/]/, '').replace(/^[\\\/]+/, '');
    const resolved = path.resolve(this.baseDir, stripped);
    if (resolved !== this.baseDir && !resolved.startsWith(this.baseDir + path.sep)) {
      throw new Error(`SecurityError: Target path escapes sysroot boundary: ${targetPath}`);
    }
    return resolved;
  }

  /**
   * Resolves the socket path, ensuring it stays under the 108-byte Linux limit.
   */
  public resolveSocketPath(overridePath?: string): string {
    if (overridePath) return path.resolve(overridePath);
    if (process.env.PANEL_SOCK_PATH) return path.resolve(process.env.PANEL_SOCK_PATH);

    if (!this.isSandbox()) {
      return '/run/panel/agent.sock';
    }

    const standard = this.resolve('/run/panel/agent.sock');
    if (standard.length <= 104) {
      return standard;
    }

    // Fallback to /tmp to prevent Linux EINVAL on sockaddr_un length > 108 bytes
    return path.resolve('/tmp/panel-agent-sandbox.sock');
  }

  /**
   * Ensures the target directory exists within the sysroot.
   */
  public ensureDir(dirPath: string): string {
    const resolved = this.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }

  /**
   * Writes file contents atomically via temporary sibling file, fsync, and rename.
   */
  public atomicWriteFile(
    targetPath: string,
    content: string | Buffer,
    options?: { mode?: number; uid?: number; gid?: number }
  ): string {
    const resolved = this.resolve(targetPath);
    this.ensureDir(path.dirname(resolved));

    const tempFile = `${resolved}.tmp.${process.pid}.${Date.now()}`;
    const fd = fs.openSync(tempFile, 'w', options?.mode ?? 0o644);
    try {
      if (typeof content === 'string') {
        fs.writeFileSync(fd, content, 'utf8');
      } else {
        fs.writeFileSync(fd, content);
      }
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    if (options?.mode !== undefined) {
      fs.chmodSync(tempFile, options.mode);
    }

    if (!this.isSandbox() && options?.uid !== undefined && options?.gid !== undefined) {
      try {
        fs.chownSync(tempFile, options.uid, options.gid);
      } catch {
        // Ignored if running unprivileged in test
      }
    }

    fs.renameSync(tempFile, resolved);
    return resolved;
  }

  public readFile(targetPath: string, encoding: BufferEncoding = 'utf8'): string {
    const resolved = this.resolve(targetPath);
    return fs.readFileSync(resolved, encoding);
  }

  public readBuffer(targetPath: string): Buffer {
    const resolved = this.resolve(targetPath);
    return fs.readFileSync(resolved);
  }

  public removeFile(targetPath: string): boolean {
    const resolved = this.resolve(targetPath);
    if (fs.existsSync(resolved)) {
      const stat = fs.lstatSync(resolved);
      if (stat.isDirectory()) {
        fs.rmSync(resolved, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolved);
      }
      return true;
    }
    return false;
  }

  public exists(targetPath: string): boolean {
    const resolved = this.resolve(targetPath);
    return fs.existsSync(resolved);
  }

  /**
   * Helper to obtain tenant UID/GID.
   */
  public getTenantUidGid(username: string): { uid: number; gid: number } {
    if (username === 'acme') {
      return { uid: 1005, gid: 1005 };
    }
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = (hash << 5) - hash + username.charCodeAt(i);
      hash |= 0;
    }
    const uid = 1000 + Math.abs(hash % 9000);
    return { uid, gid: uid };
  }

  /**
   * Executes a command via child_process.execFile in production,
   * or records to mock_executions.log in sandbox mode.
   */
  public async execCommand(
    cmd: string,
    args: string[] = [],
    options?: ExecOptions
  ): Promise<ExecResult> {
    // Defense-in-depth: Ensure tar invocations use '--' before filename arguments to prevent flag injection
    let effectiveArgs = args;
    if (cmd === 'tar' && !args.includes('--')) {
      if (args.length >= 3 && args[0].startsWith('-') && args[0].includes('f')) {
        if (args[2] !== '-C') {
          effectiveArgs = [args[0], args[1], '--', ...args.slice(2)];
        }
      }
    }

    if (!this.isSandbox() || options?.allowRealInSandbox) {
      try {
        const { stdout, stderr } = await execFileAsync(cmd, effectiveArgs, {
          cwd: options?.cwd,
          env: options?.env ? { ...process.env, ...options.env } : process.env,
          timeout: options?.timeout || 30000,
          uid: options?.uid,
          gid: options?.gid,
        });
        return {
          code: 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          mocked: false,
        };
      } catch (err: any) {
        return {
          code: typeof err.code === 'number' ? err.code : 1,
          stdout: err.stdout ? err.stdout.toString() : '',
          stderr: err.stderr ? err.stderr.toString() : err.message,
          mocked: false,
        };
      }
    }

    // Sandbox mock mode — audit log to var/log/mock_executions.log
    const logDir = this.resolve('/var/log');
    this.ensureDir(logDir);
    const logPath = path.join(logDir, 'mock_executions.log');
    const record: MockExecutionRecord = {
      timestamp: new Date().toISOString(),
      cmd,
      args: effectiveArgs,
      cwd: options?.cwd,
      uid: options?.uid,
      gid: options?.gid,
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');

    // Tailored synthetic outputs for system validation tools
    let stdout = `[MOCK] ${cmd} ${effectiveArgs.join(' ')}\n`;
    if (cmd === 'nginx' && effectiveArgs.includes('-t')) {
      stdout = 'nginx: configuration file syntax is ok\nnginx: configuration file test is successful\n';
    } else if (cmd === 'named-checkzone') {
      stdout = 'OK\n';
    } else if (cmd === 'systemctl' && effectiveArgs.includes('is-active')) {
      stdout = 'active\n';
    } else if (cmd === 'wp') {
      if (effectiveArgs.includes('core') && effectiveArgs.includes('version')) {
        stdout = '6.7.1\n';
      } else if (effectiveArgs.includes('login') && effectiveArgs.includes('create')) {
        stdout = 'https://example-store.com/wp-login.php?action=sso&token=mock-token-123\n';
      } else {
        stdout = 'Success: Command executed successfully.\n';
      }
    } else if (cmd === 'restic') {
      if (effectiveArgs.includes('snapshots')) {
        stdout = JSON.stringify([
          {
            time: '2026-11-12T08:00:00Z',
            id: 'a1b2c3d4',
            short_id: 'a1b2c3d4',
            paths: ['/home/acme'],
          },
        ]);
      } else {
        stdout = JSON.stringify({ message_type: 'summary', files_new: 15, total_bytes_processed: 54829104 });
      }
    }

    return {
      code: 0,
      stdout,
      stderr: '',
      mocked: true,
    };
  }

  public getMockExecutions(): MockExecutionRecord[] {
    const logPath = path.join(this.resolve('/var/log'), 'mock_executions.log');
    if (!fs.existsSync(logPath)) {
      return [];
    }
    const content = fs.readFileSync(logPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }

  public clearMockExecutions(): void {
    const logPath = path.join(this.resolve('/var/log'), 'mock_executions.log');
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  }

  /**
   * Pre-creates standard sysroot directories.
   */
  public scaffold(): void {
    const standardDirs = [
      '/etc/nginx/sites-available',
      '/etc/nginx/sites-enabled',
      '/etc/php/5.6/fpm/pool.d',
      '/etc/php/7.0/fpm/pool.d',
      '/etc/php/7.1/fpm/pool.d',
      '/etc/php/7.2/fpm/pool.d',
      '/etc/php/7.3/fpm/pool.d',
      '/etc/php/7.4/fpm/pool.d',
      '/etc/php/8.0/fpm/pool.d',
      '/etc/php/8.1/fpm/pool.d',
      '/etc/php/8.2/fpm/pool.d',
      '/etc/php/8.3/fpm/pool.d',
      '/etc/php/8.4/fpm/pool.d',
      '/etc/php/8.5/fpm/pool.d',
      '/etc/bind/zones',
      '/etc/postfix',
      '/etc/dovecot',
      '/etc/systemd/system',
      '/etc/cron.d',
      '/etc/ssl/certs',
      '/etc/ssl/private',
      '/var/lib/panel',
      '/var/lib/rspamd/dkim',
      '/var/log/nginx',
      '/var/log/panel',
      '/run/panel',
      '/run/php',
      '/home',
    ];

    for (const dir of standardDirs) {
      this.ensureDir(dir);
    }
  }
}

// Default singleton instance
export const sysroot = new SysrootEngine();
