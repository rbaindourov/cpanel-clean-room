/**
 * packages/web/src/pages/BackupsCpmovePage.tsx
 * 1-Click cpmove Full Account Export/Import & Restic Encrypted Cloud Snapshots.
 */

import React, { useState, useEffect } from 'react';
import {
  FileArchive,
  Download,
  UploadCloud,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  Play,
  Clock,
  HardDrive,
} from 'lucide-react';
import { api } from '../api/client.ts';

export interface ResticSnapshot {
  id: string;
  time: string;
  paths: string[];
  hostname: string;
  tags?: string[];
}

export const BackupsCpmovePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cpmove' | 'restic'>('cpmove');
  const [snapshots, setSnapshots] = useState<ResticSnapshot[]>([]);
  const [generatingCpmove, setGeneratingCpmove] = useState<boolean>(false);
  const [cpmoveResult, setCpmoveResult] = useState<{ archivePath: string; time: string } | null>(null);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restoreArchivePath, setRestoreArchivePath] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; snapshots: ResticSnapshot[] }>('/backup/restic/snapshots');
      setSnapshots(res.snapshots || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to fetch snapshots' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCpmove = async () => {
    setGeneratingCpmove(true);
    try {
      const res = await api.post<{ success: boolean; archivePath: string }>('/backup/cpmove/export', {});
      setCpmoveResult({
        archivePath: res.archivePath || '/home/vahag/cpmove-vahag.tar.gz',
        time: new Date().toLocaleTimeString(),
      });
      setNotice({ type: 'success', message: 'Full cpmove archive generated successfully' });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'cpmove backup failed' });
    } finally {
      setGeneratingCpmove(false);
    }
  };

  const handleImportCpmove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreArchivePath) return;
    setIsRestoring(true);
    try {
      const res = await api.post<{ success: boolean; summary: string }>('/backup/cpmove/import', {
        archivePath: restoreArchivePath,
      });
      setShowRestoreModal(false);
      setRestoreArchivePath('');
      setNotice({ type: 'success', message: res.summary || 'Account restored successfully' });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Import failed' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateResticSnapshot = async () => {
    try {
      const res = await api.post<{ success: boolean; snapshotId: string }>('/backup/restic/backup', {});
      setNotice({ type: 'success', message: `Restic snapshot '${res.snapshotId || 'new'}' created successfully` });
      fetchSnapshots();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleRestoreResticSnapshot = async (id: string) => {
    if (!confirm(`Restore account state to snapshot ${id}? Warning: Modified files will be reverted.`)) return;
    setRestoringSnapshotId(id);
    try {
      await api.post('/backup/restic/restore', { snapshotId: id });
      setNotice({ type: 'success', message: `Snapshot ${id} restored successfully` });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  return (
    <div className="p-6 bg-[#0F111A] min-h-screen text-slate-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#282D3F]">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileArchive className="w-7 h-7 text-rose-500" />
            Backups & Migration Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            100% cPanel-Compatible cpmove Importer/Exporter & Restic Encrypted Cloud Deduplication
          </p>
        </div>

        {notice && (
          <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
            notice.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
          }`}>
            {notice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {notice.message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#282D3F] mt-6 gap-2">
        <button
          onClick={() => setActiveTab('cpmove')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cpmove' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          1-Click cpmove Migration
        </button>
        <button
          onClick={() => setActiveTab('restic')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'restic' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Restic Snapshots ({snapshots.length})
        </button>
      </div>

      {/* Tab 1: cpmove Migration */}
      {activeTab === 'cpmove' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Export cpmove */}
          <div className="bg-[#1B1E2B] p-6 rounded-xl border border-[#282D3F] space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-rose-400" />
              Export Full cpmove Archive
            </h2>
            <p className="text-xs text-slate-400">
              Generates a full <code>cpmove-&lt;user&gt;.tar.gz</code> package containing all homedir files, MariaDB SQL dumps, BIND9 zone records, Dovecot mailboxes, and Multi-PHP configs.
            </p>

            <button
              onClick={handleGenerateCpmove}
              disabled={generatingCpmove}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-lg py-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition disabled:opacity-50"
            >
              {generatingCpmove ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {generatingCpmove ? 'Generating cpmove Archive...' : 'Generate Full Account Backup'}
            </button>

            {cpmoveResult && (
              <div className="p-4 rounded-lg bg-[#13151f] border border-emerald-800/80 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Ready for Download
                </span>
                <p className="font-mono text-2xs text-slate-300 break-all">{cpmoveResult.archivePath}</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-2xs text-slate-500">Generated at {cpmoveResult.time}</span>
                  <a
                    href={`/api/v1/files/download?path=${encodeURIComponent(cpmoveResult.archivePath)}`}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Archive
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Import cpmove */}
          <div className="bg-[#1B1E2B] p-6 rounded-xl border border-[#282D3F] space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              Restore / Import cpmove Archive
            </h2>
            <p className="text-xs text-slate-400">
              Upload an existing HostGator, cPanel, or clean-room <code>cpmove-*.tar.gz</code> archive. The migration worker automatically unpacks databases, restores DNS records, and reconstructs your vhosts.
            </p>

            <button
              onClick={() => setShowRestoreModal(true)}
              className="w-full border-2 border-dashed border-[#282D3F] hover:border-blue-500/60 rounded-xl p-8 text-center cursor-pointer transition-colors block text-left"
            >
              <UploadCloud className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium text-center">Click to Specify Archive for Restoration</p>
              <p className="text-2xs text-slate-500 mt-1 text-center">Accepts standard .tar.gz archives up to 100 GB</p>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Restic Snapshots */}
      {activeTab === 'restic' && (
        <div className="mt-8 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Encrypted deduplicated snapshot repository</span>
            <button
              onClick={handleCreateResticSnapshot}
              className="bg-[#1F2437] hover:bg-[#282F48] text-rose-300 border border-rose-800/60 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5" /> Create Snapshot Now
            </button>
          </div>

          <div className="bg-[#1B1E2B] rounded-xl border border-[#282D3F] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#13151f] text-slate-400 uppercase border-b border-[#282D3F]">
                <tr>
                  <th className="px-6 py-3">Snapshot ID</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Host</th>
                  <th className="px-6 py-3">Paths Backed Up</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282D3F]">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-[#202538] transition-colors">
                    <td className="px-6 py-3 font-mono font-bold text-rose-400">{s.id.slice(0, 8)}</td>
                    <td className="px-6 py-3 font-mono text-slate-300">{new Date(s.time).toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-400">{s.hostname || 'appliance'}</td>
                    <td className="px-6 py-3 font-mono text-2xs text-slate-400">{s.paths?.join(', ') || '/home/vahag'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleRestoreResticSnapshot(s.id)}
                        disabled={restoringSnapshotId === s.id}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-2xs font-semibold flex items-center gap-1 ml-auto transition disabled:opacity-50"
                      >
                        {restoringSnapshotId === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                        Restore Snapshot
                      </button>
                    </td>
                  </tr>
                ))}
                {snapshots.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No snapshots recorded yet. Click "Create Snapshot Now" to initialize deduplicated cloud backup.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Restore Archive */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1B1E2B] border border-[#282D3F] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              Restore cpmove Archive
            </h3>
            <p className="text-xs text-slate-400">
              Enter the full server path to the <code>cpmove-&lt;user&gt;.tar.gz</code> archive to restore.
            </p>
            <form onSubmit={handleImportCpmove} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Archive Path</label>
                <input
                  type="text"
                  placeholder="/home/cpmove-user.tar.gz"
                  value={restoreArchivePath}
                  onChange={(e) => setRestoreArchivePath(e.target.value)}
                  className="w-full bg-[#0F111A] border border-[#282D3F] rounded px-3 py-2 text-xs text-white font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#282D3F]">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 rounded text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestoring}
                  className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isRestoring && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {isRestoring ? 'Restoring...' : 'Restore Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
