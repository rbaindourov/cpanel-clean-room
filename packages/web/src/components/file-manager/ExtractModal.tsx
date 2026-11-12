import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { FileEntry } from '../../types/files.ts';

export const ExtractModal: React.FC<{
  entry: FileEntry;
  currentPath: string;
  onClose: () => void;
  onConfirm: (destination: string) => Promise<void>;
}> = ({ entry, currentPath, onClose, onConfirm }) => {
  const [dest, setDest] = useState(currentPath);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExtracting(true);
    try {
      await onConfirm(dest);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1B1E2B] border border-white/10 rounded-xl p-6 text-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">Extract Archive</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <p className="text-slate-400 truncate">
            Extracting: <span className="text-cyan-400 font-mono">{entry.name}</span>
          </p>
          <div>
            <label className="text-slate-400 block mb-1">Destination Directory:</label>
            <input
              type="text"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="e.g. public_html/extracted"
              className="w-full px-3 py-1.5 rounded bg-[#141721] border border-white/10 text-white outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-white/5 rounded text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExtracting}
              className="px-3 py-1.5 font-semibold bg-pink-500 text-white rounded disabled:opacity-40"
            >
              {isExtracting ? 'Extracting...' : 'Extract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
