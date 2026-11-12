import fs from 'node:fs';
import path from 'node:path';
import { SysrootEngine } from '../sysroot.ts';
import type { AgentServer } from '../index.ts';
import {
  FilesOperationParamsSchema,
  type FilesOperationParams,
  type FilesOperationResult,
  type FileEntry,
} from '@cpanel-clean-room/shared';

export class FilesHandler {
  sysroot: SysrootEngine;

  constructor(sysroot: SysrootEngine) {
    this.sysroot = sysroot;
  }

  /**
   * Resolves a target path ensuring strict chroot containment inside /home/<username>.
   * Throws PERMISSION_DENIED on path traversal or symlink escape.
   */
  public resolveContained(username: string, targetPath: string): string {
    const rawHome = path.resolve(this.sysroot.resolve(`/home/${username}`));
    this.sysroot.ensureDir(rawHome);
    const homeRoot = rawHome;
    const canonicalHome = fs.existsSync(rawHome) ? fs.realpathSync(rawHome) : rawHome;

    const cleanRel = targetPath.startsWith('/')
      ? '.' + targetPath
      : targetPath.replace(/^\/+/, '');
    const candidate = path.resolve(homeRoot, cleanRel);

    if (!candidate.startsWith(homeRoot + path.sep) && candidate !== homeRoot) {
      const err: any = new Error(`PERMISSION_DENIED: Path escapes tenant boundary: ${targetPath}`);
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    // Check candidate or its nearest existing ancestor directory for escaping symlinks
    let checkTarget = candidate;
    while (checkTarget !== homeRoot && !fs.existsSync(checkTarget)) {
      try {
        const lstat = fs.lstatSync(checkTarget, { throwIfNoEntry: false });
        if (lstat && lstat.isSymbolicLink()) {
          break;
        }
      } catch {
        // Ignored
      }
      const parent = path.dirname(checkTarget);
      if (parent === checkTarget) break;
      checkTarget = parent;
    }

    let real: string | null = null;
    try {
      real = fs.realpathSync(checkTarget);
    } catch {
      try {
        const lstat = fs.lstatSync(checkTarget, { throwIfNoEntry: false });
        if (lstat && lstat.isSymbolicLink()) {
          const rawTarget = fs.readlinkSync(checkTarget);
          real = path.resolve(path.dirname(checkTarget), rawTarget);
        }
      } catch {
        // Ignored
      }
    }

    // Move PERMISSION_DENIED throw outside try/catch so symlink escapes are never silently swallowed
    if (real && !real.startsWith(canonicalHome + path.sep) && real !== canonicalHome) {
      const err: any = new Error(`PERMISSION_DENIED: Symlink escapes tenant boundary: ${targetPath}`);
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    return candidate;
  }

  public async execOperation(params: FilesOperationParams): Promise<FilesOperationResult> {
    const { username, action, path: reqPath, targetPath, content, encoding = 'utf-8', mode, archiveFormat = 'tar.gz' } = params;
    const { uid, gid } = this.sysroot.getTenantUidGid(username);
    const resolvedPath = this.resolveContained(username, reqPath);

    switch (action) {
      case 'list': {
        if (!fs.existsSync(resolvedPath)) {
          const err: any = new Error(`NOT_FOUND: Path does not exist: ${reqPath}`);
          err.code = 'NOT_FOUND';
          throw err;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isDirectory()) {
          const entry: FileEntry = {
            name: path.basename(resolvedPath),
            path: reqPath,
            isDir: false,
            isSymlink: false,
            sizeBytes: stat.size,
            mode: stat.mode & 0o777,
            owner: username,
            group: username,
            mtime: stat.mtime.toISOString(),
          };
          return { action, success: true, entries: [entry] };
        }

        const dirEntries = fs.readdirSync(resolvedPath, { withFileTypes: true });
        const entries: FileEntry[] = dirEntries.map((dirent) => {
          const fullItemPath = path.join(resolvedPath, dirent.name);
          let itemStat: fs.Stats;
          try {
            itemStat = fs.statSync(fullItemPath);
          } catch {
            itemStat = fs.lstatSync(fullItemPath);
          }

          return {
            name: dirent.name,
            path: path.posix.join(reqPath, dirent.name),
            isDir: dirent.isDirectory(),
            isSymlink: dirent.isSymbolicLink(),
            sizeBytes: itemStat.size,
            mode: itemStat.mode & 0o777,
            owner: username,
            group: username,
            mtime: itemStat.mtime.toISOString(),
          };
        });

        return { action, success: true, entries };
      }

      case 'read': {
        if (!fs.existsSync(resolvedPath)) {
          const err: any = new Error(`NOT_FOUND: File not found: ${reqPath}`);
          err.code = 'NOT_FOUND';
          throw err;
        }

        const buffer = fs.readFileSync(resolvedPath);
        const readContent = encoding === 'base64' ? buffer.toString('base64') : buffer.toString('utf8');
        return {
          action,
          success: true,
          content: readContent,
          bytesRead: buffer.length,
        };
      }

      case 'write': {
        const fileContent = content ?? '';
        const buffer = encoding === 'base64' ? Buffer.from(fileContent, 'base64') : Buffer.from(fileContent, 'utf8');

        this.sysroot.ensureDir(path.dirname(resolvedPath));
        this.sysroot.atomicWriteFile(resolvedPath, buffer, {
          mode: mode ?? 0o644,
          uid,
          gid,
        });

        return {
          action,
          success: true,
          bytesWritten: buffer.length,
        };
      }

      case 'mkdir': {
        if (!fs.existsSync(resolvedPath)) {
          fs.mkdirSync(resolvedPath, { recursive: true, mode: mode ?? 0o755 });
        }
        return { action, success: true };
      }

      case 'delete': {
        if (fs.existsSync(resolvedPath)) {
          const stat = fs.lstatSync(resolvedPath);
          if (stat.isDirectory()) {
            fs.rmSync(resolvedPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(resolvedPath);
          }
        }
        return { action, success: true };
      }

      case 'rename': {
        if (!targetPath) {
          const err: any = new Error('INVALID_PARAMS: targetPath required for rename');
          err.code = 'INVALID_PARAMS';
          throw err;
        }
        const resolvedTarget = this.resolveContained(username, targetPath);
        this.sysroot.ensureDir(path.dirname(resolvedTarget));
        fs.renameSync(resolvedPath, resolvedTarget);
        return { action, success: true, targetPath };
      }

      case 'chmod': {
        if (mode === undefined) {
          const err: any = new Error('INVALID_PARAMS: mode required for chmod');
          err.code = 'INVALID_PARAMS';
          throw err;
        }
        const safeMode = Math.max(0o600, Math.min(mode, 0o775));
        fs.chmodSync(resolvedPath, safeMode);
        return { action, success: true };
      }

      case 'archive': {
        if (!targetPath) {
          const err: any = new Error('INVALID_PARAMS: targetPath required for archive');
          err.code = 'INVALID_PARAMS';
          throw err;
        }
        const resolvedTarget = this.resolveContained(username, targetPath);
        this.sysroot.ensureDir(path.dirname(resolvedTarget));

        if (!this.sysroot.isSandbox()) {
          const baseName = path.basename(resolvedPath);
          const parentDir = path.dirname(resolvedPath);
          if (archiveFormat === 'zip') {
            await this.sysroot.execCommand('zip', ['-r', resolvedTarget, '--', baseName], { cwd: parentDir });
          } else {
            await this.sysroot.execCommand('tar', ['-czf', resolvedTarget, '--', baseName], { cwd: parentDir });
          }
        } else {
          // In sandbox mode, mock archive creation or write header
          this.sysroot.atomicWriteFile(resolvedTarget, Buffer.from(`MOCK_ARCHIVE_${archiveFormat}_OF_${reqPath}`), {
            mode: 0o644,
            uid,
            gid,
          });
        }
        return { action, success: true, targetPath };
      }

      case 'extract': {
        const destPath = targetPath ? this.resolveContained(username, targetPath) : path.dirname(resolvedPath);
        this.sysroot.ensureDir(destPath);

        if (!this.sysroot.isSandbox()) {
          if (resolvedPath.endsWith('.zip')) {
            await this.sysroot.execCommand('unzip', ['-q', '-o', resolvedPath, '-d', destPath]);
          } else {
            await this.sysroot.execCommand('tar', ['-xzf', resolvedPath, '-C', destPath]);
          }
        } else {
          // Synthetic extraction marker
          this.sysroot.atomicWriteFile(path.join(destPath, 'extracted.txt'), 'Extraction complete', {
            mode: 0o644,
            uid,
            gid,
          });
        }
        return { action, success: true, targetPath: destPath };
      }

      default: {
        const err: any = new Error(`INVALID_PARAMS: Unsupported file action '${action}'`);
        err.code = 'INVALID_PARAMS';
        throw err;
      }
    }
  }
}

export function registerFilesHandlers(server: AgentServer): void {
  const handler = new FilesHandler(server.getSysroot());

  server.registerHandler('files.operation', (p) => handler.execOperation(p), FilesOperationParamsSchema);
}
