import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export const DeleteModal: React.FC<{
  count: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}> = ({ count, onClose, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1B1E2B] border border-red-500/20 rounded-xl p-6 text-slate-200">
        <div className="flex items-center gap-3 mb-3 text-red-400">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-sm font-semibold">Permanently Delete</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Are you sure you want to permanently delete <strong className="text-white">{count}</strong> selected item(s)? This action cannot be reversed.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-white/5 rounded text-slate-300">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-400 text-white rounded disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};
