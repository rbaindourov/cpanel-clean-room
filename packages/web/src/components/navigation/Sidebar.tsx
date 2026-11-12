import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Folder,
  Database,
  Globe,
  Mail,
  Activity,
  ShieldCheck,
  Cpu,
  Terminal,
  Settings,
  Archive,
  Users,
  Package,
  Server,
  Gauge,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const { user, effectiveUser } = useAuth();
  const activeRole = effectiveUser?.role || user?.role;
  const isAdminOrReseller = activeRole === 'admin' || activeRole === 'reseller';
  const [whmOpen, setWhmOpen] = useState(true);

  const cpanelNav = [
    { name: 'Dashboard', path: '/', icon: Gauge, count: 68 },
    { name: 'Files', path: '/files', icon: Folder, count: 11 },
    { name: 'Databases', path: '/databases', icon: Database, count: 6 },
    { name: 'Domains & DNS', path: '/domains', icon: Globe, count: 9 },
    { name: 'Email Suite', path: '/email', icon: Mail, count: 16 },
    { name: 'MultiPHP & Apps', path: '/software', icon: Cpu, count: 8 },
    { name: 'Terminal Shell', path: '/terminal', icon: Terminal, count: 1 },
    { name: 'Backups & Restic', path: '/backup', icon: Archive, count: 2 },
  ];

  const whmNav = [
    { name: 'Account Manager', path: '/admin/accounts', icon: Users },
  ];

  return (
    <aside
      className={`bg-[#1B1E2B] border-r border-[#343B52] h-[calc(100vh-4rem)] flex flex-col shrink-0 transition-all duration-200 sticky top-16 select-none overflow-y-auto ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Category Section Header */}
      <div className="p-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
        cPanel Navigation
      </div>

      <nav className="space-y-0.5 px-2 flex-1">
        {cpanelNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-semibold'
                  : 'text-slate-300 hover:bg-[#232736] hover:text-white'
              }`
            }
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-amber-400" />
              {!collapsed && <span>{item.name}</span>}
            </div>
            {!collapsed && item.count && (
              <span className="text-[10px] font-mono bg-[#232736] px-1.5 py-0.5 rounded text-slate-400">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}

        {/* Admin WHM Section */}
        {isAdminOrReseller && (
          <div className="pt-4 mt-4 border-t border-[#343B52]">
            <div
              onClick={() => setWhmOpen(!whmOpen)}
              className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold tracking-wider text-amber-400 uppercase cursor-pointer hover:text-amber-300"
            >
              <span>WHM Administration</span>
              {whmOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>

            {whmOpen && (
              <div className="space-y-0.5 mt-1">
                {whmNav.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500 font-semibold'
                          : 'text-slate-300 hover:bg-[#232736] hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0 text-amber-500/70" />
                    {!collapsed && <span>{item.name}</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-[#343B52] text-xs text-slate-500 flex items-center justify-between">
        <span>Appliance v1.0.0</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Daemon Connected"></span>
      </div>
    </aside>
  );
};
