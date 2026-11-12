import type { UserRole } from '@cpanel-clean-room/shared';
import type { UserEntity } from '../auth/rbac.ts';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user: UserEntity;
      effectiveUser: UserEntity;
      isImpersonating: boolean;
      impersonator?: UserEntity;
      apiTokenScopes?: string[];
      cookies?: Record<string, string>;
    }
  }
}

export {};
