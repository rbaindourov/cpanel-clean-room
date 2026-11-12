/**
 * rpc-schema.ts
 * Strongly-typed Zod schemas and TypeScript types for panel-agentd Unix socket RPC.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. RPC Envelopes & Error Types
// ---------------------------------------------------------------------------

export const RpcErrorCodeSchema = z.enum([
  'INVALID_PARAMS',
  'INVALID_JSON',
  'INVALID_REQUEST',
  'EXEC_FAILED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'SYSROOT_ERROR',
  'METHOD_NOT_FOUND',
  'TIMEOUT',
  'INTERNAL_ERROR',
  'DB_UNAVAILABLE',
]);

export type RpcErrorCode = z.infer<typeof RpcErrorCodeSchema>;

export const RpcErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type RpcError = z.infer<typeof RpcErrorSchema>;

export const RpcRequestSchema = z.object({
  id: z.string().min(1),
  operation: z.string().optional(),
  method: z.string().optional(),
  params: z.record(z.unknown()).default({}),
  callerUid: z.number().int().min(0).optional(),
}).refine((data) => data.operation !== undefined || data.method !== undefined, {
  message: "Either 'operation' or 'method' must be provided",
});

export type RpcRequest<T = Record<string, unknown>> = {
  id: string;
  operation?: string;
  method?: string;
  params: T;
  callerUid?: number;
};

export const RpcResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: RpcErrorSchema.optional(),
});

export type RpcResponse<T = unknown> = {
  id: string;
  success: boolean;
  data?: T;
  error?: RpcError;
};

export const RpcStreamMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['progress', 'chunk', 'end', 'error']),
  percent: z.number().min(0).max(100).optional(),
  step: z.string().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

export type RpcStreamMessage = z.infer<typeof RpcStreamMessageSchema>;

// ---------------------------------------------------------------------------
// 2. Shared Sub-Schemas
// ---------------------------------------------------------------------------

export const UsernameSchema = z
  .string()
  .min(3)
  .max(16)
  .regex(/^[a-z0-9_-]+$/, 'Username must contain only lowercase alphanumeric, underscore, or hyphen');

export const DomainNameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^(?:[a-zA-Z0-9_-]+\.)+[a-zA-Z]{2,}$/, 'Invalid domain format');

export const PhpVersionSchema = z.enum([
  '5.6',
  '7.0',
  '7.1',
  '7.2',
  '7.3',
  '7.4',
  '8.0',
  '8.1',
  '8.2',
  '8.3',
  '8.4',
  '8.5',
]);

export const DnsRecordTypeSchema = z.enum([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'SRV',
  'CAA',
  'NS',
  'SOA',
  'PTR',
]);

// ---------------------------------------------------------------------------
// 3. Handler 1: Tenant Management (Operations 1–5)
// ---------------------------------------------------------------------------

// Op 1: tenant.create
export const TenantCreateParamsSchema = z.object({
  username: UsernameSchema,
  uid: z.number().int().min(1000).optional(),
  homeDir: z.string().optional(),
  shell: z.string().default('/bin/bash'),
  plan: z
    .object({
      cpuQuota: z.string().default('200%'),
      memoryMax: z.string().default('2G'),
      tasksMax: z.number().int().default(150),
      diskQuotaBytes: z.number().int().positive().default(10737418240),
    })
    .default({}),
});
export type TenantCreateParams = z.input<typeof TenantCreateParamsSchema>;

export const TenantCreateResultSchema = z.object({
  uid: z.number().int(),
  gid: z.number().int(),
  homeDir: z.string(),
  sliceCreated: z.boolean(),
});
export type TenantCreateResult = z.infer<typeof TenantCreateResultSchema>;

// Op 2: tenant.updateLimits
export const TenantUpdateLimitsParamsSchema = z.object({
  username: UsernameSchema,
  plan: z.object({
    cpuQuota: z.string().optional(),
    memoryMax: z.string().optional(),
    tasksMax: z.number().int().positive().optional(),
    diskQuotaBytes: z.number().int().positive().optional(),
  }),
});
export type TenantUpdateLimitsParams = z.input<typeof TenantUpdateLimitsParamsSchema>;

export const TenantUpdateLimitsResultSchema = z.object({
  updated: z.boolean(),
});
export type TenantUpdateLimitsResult = z.infer<typeof TenantUpdateLimitsResultSchema>;

// Op 3: tenant.suspend
export const TenantSuspendParamsSchema = z.object({
  username: UsernameSchema,
  reason: z.string().optional(),
});
export type TenantSuspendParams = z.input<typeof TenantSuspendParamsSchema>;

export const TenantSuspendResultSchema = z.object({
  suspended: z.boolean(),
});
export type TenantSuspendResult = z.infer<typeof TenantSuspendResultSchema>;

// Op 4: tenant.resume
export const TenantResumeParamsSchema = z.object({
  username: UsernameSchema,
});
export type TenantResumeParams = z.input<typeof TenantResumeParamsSchema>;

export const TenantResumeResultSchema = z.object({
  suspended: z.boolean(),
});
export type TenantResumeResult = z.infer<typeof TenantResumeResultSchema>;

// Op 5: tenant.delete
export const TenantDeleteParamsSchema = z.object({
  username: UsernameSchema,
  purgeHome: z.boolean().default(false),
});
export type TenantDeleteParams = z.input<typeof TenantDeleteParamsSchema>;

export const TenantDeleteResultSchema = z.object({
  deleted: z.boolean(),
});
export type TenantDeleteResult = z.infer<typeof TenantDeleteResultSchema>;

// ---------------------------------------------------------------------------
// 4. Handler 2: Web & Multi-PHP (Operations 6–10)
// ---------------------------------------------------------------------------

// Op 6: web.upsertVhost
export const WebUpsertVhostParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  aliases: z.array(DomainNameSchema).default([]),
  documentRoot: z.string(),
  phpVersion: PhpVersionSchema,
  useApacheBackend: z.boolean().default(false),
  forceHttps: z.boolean().default(true),
  ssl: z
    .object({
      enabled: z.boolean(),
      certPath: z.string().optional(),
      keyPath: z.string().optional(),
    })
    .optional(),
  nginxDirectives: z.array(z.string()).optional(),
});
export type WebUpsertVhostParams = z.input<typeof WebUpsertVhostParamsSchema>;

export const WebUpsertVhostResultSchema = z.object({
  vhostPath: z.string(),
  enabledPath: z.string(),
  reloaded: z.boolean(),
});
export type WebUpsertVhostResult = z.infer<typeof WebUpsertVhostResultSchema>;

// Op 7: web.deleteVhost
export const WebDeleteVhostParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  phpVersion: PhpVersionSchema,
});
export type WebDeleteVhostParams = z.input<typeof WebDeleteVhostParamsSchema>;

export const WebDeleteVhostResultSchema = z.object({
  deleted: z.boolean(),
  reloaded: z.boolean(),
});
export type WebDeleteVhostResult = z.infer<typeof WebDeleteVhostResultSchema>;

// Op 8: web.setPhpVersion
export const WebSetPhpVersionParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  fromVersion: PhpVersionSchema,
  toVersion: PhpVersionSchema,
});
export type WebSetPhpVersionParams = z.input<typeof WebSetPhpVersionParamsSchema>;

export const WebSetPhpVersionResultSchema = z.object({
  newSocket: z.string(),
  reloaded: z.boolean(),
});
export type WebSetPhpVersionResult = z.infer<typeof WebSetPhpVersionResultSchema>;

// Op 9: web.updatePhpIni
export const WebUpdatePhpIniParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  phpVersion: PhpVersionSchema,
  directives: z.record(z.string()),
});
export type WebUpdatePhpIniParams = z.input<typeof WebUpdatePhpIniParamsSchema>;

export const WebUpdatePhpIniResultSchema = z.object({
  updated: z.boolean(),
  poolPath: z.string(),
  reloaded: z.boolean(),
});
export type WebUpdatePhpIniResult = z.infer<typeof WebUpdatePhpIniResultSchema>;

// Op 10: web.issueSsl
export const WebIssueSslParamsSchema = z.object({
  domain: DomainNameSchema,
  sanDomains: z.array(DomainNameSchema).default([]),
  email: z.string().email(),
  provider: z.enum(['letsencrypt', 'zerossl']).default('letsencrypt'),
  challengeType: z.enum(['http-01', 'dns-01']).default('http-01'),
});
export type WebIssueSslParams = z.input<typeof WebIssueSslParamsSchema>;

export const WebIssueSslResultSchema = z.object({
  certPath: z.string(),
  keyPath: z.string(),
  expiresAt: z.string(),
  sanDomains: z.array(z.string()),
});
export type WebIssueSslResult = z.infer<typeof WebIssueSslResultSchema>;

// ---------------------------------------------------------------------------
// 5. Handler 3: DNS & BIND9 (Operations 11–12)
// ---------------------------------------------------------------------------

export const DnsRecordItemSchema = z.object({
  name: z.string(),
  type: DnsRecordTypeSchema,
  value: z.string(),
  ttl: z.number().int().positive().optional(),
  priority: z.number().int().min(0).optional(),
});
export type DnsRecordItem = z.infer<typeof DnsRecordItemSchema>;

// Op 11: dns.upsertZone
export const DnsUpsertZoneParamsSchema = z.object({
  domain: DomainNameSchema,
  primaryNs: z.string().default('ns1.winwinhost.com.'),
  adminEmail: z.string().default('hostmaster.winwinhost.com.'),
  ttl: z.number().int().positive().default(300),
  records: z.array(DnsRecordItemSchema),
  syncCloudflare: z.boolean().default(false),
  cloudflareToken: z.string().optional(),
});
export type DnsUpsertZoneParams = z.input<typeof DnsUpsertZoneParamsSchema>;

export const DnsUpsertZoneResultSchema = z.object({
  zoneFile: z.string(),
  serial: z.number().int(),
  reloaded: z.boolean(),
});
export type DnsUpsertZoneResult = z.infer<typeof DnsUpsertZoneResultSchema>;

// Op 12: dns.deleteZone
export const DnsDeleteZoneParamsSchema = z.object({
  domain: DomainNameSchema,
});
export type DnsDeleteZoneParams = z.input<typeof DnsDeleteZoneParamsSchema>;

export const DnsDeleteZoneResultSchema = z.object({
  deleted: z.boolean(),
  reloaded: z.boolean(),
});
export type DnsDeleteZoneResult = z.infer<typeof DnsDeleteZoneResultSchema>;

// ---------------------------------------------------------------------------
// 6. Handler 4: Mail & Rspamd (Operations 13–17)
// ---------------------------------------------------------------------------

// Op 13: mail.upsertDomain
export const MailUpsertDomainParamsSchema = z.object({
  domain: DomainNameSchema,
  dkimSelector: z.string().default('default'),
  keyType: z.enum(['rsa2048', 'ed25519']).default('rsa2048'),
});
export type MailUpsertDomainParams = z.input<typeof MailUpsertDomainParamsSchema>;

export const MailUpsertDomainResultSchema = z.object({
  dkimKeyPath: z.string(),
  dkimSelector: z.string(),
  dkimDnsRecord: z.object({
    name: z.string(),
    type: z.literal('TXT'),
    value: z.string(),
  }),
});
export type MailUpsertDomainResult = z.infer<typeof MailUpsertDomainResultSchema>;

export const LocalPartSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, 'Invalid local-part characters or formatting')
  .refine((val) => !val.includes('..') && !val.includes('/') && !val.includes('\\'), {
    message: 'Path traversal characters forbidden in localPart',
  });

// Op 14: mail.upsertMailbox
export const MailUpsertMailboxParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  localPart: LocalPartSchema,
  passwordHash: z.string().min(10), // e.g. {ARGON2ID}$... or {SHA512-CRYPT}$...
  quotaBytes: z.number().int().min(0).default(1073741824), // 0 = unlimited quota, 1 GB default
});
export type MailUpsertMailboxParams = z.input<typeof MailUpsertMailboxParamsSchema>;

export const MailUpsertMailboxResultSchema = z.object({
  email: z.string(),
  maildirPath: z.string(),
  quotaBytes: z.number().int(),
});
export type MailUpsertMailboxResult = z.infer<typeof MailUpsertMailboxResultSchema>;

// Op 15: mail.deleteMailbox
export const MailDeleteMailboxParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  localPart: LocalPartSchema,
  purgeMaildir: z.boolean().default(false),
});
export type MailDeleteMailboxParams = z.input<typeof MailDeleteMailboxParamsSchema>;

export const MailDeleteMailboxResultSchema = z.object({
  deleted: z.boolean(),
});
export type MailDeleteMailboxResult = z.infer<typeof MailDeleteMailboxResultSchema>;

// Op 16: mail.upsertForwarder
export const MailUpsertForwarderParamsSchema = z.object({
  domain: DomainNameSchema,
  source: z.string(), // 'info@domain.com' or '@domain.com'
  destinations: z.array(z.string().email()).nonempty(),
});
export type MailUpsertForwarderParams = z.input<typeof MailUpsertForwarderParamsSchema>;

export const MailUpsertForwarderResultSchema = z.object({
  updated: z.boolean(),
  mapEntriesCount: z.number().int(),
});
export type MailUpsertForwarderResult = z.infer<typeof MailUpsertForwarderResultSchema>;

// Op 17: mail.upsertSieve
export const MailUpsertSieveParamsSchema = z.object({
  username: UsernameSchema,
  domain: DomainNameSchema,
  localPart: LocalPartSchema,
  sieveScript: z.string(),
});
export type MailUpsertSieveParams = z.input<typeof MailUpsertSieveParamsSchema>;

export const MailUpsertSieveResultSchema = z.object({
  compiled: z.boolean(),
  sievePath: z.string(),
});
export type MailUpsertSieveResult = z.infer<typeof MailUpsertSieveResultSchema>;

// ---------------------------------------------------------------------------
// 7. Handler 5: MySQL & phpMyAdmin (Operations 18–21)
// ---------------------------------------------------------------------------

// Op 18: mysql.createDatabase
export const MysqlCreateDatabaseParamsSchema = z.object({
  username: UsernameSchema,
  databaseName: z.string().regex(/^[a-z0-9_]{1,32}$/i),
  charset: z.string().default('utf8mb4'),
  collation: z.string().default('utf8mb4_unicode_ci'),
});
export type MysqlCreateDatabaseParams = z.input<typeof MysqlCreateDatabaseParamsSchema>;

export const MysqlCreateDatabaseResultSchema = z.object({
  fullDatabaseName: z.string(),
  created: z.boolean(),
});
export type MysqlCreateDatabaseResult = z.infer<typeof MysqlCreateDatabaseResultSchema>;

// Op 19: mysql.dropDatabase
export const MysqlDropDatabaseParamsSchema = z.object({
  username: UsernameSchema,
  fullDatabaseName: z.string(),
});
export type MysqlDropDatabaseParams = z.input<typeof MysqlDropDatabaseParamsSchema>;

export const MysqlDropDatabaseResultSchema = z.object({
  dropped: z.boolean(),
});
export type MysqlDropDatabaseResult = z.infer<typeof MysqlDropDatabaseResultSchema>;

// Op 20: mysql.upsertUserGrant
export const MysqlUpsertUserGrantParamsSchema = z.object({
  username: UsernameSchema,
  dbUserSuffix: z.string().regex(/^[a-z0-9_]{1,16}$/i),
  password: z.string().min(8),
  host: z.string().default('localhost'),
  databaseName: z.string(),
  privileges: z.array(z.string()).default(['ALL PRIVILEGES']),
});
export type MysqlUpsertUserGrantParams = z.input<typeof MysqlUpsertUserGrantParamsSchema>;

export const MysqlUpsertUserGrantResultSchema = z.object({
  fullDbUser: z.string(),
  host: z.string(),
  granted: z.boolean(),
});
export type MysqlUpsertUserGrantResult = z.infer<typeof MysqlUpsertUserGrantResultSchema>;

// Op 21: mysql.createSignonSession
export const MysqlCreateSignonSessionParamsSchema = z.object({
  username: UsernameSchema,
  databaseUser: z.string(),
  databasePassword: z.string().optional(),
  targetDatabase: z.string().optional(),
});
export type MysqlCreateSignonSessionParams = z.input<typeof MysqlCreateSignonSessionParamsSchema>;

export const MysqlCreateSignonSessionResultSchema = z.object({
  signonToken: z.string(),
  redirectUrl: z.string(),
  expiresAt: z.string(),
});
export type MysqlCreateSignonSessionResult = z.infer<typeof MysqlCreateSignonSessionResultSchema>;

// ---------------------------------------------------------------------------
// 8. Handler 6: File Manager (Operation 22)
// ---------------------------------------------------------------------------

export const FileActionSchema = z.enum([
  'list',
  'read',
  'write',
  'mkdir',
  'delete',
  'rename',
  'chmod',
  'archive',
  'extract',
]);
export type FileAction = z.infer<typeof FileActionSchema>;

// Op 22: files.operation
export const FilesOperationParamsSchema = z.object({
  username: UsernameSchema,
  action: FileActionSchema,
  path: z.string(),
  targetPath: z.string().optional(),
  content: z.string().optional(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
  mode: z.number().int().optional(),
  archiveFormat: z.enum(['tar.gz', 'zip']).optional(),
});
export type FilesOperationParams = z.input<typeof FilesOperationParamsSchema>;

export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDir: z.boolean(),
  isSymlink: z.boolean(),
  sizeBytes: z.number(),
  mode: z.number(),
  owner: z.string(),
  group: z.string(),
  mtime: z.string(),
  mimeType: z.string().optional(),
});
export type RpcFileEntry = z.infer<typeof FileEntrySchema>;

export const FilesOperationResultSchema = z.object({
  action: FileActionSchema,
  success: z.boolean(),
  entries: z.array(FileEntrySchema).optional(),
  content: z.string().optional(),
  bytesWritten: z.number().int().optional(),
  bytesRead: z.number().int().optional(),
  targetPath: z.string().optional(),
});
export type FilesOperationResult = z.infer<typeof FilesOperationResultSchema>;

// ---------------------------------------------------------------------------
// 9. Handler 7: WordPress & WP-CLI Toolkit (Operation 23)
// ---------------------------------------------------------------------------

export const WpToolkitActionSchema = z.enum([
  'install',
  'clone',
  'autoUpdate',
  'createLogin',
  'status',
]);
export type WpToolkitAction = z.infer<typeof WpToolkitActionSchema>;

// Op 23: wp.toolkit
export const WpToolkitParamsSchema = z.object({
  username: UsernameSchema,
  action: WpToolkitActionSchema,
  domain: DomainNameSchema,
  path: z.string(),
  dbName: z.string().optional(),
  dbUser: z.string().optional(),
  dbPass: z.string().optional(),
  title: z.string().optional(),
  adminUser: z.string().optional(),
  adminEmail: z.string().email().optional(),
  targetPath: z.string().optional(),
});
export type WpToolkitParams = z.input<typeof WpToolkitParamsSchema>;

export const WpToolkitResultSchema = z.object({
  success: z.boolean(),
  action: WpToolkitActionSchema,
  version: z.string().optional(),
  loginUrl: z.string().optional(),
  message: z.string().optional(),
});
export type WpToolkitResult = z.infer<typeof WpToolkitResultSchema>;

// ---------------------------------------------------------------------------
// 10. Handler 8: Backups, cpmove & Restic (Operation 24)
// ---------------------------------------------------------------------------

export const BackupModeSchema = z.enum([
  'cpmove_import',
  'cpmove_export',
  'restic_backup',
  'restic_restore',
  'restic_list',
]);
export type BackupMode = z.infer<typeof BackupModeSchema>;

// Op 24: backup.cpmoveAndRestic
export const BackupCpmoveAndResticParamsSchema = z.object({
  username: UsernameSchema,
  mode: BackupModeSchema,
  archivePath: z.string().optional(),
  snapshotId: z.string().optional(),
  resticTarget: z.string().optional(),
});
export type BackupCpmoveAndResticParams = z.input<typeof BackupCpmoveAndResticParamsSchema>;

export const BackupCpmoveAndResticResultSchema = z.object({
  success: z.boolean(),
  mode: BackupModeSchema,
  archivePath: z.string().optional(),
  snapshotId: z.string().optional(),
  snapshots: z.array(z.record(z.unknown())).optional(),
  summary: z.string().optional(),
});
export type BackupCpmoveAndResticResult = z.infer<typeof BackupCpmoveAndResticResultSchema>;

// ---------------------------------------------------------------------------
// 11. RPC Method Registry & Operation Map
// ---------------------------------------------------------------------------

export const RPC_OPERATIONS = {
  // Tenant
  'tenant.create': {
    params: TenantCreateParamsSchema,
    result: TenantCreateResultSchema,
  },
  'tenant.updateLimits': {
    params: TenantUpdateLimitsParamsSchema,
    result: TenantUpdateLimitsResultSchema,
  },
  'tenant.suspend': {
    params: TenantSuspendParamsSchema,
    result: TenantSuspendResultSchema,
  },
  'tenant.resume': {
    params: TenantResumeParamsSchema,
    result: TenantResumeResultSchema,
  },
  'tenant.delete': {
    params: TenantDeleteParamsSchema,
    result: TenantDeleteResultSchema,
  },

  // Web & PHP
  'web.upsertVhost': {
    params: WebUpsertVhostParamsSchema,
    result: WebUpsertVhostResultSchema,
  },
  'web.deleteVhost': {
    params: WebDeleteVhostParamsSchema,
    result: WebDeleteVhostResultSchema,
  },
  'web.setPhpVersion': {
    params: WebSetPhpVersionParamsSchema,
    result: WebSetPhpVersionResultSchema,
  },
  'web.updatePhpIni': {
    params: WebUpdatePhpIniParamsSchema,
    result: WebUpdatePhpIniResultSchema,
  },
  'web.issueSsl': {
    params: WebIssueSslParamsSchema,
    result: WebIssueSslResultSchema,
  },

  // DNS
  'dns.upsertZone': {
    params: DnsUpsertZoneParamsSchema,
    result: DnsUpsertZoneResultSchema,
  },
  'dns.deleteZone': {
    params: DnsDeleteZoneParamsSchema,
    result: DnsDeleteZoneResultSchema,
  },

  // Mail
  'mail.upsertDomain': {
    params: MailUpsertDomainParamsSchema,
    result: MailUpsertDomainResultSchema,
  },
  'mail.upsertMailbox': {
    params: MailUpsertMailboxParamsSchema,
    result: MailUpsertMailboxResultSchema,
  },
  'mail.deleteMailbox': {
    params: MailDeleteMailboxParamsSchema,
    result: MailDeleteMailboxResultSchema,
  },
  'mail.upsertForwarder': {
    params: MailUpsertForwarderParamsSchema,
    result: MailUpsertForwarderResultSchema,
  },
  'mail.upsertSieve': {
    params: MailUpsertSieveParamsSchema,
    result: MailUpsertSieveResultSchema,
  },

  // MySQL
  'mysql.createDatabase': {
    params: MysqlCreateDatabaseParamsSchema,
    result: MysqlCreateDatabaseResultSchema,
  },
  'mysql.dropDatabase': {
    params: MysqlDropDatabaseParamsSchema,
    result: MysqlDropDatabaseResultSchema,
  },
  'mysql.upsertUserGrant': {
    params: MysqlUpsertUserGrantParamsSchema,
    result: MysqlUpsertUserGrantResultSchema,
  },
  'mysql.createSignonSession': {
    params: MysqlCreateSignonSessionParamsSchema,
    result: MysqlCreateSignonSessionResultSchema,
  },

  // Files
  'files.operation': {
    params: FilesOperationParamsSchema,
    result: FilesOperationResultSchema,
  },

  // WP Toolkit
  'wp.toolkit': {
    params: WpToolkitParamsSchema,
    result: WpToolkitResultSchema,
  },

  // Backup & Restic
  'backup.cpmoveAndRestic': {
    params: BackupCpmoveAndResticParamsSchema,
    result: BackupCpmoveAndResticResultSchema,
  },
} as const;

export type RpcOperationName = keyof typeof RPC_OPERATIONS;
