/**
 * packages/web/src/utils/permissions.ts
 * Two-way conversion between octal permissions and 3x3 permission matrix.
 */

import type { ModeBreakdown } from '../types/files.ts';

export function modeToBreakdown(mode: number): ModeBreakdown {
  const u = (mode >> 6) & 7;
  const g = (mode >> 3) & 7;
  const o = mode & 7;
  return {
    user: { r: (u & 4) !== 0, w: (u & 2) !== 0, x: (u & 1) !== 0 },
    group: { r: (g & 4) !== 0, w: (g & 2) !== 0, x: (g & 1) !== 0 },
    others: { r: (o & 4) !== 0, w: (o & 2) !== 0, x: (o & 1) !== 0 },
  };
}

export function breakdownToMode(bd: ModeBreakdown): number {
  const u = (bd.user.r ? 4 : 0) | (bd.user.w ? 2 : 0) | (bd.user.x ? 1 : 0);
  const g = (bd.group.r ? 4 : 0) | (bd.group.w ? 2 : 0) | (bd.group.x ? 1 : 0);
  const o = (bd.others.r ? 4 : 0) | (bd.others.w ? 2 : 0) | (bd.others.x ? 1 : 0);
  return (u << 6) | (g << 3) | o;
}

export function modeToOctalString(mode: number): string {
  const octal = (mode & 0o777).toString(8).padStart(3, '0');
  return `0${octal}`;
}

export function parseOctalString(octalStr: string): number {
  if (typeof octalStr !== 'string') {
    return 0o644;
  }
  const trimmed = octalStr.trim();
  if (!trimmed || !/^[0-7]+$/.test(trimmed)) {
    return 0o644;
  }
  const clean = trimmed.replace(/^0+/, '') || '0';
  const parsed = parseInt(clean, 8);
  return isNaN(parsed) ? 0o644 : parsed;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
