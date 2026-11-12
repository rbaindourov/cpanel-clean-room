import React, { useState } from 'react';
import type { FileEntry } from '../../types/files.ts';
import {
  modeToBreakdown,
  breakdownToMode,
  modeToOctalString,
  parseOctalString,
} from '../../utils/permissions.ts';

interface ChmodModalProps {
  entry: FileEntry;
  onClose: () => void;
  onConfirm: (mode: number) => Promise<void>;
}

export const ChmodModal: React.FC<ChmodModalProps> = ({ entry, onClose, onConfirm }) => {
  const [breakdown, setBreakdown] = useState(modeToBreakdown(entry.mode));
  const [octalStr, setOctalStr] = useState(modeToOctalString(entry.mode));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckboxChange = (
    category: 'user' | 'group' | 'others',
    perm: 'r' | 'w' | 'x'
  ) => {
    const updated = {
      ...breakdown,
      [category]: {
        ...breakdown[category],
        [perm]: !breakdown[category][perm],
      },
    };
    setBreakdown(updated);
    setOctalStr(modeToOctalString(breakdownToMode(updated)));
  };

  const handleOctalInputChange = (val: string) => {
    setOctalStr(val);
    const parsed = parseOctalString(val);
    setBreakdown(modeToBreakdown(parsed));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const mode = breakdownToMode(breakdown);
      await onConfirm(mode);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1B1E2B] border border-white/10 rounded-xl shadow-2xl p-6 text-slate-200">
        <h3 className="text-base font-semibold text-white mb-2">Change Permissions</h3>
        <p className="text-xs text-slate-400 mb-4 truncate font-mono">
          File: <span className="text-cyan-400">{entry.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <table className="w-full text-center text-xs border border-white/10 rounded overflow-hidden">
            <thead className="bg-[#141721] text-slate-400">
              <tr>
                <th className="py-2 px-3 text-left">Entity</th>
                <th className="py-2 px-3">Read (4)</th>
                <th className="py-2 px-3">Write (2)</th>
                <th className="py-2 px-3">Execute (1)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 px-3 text-left font-medium text-slate-300">User / Owner</td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.user.r}
                    onChange={() => handleCheckboxChange('user', 'r')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.user.w}
                    onChange={() => handleCheckboxChange('user', 'w')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.user.x}
                    onChange={() => handleCheckboxChange('user', 'x')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-left font-medium text-slate-300">Group</td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.group.r}
                    onChange={() => handleCheckboxChange('group', 'r')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.group.w}
                    onChange={() => handleCheckboxChange('group', 'w')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.group.x}
                    onChange={() => handleCheckboxChange('group', 'x')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-left font-medium text-slate-300">World / Others</td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.others.r}
                    onChange={() => handleCheckboxChange('others', 'r')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.others.w}
                    onChange={() => handleCheckboxChange('others', 'w')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={breakdown.others.x}
                    onChange={() => handleCheckboxChange('others', 'x')}
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#141721] border border-white/5">
            <span className="text-xs text-slate-400 font-medium">Octal Permissions Mode:</span>
            <input
              type="text"
              maxLength={4}
              value={octalStr}
              onChange={(e) => handleOctalInputChange(e.target.value)}
              onBlur={() => setOctalStr(modeToOctalString(breakdownToMode(breakdown)))}
              className="w-24 text-center font-mono font-bold text-sm bg-[#1B1E2B] border border-white/10 rounded px-2 py-1 text-cyan-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Change Permissions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
