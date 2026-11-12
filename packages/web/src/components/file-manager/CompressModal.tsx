import React, { useState } from 'react';
import { X } from 'lucide-react';

export const CompressModal: React.FC<{
  selectedPaths: string[];
  currentPath: string;
  onClose: () => void;
  onConfirm: (targetName: string, format: 'zip' | 'tar.gz') => Promise<void>;
}> = ({ selectedPaths: _sp, currentPath, onClose, onConfirm }) => {
  const [format, setFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [filename, setFilename] = useState(`archive-${Date.now()}`);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;
    setIsCompressing(true);
    try {
      const fullTarget = currentPath
        ? `${currentPath}/${filename}.${format}`
        : `${filename}.${format}`;
      await onConfirm(fullTarget, format);
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1B1E2B] border border-white/10 rounded-xl p-6 text-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">Compress Files</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Archive Format:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="fmt"
                  checked={format === 'zip'}
                  onChange={() => setFormat('zip')}
                  className="accent-cyan-500"
                />
                <span>.zip (Standard)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="fmt"
                  checked={format === 'tar.gz'}
                  onChange={() => setFormat('tar.gz')}
                  className="accent-cyan-500"
                />
                <span>.tar.gz (Linux)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Archive Filename:</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded bg-[#141721] border border-white/10 text-white outline-none"
              />
              <span className="text-slate-500 font-mono">.{format}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 bg-white/5 rounded text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCompressing}
              className="px-3 py-1.5 font-semibold bg-cyan-500 text-slate-950 rounded disabled:opacity-40"
            >
              {isCompressing ? 'Compressing...' : 'Compress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
