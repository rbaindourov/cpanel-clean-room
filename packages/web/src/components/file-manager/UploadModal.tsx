import React, { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { formatFileSize } from '../../utils/permissions.ts';

interface UploadModalProps {
  currentPath: string;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
}

export const UploadModal: React.FC<UploadModalProps> = ({ currentPath, onClose, onUpload }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await onUpload(selectedFiles);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#1B1E2B] border border-white/10 rounded-xl shadow-2xl p-6 text-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">Upload Files</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4 truncate font-mono">
          Target: <span className="text-cyan-400">/{currentPath || 'home'}</span>
        </p>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-[#141721] cursor-pointer transition"
          onClick={() => document.getElementById('file-picker-input')?.click()}
        >
          <Upload className="w-8 h-8 text-cyan-400 animate-bounce" />
          <span className="text-xs text-slate-300 font-medium">Drag & drop files here, or browse</span>
          <input
            id="file-picker-input"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* File preview list */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 max-h-36 overflow-y-auto space-y-1">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-white/5">
                <span className="truncate max-w-[280px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> {f.name}
                </span>
                <span className="font-mono text-slate-500">{formatFileSize(f.size)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-5">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs bg-white/5 hover:bg-white/10 text-slate-300">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="px-4 py-2 rounded text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40"
          >
            {isUploading ? 'Uploading...' : `Upload (${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
