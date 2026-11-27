import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { CPANEL_CATEGORIES, ALL_TOOLS, type ToolItem } from '../data/tools.ts';
import type { AppLayoutContext } from '../components/layout/AppLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useOutletContext<AppLayoutContext>();
  const { isImpersonating, startImpersonation, revertImpersonation } = useAuth();
  const searchQuery = context?.searchQuery || '';
  const isDemoMode = (import.meta as any).env?.VITE_DEMO_MODE === 'true';

  const renderIcon = (name: string, className = 'w-5 h-5') => {
    const IconComponent = (Icons as any)[name] || Icons.HelpCircle;
    return <IconComponent className={className} />;
  };

  const filteredTools = ALL_TOOLS.filter((tool) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.code.toLowerCase().includes(q) ||
      tool.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {isDemoMode && (
        <div className="bg-gradient-to-r from-indigo-950/80 via-[#1E2230] to-amber-950/40 border border-amber-500/40 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono font-bold uppercase tracking-wider">
              Live Interactive Sandbox
            </span>
            <p className="text-xs sm:text-sm text-slate-200">
              Explore all <strong>77 CleanPanel tools</strong> right in your browser — edit PHP/<code>.htaccess</code> in Monaco, run commands in <code>xterm.js</code>, or test 1-click tenant impersonation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isImpersonating ? (
              <button
                type="button"
                onClick={() => revertImpersonation()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
              >
                Exit Impersonation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startImpersonation('acme')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
              >
                Impersonate acme
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/files')}
              className="px-3 py-1.5 rounded-lg bg-[#232736] hover:bg-[#2A2F42] border border-[#343B52] text-slate-100 text-xs font-semibold transition"
            >
              Monaco File Editor
            </button>
            <button
              type="button"
              onClick={() => navigate('/terminal')}
              className="px-3 py-1.5 rounded-lg bg-[#232736] hover:bg-[#2A2F42] border border-[#343B52] text-cyan-300 text-xs font-semibold transition"
            >
              xterm.js Shell
            </button>
            <a
              href="https://github.com/rbaindourov/cpanel-clean-room"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              GitHub (MIT) ↗
            </a>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#232736] to-[#1E2230] border border-[#343B52] rounded-xl p-6 shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">cPanel Tools Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Modernized clean-room appliance with full HostGator parity. Press{' '}
            <kbd className="bg-[#1B1E2B] px-1.5 py-0.5 rounded text-xs font-mono border border-[#343B52] text-amber-400">
              /
            </kbd>{' '}
            anywhere to filter all tools instantly.
          </p>
        </div>
        <div className="hidden lg:flex items-center space-x-3">
          <button
            onClick={() => navigate('/files')}
            className="bg-[#2A2F42] hover:bg-[#343B52] border border-[#343B52] text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold shadow transition-colors flex items-center space-x-2"
          >
            <Icons.Folder className="w-4 h-4 text-amber-400" />
            <span>File Manager</span>
          </button>
          <button
            onClick={() => (isDemoMode ? navigate('/databases') : window.open('/api/v1/databases/pma/sso', '_blank'))}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold shadow transition-colors flex items-center space-x-2"
          >
            <Icons.Database className="w-4 h-4 text-slate-950" />
            <span>phpMyAdmin SSO</span>
          </button>
        </div>
      </div>

      {searchQuery && (
        <div className="text-sm text-slate-400 flex items-center space-x-2">
          <span>
            Filtering: <strong className="text-amber-400 font-mono">"{searchQuery}"</strong>
          </span>
          <span className="text-slate-500">— Showing {filteredTools.length} matching tools</span>
        </div>
      )}

      {/* 9 Category Panels Grid */}
      <div className="space-y-6">
        {CPANEL_CATEGORIES.map((cat) => {
          const catTools = filteredTools.filter((t) => t.category === cat.id);
          if (catTools.length === 0) return null;

          return (
            <div key={cat.id} className="bg-[#232736] border border-[#343B52] rounded-xl overflow-hidden shadow-sm">
              {/* Category Header */}
              <div className="px-5 py-3.5 bg-[#1E2230] border-b border-[#343B52] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="text-amber-400">{renderIcon(cat.iconName, 'w-5 h-5')}</span>
                  <h2 className="text-base font-bold text-white">{cat.title}</h2>
                  <span className="text-xs text-slate-400 hidden sm:inline">— {cat.description}</span>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-[#1B1E2B] px-2 py-0.5 rounded border border-[#343B52]">
                  {catTools.length} tools
                </span>
              </div>

              {/* Tools Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {catTools.map((tool: ToolItem) => (
                  <div
                    key={tool.code}
                    onClick={() => navigate(tool.path)}
                    className="p-3 bg-[#1B1E2B] hover:bg-[#2A2F42] border border-[#343B52] hover:border-amber-500/50 rounded-lg cursor-pointer transition-all duration-150 flex items-start space-x-3 group"
                  >
                    <div className="p-2 rounded bg-[#232736] border border-[#343B52] text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/30 shrink-0">
                      {renderIcon(tool.iconName, 'w-5 h-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-200 group-hover:text-amber-400 truncate flex items-center justify-between">
                        <span className="truncate">{tool.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 ml-1 shrink-0">{tool.code}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
