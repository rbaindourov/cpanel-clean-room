import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { FileEntry } from '../../types/files.ts';

export const RenameModal: React.FC<{
  entry: FileEntry;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
}> = ({ entry, onClose, onConfirm }) => {
  const [name, setName] = useState(entry.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === entry.name) return;
    setIsSubmitting(true);
    try {
      await onConfirm(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1B1E2B] border border-white/10 rounded-xl p-6 text-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">Rename</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">New Name:</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded bg-[#141721] border border-white/10 focus:border-cyan-500 text-white outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs bg-white/5 rounded text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name === entry.name || isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold bg-cyan-500 text-slate-950 rounded disabled:opacity-40"
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
