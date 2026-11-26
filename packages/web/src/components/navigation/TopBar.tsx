import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Terminal, LogOut, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ALL_TOOLS, type ToolItem } from '../../data/tools.ts';

interface TopBarProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearchChange, searchQuery }) => {
  const { effectiveUser, logout } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResults, setModalResults] = useState<ToolItem[]>([]);

  // Hotkey listener: pressing "/" focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setModalResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = ALL_TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.code.toLowerCase().includes(q) ||
        tool.keywords.some((k) => k.toLowerCase().includes(q))
    );
    setModalResults(matches);
  }, [searchQuery]);

  const handleSelectTool = (path: string) => {
    setIsModalOpen(false);
    onSearchChange('');
    navigate(path);
  };

  return (
    <header className="h-16 bg-[#1B1E2B] border-b border-[#343B52] px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Instant Search */}
      <div className="flex items-center space-x-6 flex-1 max-w-2xl">
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-base shadow">
            C
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm tracking-wide text-white leading-none">CleanPanel</div>
            <div className="text-[10px] text-slate-400 leading-tight">Control Panel</div>
          </div>
        </div>

        {/* Global Search Bar with "/" hint */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (e.target.value.trim()) setIsModalOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsModalOpen(true);
            }}
            placeholder="Search all cPanel tools, databases, domains..."
            className="w-full bg-[#232736] border border-[#343B52] rounded-lg pl-9 pr-12 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#1B1E2B] border border-[#343B52] rounded px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
            /
          </div>

          {/* Autocomplete Dropdown Modal */}
          {isModalOpen && modalResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#232736] border border-[#343B52] rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-[#343B52] flex justify-between items-center">
                <span>FOUND {modalResults.length} TOOLS</span>
                <button onClick={() => setIsModalOpen(false)} className="hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-1">
                {modalResults.map((tool) => (
                  <div
                    key={tool.code}
                    onClick={() => handleSelectTool(tool.path)}
                    className="p-2.5 hover:bg-[#2A2F42] rounded-md cursor-pointer transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-200 group-hover:text-amber-400 flex items-center space-x-2">
                        <span>{tool.name}</span>
                        <span className="text-[10px] font-mono bg-[#1B1E2B] px-1.5 py-0.5 rounded text-slate-400">
                          {tool.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{tool.description}</div>
                    </div>
                    <span className="text-xs text-slate-500 uppercase font-mono">{tool.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Actions & Quick Launcher */}
      <div className="flex items-center space-x-3 ml-4">
        <button
          onClick={() => navigate('/terminal')}
          className="p-2 rounded-lg bg-[#232736] hover:bg-[#2A2F42] border border-[#343B52] text-slate-300 hover:text-white transition-colors"
          title="Terminal (ADV-01)"
        >
          <Terminal className="w-4 h-4" />
        </button>

        {/* User Pill */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-[#343B52]">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-[#343B52] flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-slate-200 leading-none">{effectiveUser?.username || 'Guest'}</div>
            <div className="text-[10px] text-amber-400 font-mono capitalize leading-tight mt-0.5">
              {effectiveUser?.role || 'user'}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded hover:bg-[#2A2F42] text-slate-400 hover:text-red-400 transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
