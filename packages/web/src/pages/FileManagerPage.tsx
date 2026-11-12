import React, { useMemo } from 'react';
import {
  Folder,
  FileText,
  FileCode,
  Archive,
  ArrowUp,
  RefreshCw,
  Plus,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Key,
  Archive as CompressIcon,
  FolderInput,
  Search,
  CheckSquare,
  Square,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { useFileManager } from '../hooks/useFileManager.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatFileSize, modeToOctalString } from '../utils/permissions.ts';
import { ChmodModal } from '../components/file-manager/ChmodModal.tsx';
import { UploadModal } from '../components/file-manager/UploadModal.tsx';
import { NewFileModal } from '../components/file-manager/NewFileModal.tsx';
import { NewFolderModal } from '../components/file-manager/NewFolderModal.tsx';
import { RenameModal } from '../components/file-manager/RenameModal.tsx';
import { DeleteModal } from '../components/file-manager/DeleteModal.tsx';
import { CompressModal } from '../components/file-manager/CompressModal.tsx';
import { ExtractModal } from '../components/file-manager/ExtractModal.tsx';
import { MonacoEditorModal } from '../components/file-manager/MonacoEditorModal.tsx';

export const FileManagerPage: React.FC = () => {
  const { effectiveUser } = useAuth();
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('panel_access_token') || localStorage.getItem('panel_token') || '') : '';
  const impersonateUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('panel_impersonate_user') || '') : '';

  const fm = useFileManager({ token, impersonateUser: impersonateUser || undefined });

  // Filtered & sorted entries
  const displayedEntries = useMemo(() => {
    return fm.entries
      .filter((e) => e.name.toLowerCase().includes(fm.searchFilter.toLowerCase()))
      .sort((a, b) => {
        // Directories always first
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;

        let comp = 0;
        if (fm.sortBy === 'name') comp = a.name.localeCompare(b.name);
        else if (fm.sortBy === 'size') comp = a.sizeBytes - b.sizeBytes;
        else if (fm.sortBy === 'mtime') comp = new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
        return fm.sortOrder === 'asc' ? comp : -comp;
      });
  }, [fm.entries, fm.searchFilter, fm.sortBy, fm.sortOrder]);

  const selectedCount = fm.selectedPaths.size;
  const singleSelected = selectedCount === 1
    ? fm.entries.find((e) => fm.selectedPaths.has(e.path))
    : null;

  // Path segments for breadcrumbs
  const pathSegments = useMemo(() => {
    if (!fm.currentPath) return [];
    return fm.currentPath.split('/').filter(Boolean);
  }, [fm.currentPath]);

  // Determine file icon
  const getEntryIcon = (entry: typeof fm.entries[0]) => {
    if (entry.isDir) return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    const ext = entry.name.split('.').pop()?.toLowerCase();
    if (['zip', 'gz', 'tar', 'tgz', 'rar'].includes(ext || '')) {
      return <Archive className="w-5 h-5 text-purple-400" />;
    }
    if (['php', 'js', 'ts', 'html', 'css', 'json', 'sql', 'sh'].includes(ext || '')) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[#141721] text-slate-200 rounded-xl overflow-hidden border border-[#343B52] shadow-xl">
      {/* 1. Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#1B1E2B] border-b border-[#343B52]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => fm.setActiveModal('new_file')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" /> New File
          </button>
          <button
            onClick={() => fm.setActiveModal('new_folder')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" /> New Folder
          </button>
          <button
            onClick={() => fm.setActiveModal('upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" /> Upload
          </button>
          <button
            disabled={!singleSelected || singleSelected.isDir}
            onClick={() => singleSelected && fm.downloadFile(singleSelected)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Download
          </button>
          <button
            disabled={!singleSelected || singleSelected.isDir}
            onClick={() => singleSelected && fm.openEditor(singleSelected)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" /> Edit in Monaco
          </button>
          <button
            disabled={!singleSelected}
            onClick={() => {
              fm.setModalTarget(singleSelected || null);
              fm.setActiveModal('rename');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Edit2 className="w-3.5 h-3.5 text-yellow-400" /> Rename
          </button>
          <button
            disabled={!singleSelected}
            onClick={() => {
              fm.setModalTarget(singleSelected || null);
              fm.setActiveModal('chmod');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" /> Permissions
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() => fm.setActiveModal('delete')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedCount})
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() => fm.setActiveModal('compress')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CompressIcon className="w-3.5 h-3.5 text-violet-400" /> Compress
          </button>
          <button
            disabled={!singleSelected || !singleSelected.name.match(/\.(zip|tar\.gz|tgz)$/i)}
            onClick={() => {
              fm.setModalTarget(singleSelected || null);
              fm.setActiveModal('extract');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-200 border border-[#343B52] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderInput className="w-3.5 h-3.5 text-pink-400" /> Extract
          </button>
        </div>

        {/* Search filter input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={fm.searchFilter}
            onChange={(e) => fm.setSearchFilter(e.target.value)}
            placeholder="Filter current view..."
            className="pl-8 pr-3 py-1 text-xs rounded bg-[#141721] border border-[#343B52] focus:outline-none focus:border-cyan-500 text-slate-200 w-48"
          />
        </div>
      </div>

      {/* 2. Breadcrumbs Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1B1E2B]/90 border-b border-[#343B52] text-xs">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          <button
            onClick={fm.goUp}
            disabled={!fm.currentPath}
            title="Go Up"
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => fm.navigateTo('')}
            className="font-medium text-slate-300 hover:text-cyan-400 px-1 py-0.5 rounded"
          >
            home/{effectiveUser?.username || 'tenant'}
          </button>
          {pathSegments.map((segment, idx) => {
            const subPath = pathSegments.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={subPath}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <button
                  onClick={() => fm.navigateTo(subPath)}
                  className={`px-1 py-0.5 rounded hover:text-cyan-400 ${
                    idx === pathSegments.length - 1 ? 'font-semibold text-cyan-400' : 'text-slate-300'
                  }`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <button
          onClick={fm.refreshCurrent}
          title="Refresh"
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fm.isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* 3. Main Dual-Pane Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Directory Tree & Shortcuts */}
        <div className="w-60 border-r border-[#343B52] bg-[#141721] p-3 flex flex-col gap-4 overflow-y-auto">
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">
              Quick Shortcuts
            </span>
            <div className="mt-1 flex flex-col gap-0.5 text-xs">
              <button
                onClick={() => fm.navigateTo('')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
                  fm.currentPath === '' ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4 text-cyan-400" /> Home Root
              </button>
              <button
                onClick={() => fm.navigateTo('public_html')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
                  fm.currentPath.startsWith('public_html') ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4 text-amber-400" /> public_html (DocRoot)
              </button>
              <button
                onClick={() => fm.navigateTo('mail')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
                  fm.currentPath.startsWith('mail') ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4 text-indigo-400" /> mail (Maildir)
              </button>
              <button
                onClick={() => fm.navigateTo('logs')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
                  fm.currentPath.startsWith('logs') ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4 text-emerald-400" /> logs
              </button>
              <button
                onClick={() => fm.navigateTo('ssl')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
                  fm.currentPath.startsWith('ssl') ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <Folder className="w-4 h-4 text-purple-400" /> ssl / certs
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: File Table */}
        <div className="flex-1 flex flex-col bg-[#0F111A] overflow-y-auto">
          {fm.error && (
            <div className="p-3 m-4 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              Error: {fm.error}
            </div>
          )}

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#1B1E2B] sticky top-0 z-10 border-b border-[#343B52] text-slate-400 select-none">
              <tr>
                <th className="py-2 px-3 w-8 text-center">
                  <button
                    onClick={() => fm.selectAll(selectedCount !== displayedEntries.length)}
                    className="text-slate-400 hover:text-white"
                  >
                    {selectedCount > 0 && selectedCount === displayedEntries.length ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => {
                    fm.setSortBy('name');
                    fm.setSortOrder(fm.sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-white"
                >
                  Name {fm.sortBy === 'name' && (fm.sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  onClick={() => {
                    fm.setSortBy('size');
                    fm.setSortOrder(fm.sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-2.5 px-3 w-28 cursor-pointer hover:text-white"
                >
                  Size {fm.sortBy === 'size' && (fm.sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-2.5 px-3 w-24">Perms</th>
                <th
                  onClick={() => {
                    fm.setSortBy('mtime');
                    fm.setSortOrder(fm.sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="py-2.5 px-3 w-44 cursor-pointer hover:text-white"
                >
                  Last Modified {fm.sortBy === 'mtime' && (fm.sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#343B52]/40">
              {displayedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    {fm.isLoading ? 'Loading directory contents...' : 'This directory is empty'}
                  </td>
                </tr>
              ) : (
                displayedEntries.map((entry) => {
                  const isSelected = fm.selectedPaths.has(entry.path);
                  return (
                    <tr
                      key={entry.path}
                      onClick={(e) => fm.toggleSelect(entry.path, e.ctrlKey || e.metaKey)}
                      onDoubleClick={() => {
                        if (entry.isDir) fm.navigateTo(entry.path);
                        else fm.openEditor(entry);
                      }}
                      className={`cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-cyan-500/15 hover:bg-cyan-500/20 text-white'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => fm.toggleSelect(entry.path, true)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-3 flex items-center gap-2.5 font-medium">
                        {getEntryIcon(entry)}
                        <span>{entry.name}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {entry.isDir ? '—' : formatFileSize(entry.sizeBytes)}
                      </td>
                      <td className="py-2 px-3 font-mono text-indigo-300">
                        {modeToOctalString(entry.mode)}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {new Date(entry.mtime).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Action Modals */}
      {fm.activeModal === 'chmod' && fm.modalTarget && (
        <ChmodModal
          entry={fm.modalTarget}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (mode) => {
            await fm.changePermissions(fm.modalTarget!.path, mode);
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'upload' && (
        <UploadModal
          currentPath={fm.currentPath}
          onClose={() => fm.setActiveModal(null)}
          onUpload={async (files) => {
            for (const file of files) {
              await fm.uploadFile(file);
            }
            fm.setActiveModal(null);
            fm.refreshCurrent();
          }}
        />
      )}

      {fm.activeModal === 'new_file' && (
        <NewFileModal
          currentPath={fm.currentPath}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (filename) => {
            await fm.createFile(filename);
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'new_folder' && (
        <NewFolderModal
          currentPath={fm.currentPath}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (folderName) => {
            await fm.createFolder(folderName);
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'rename' && fm.modalTarget && (
        <RenameModal
          entry={fm.modalTarget}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (newName) => {
            await fm.renameItem(fm.modalTarget!.path, newName);
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'delete' && (
        <DeleteModal
          count={selectedCount}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async () => {
            await fm.deleteSelected();
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'compress' && (
        <CompressModal
          selectedPaths={Array.from(fm.selectedPaths)}
          currentPath={fm.currentPath}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (targetName, format) => {
            const first = Array.from(fm.selectedPaths)[0];
            await fm.compressItems(first, targetName, format);
            fm.setActiveModal(null);
          }}
        />
      )}

      {fm.activeModal === 'extract' && fm.modalTarget && (
        <ExtractModal
          entry={fm.modalTarget}
          currentPath={fm.currentPath}
          onClose={() => fm.setActiveModal(null)}
          onConfirm={async (dest) => {
            await fm.extractArchive(fm.modalTarget!.path, dest);
            fm.setActiveModal(null);
          }}
        />
      )}

      {/* 5. Monaco Code Editor Modal */}
      {fm.editorState.isOpen && (
        <MonacoEditorModal
          state={fm.editorState}
          onChange={(newContent) => {
            fm.setEditorState((prev) => ({
              ...prev,
              content: newContent,
              isDirty: newContent !== prev.originalContent,
            }));
          }}
          onSave={fm.saveEditorContent}
          onClose={() => fm.closeEditor()}
        />
      )}
    </div>
  );
};
