import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client.ts';
import type { UserEntity } from '../types/api.ts';

export interface AuthContextType {
  user: UserEntity | null;
  effectiveUser: UserEntity | null;
  isImpersonating: boolean;
  impersonator: UserEntity | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; twoFactorCode?: string }) => Promise<any>;
  logout: () => Promise<void>;
  startImpersonation: (username: string) => Promise<void>;
  revertImpersonation: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserEntity | null>(null);
  const [effectiveUser, setEffectiveUser] = useState<UserEntity | null>(null);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [impersonator, setImpersonator] = useState<UserEntity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setEffectiveUser(null);
      setIsImpersonating(false);
      setImpersonator(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.auth.me();
      if (data && data.user) {
        setUser(data.user);
        setEffectiveUser(data.effectiveUser || data.user);
        setIsImpersonating(Boolean(data.isImpersonating));
        setImpersonator(data.impersonator || null);
      } else {
        throw new Error('Invalid user payload');
      }
    } catch {
      api.setToken(null);
      api.setImpersonateUser(null);
      setUser(null);
      setEffectiveUser(null);
      setIsImpersonating(false);
      setImpersonator(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (credentials: { username: string; password: string; twoFactorCode?: string }) => {
    const res = await api.auth.login(credentials);
    if (res.success && res.accessToken) {
      api.setToken(res.accessToken);
      if (res.refreshToken) {
        api.setRefreshToken(res.refreshToken);
      }
      api.setImpersonateUser(null);
      await refreshSession();
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    api.setToken(null);
    api.setRefreshToken(null);
    api.setImpersonateUser(null);
    setUser(null);
    setEffectiveUser(null);
    setIsImpersonating(false);
    setImpersonator(null);
    if (typeof window !== 'undefined') {
      const base = String((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '');
      window.location.href = `${base}/login`;
    }
  };

  const startImpersonation = async (targetUsername: string) => {
    api.setImpersonateUser(targetUsername);
    await refreshSession();
  };

  const revertImpersonation = async () => {
    api.setImpersonateUser(null);
    try {
      await api.preferences.exitImpersonate();
    } catch {}
    await refreshSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        effectiveUser,
        isImpersonating,
        impersonator,
        isLoading,
        login,
        logout,
        startImpersonation,
        revertImpersonation,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
