import type { UserRole } from '@cpanel-clean-room/shared';

export interface UserEntity {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  resellerId?: string | null;
  status?: string;
  quotaBytes?: number;
  uid?: number;
  gid?: number;
  homeDir?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: UserEntity;
  effectiveUser: UserEntity;
  isImpersonating: boolean;
  impersonator?: UserEntity | null;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  status: number;
  requestId?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  requires2FA?: boolean;
  [key: string]: any;
}

export interface TelemetryData {
  loadAverage: [number, number, number];
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  uptimeSeconds: number;
  primaryDomain?: string;
  phpVersion?: string;
  primaryIp?: string;
  sharedIp?: string;
  mysqlDatabasesCount?: number;
  mysqlDatabasesMax?: number;
}

export interface AccountRecord {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  reseller_id?: string | null;
  quota_bytes: number;
  bandwidth_limit_bytes: number;
  plan_name: string;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at?: string;
}
