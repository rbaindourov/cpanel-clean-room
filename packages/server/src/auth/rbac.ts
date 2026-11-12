/**
 * rbac.ts
 * 3-Tier RBAC middleware and 1-Click User Impersonation policy engine.
 */

import type { UserRole } from '@cpanel-clean-room/shared';

export interface UserEntity {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  resellerId?: string | null;
  status: 'active' | 'suspended' | 'pending';
  quotaBytes: number;
  uid?: number;
  gid?: number;
  homeDir?: string;
  shell?: string;
}

export interface SecurityContext {
  user: UserEntity;                 // Authenticated caller (real operator)
  effectiveUser: UserEntity;        // Active tenant (impersonated or self)
  isImpersonating: boolean;
  impersonator?: UserEntity;        // Real operator if isImpersonating is true
}

export class RbacPolicyEngine {
  /**
   * Asserts whether the caller can impersonate the target user.
   */
  public canImpersonate(caller: UserEntity, target: UserEntity): { allowed: boolean; reason?: string } {
    // 1. Customers cannot impersonate anyone
    if (caller.role === 'customer') {
      return { allowed: false, reason: 'Customers are strictly forbidden from impersonating users' };
    }

    // 2. Self impersonation is a no-op
    if (caller.id === target.id) {
      return { allowed: true };
    }

    // 3. Admin can impersonate any reseller or customer, but not peer admin
    if (caller.role === 'admin') {
      if (target.role === 'admin') {
        return { allowed: false, reason: 'Admins cannot impersonate peer administrators' };
      }
      return { allowed: true };
    }

    // 4. Reseller can only impersonate customers they own
    if (caller.role === 'reseller') {
      if (target.role !== 'customer') {
        return { allowed: false, reason: 'Resellers can only impersonate customer accounts' };
      }
      if (target.resellerId !== caller.id) {
        return { allowed: false, reason: 'Reseller does not own this customer account' };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'Unauthorized impersonation request' };
  }

  /**
   * Checks whether the effective user is authorized to access or modify a resource owned by resourceOwnerUserId.
   */
  public canAccessResource(context: SecurityContext, resourceOwnerUserId: string): boolean {
    // If not impersonating and caller is admin, global access allowed
    if (!context.isImpersonating && context.user.role === 'admin') {
      return true;
    }

    // If effective user is the owner, access allowed
    if (context.effectiveUser.id === resourceOwnerUserId) {
      return true;
    }

    // If caller is reseller operating on owned customer
    if (!context.isImpersonating && context.user.role === 'reseller') {
      // In practice checked against DB resellerId
      return false;
    }

    return false;
  }
}
