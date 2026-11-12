import React from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, effectiveUser, impersonator, revertImpersonation } = useAuth();

  if (!isImpersonating || !effectiveUser) return null;

  return (
    <div className="bg-amber-500 text-slate-950 font-medium px-4 py-2 sticky top-0 z-50 shadow-md flex items-center justify-between text-sm transition-all duration-200">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0 animate-pulse" />
        <span>
          <strong>Impersonation Session Active:</strong> Managing account as{' '}
          <span className="font-bold underline">{effectiveUser.username}</span> ({effectiveUser.role})
          {impersonator && <span className="text-slate-800 ml-1.5 font-normal">(Initiated by {impersonator.username})</span>}
        </span>
      </div>
      <button
        onClick={revertImpersonation}
        className="flex items-center space-x-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 hover:text-amber-300 px-3 py-1 rounded text-xs font-semibold shadow transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Revert to Admin</span>
      </button>
    </div>
  );
};
