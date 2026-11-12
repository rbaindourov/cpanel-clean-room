/**
 * packages/web/src/hooks/useFileManager.ts
 * Complete state machine for file browsing, selection, and operations.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FileEntry, TreeNode, ModalType, EditorState } from '../types/files.ts';
import { detectLanguageFromFilename } from '../utils/monaco.ts';

interface ApiOptions {
  token: string;
  impersonateUser?: string | null;
}

export function useFileManager(apiOpts: ApiOptions) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'mtime' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalTarget, setModalTarget] = useState<FileEntry | null>(null);

  // Editor Modal state
  const [editorState, setEditorState] = useState<EditorState>({
    path: '',
    name: '',
    content: '',
    originalContent: '',
    language: 'plaintext',
    isDirty: false,
    isOpen: false,
  });

  // Folder tree root
  const [folderTree, setFolderTree] = useState<TreeNode>({
    name: 'Home',
    path: '',
    isExpanded: true,
    isLoading: false,
    children: [],
  });

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiOpts.token}`,
      'Content-Type': 'application/json',
    };
    if (apiOpts.impersonateUser) {
      headers['X-Impersonate-User'] = apiOpts.impersonateUser;
    }
    return headers;
  }, [apiOpts.token, apiOpts.impersonateUser]);

  // Load directory entries
  const fetchDirectory = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/files/list?path=${encodeURIComponent(dirPath)}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to list directory');
      }
      setEntries(data.entries || []);
      setSelectedPaths(new Set());
      setCurrentPath(dirPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  // Initial load
  useEffect(() => {
    fetchDirectory('');
  }, [fetchDirectory]);

  // Navigation handlers
  const navigateTo = useCallback((dirPath: string) => {
    fetchDirectory(dirPath);
  }, [fetchDirectory]);

  const goUp = useCallback(() => {
    if (!currentPath) return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    navigateTo(segments.join('/'));
  }, [currentPath, navigateTo]);

  // Selection handlers
  const toggleSelect = useCallback((itemPath: string, isMulti: boolean = false) => {
    setSelectedPaths((prev) => {
      const next = new Set(isMulti ? prev : []);
      if (next.has(itemPath)) {
        next.delete(itemPath);
      } else {
        next.add(itemPath);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((select: boolean) => {
    if (!select) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(entries.map((e) => e.path)));
    }
  }, [entries]);

  // File Operations
  const createFile = async (fileName: string) => {
    const targetPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const res = await fetch('/api/v1/files/content', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ path: targetPath, content: '', encoding: 'utf-8' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to create file');
    await fetchDirectory(currentPath);
  };

  const createFolder = async (folderName: string, mode: number = 0o755) => {
    const targetPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch('/api/v1/files/mkdir', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: targetPath, mode }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to create folder');
    await fetchDirectory(currentPath);
  };

  const renameItem = async (sourcePath: string, newName: string) => {
    const segments = sourcePath.split('/');
    segments[segments.length - 1] = newName;
    const targetPath = segments.join('/');

    const res = await fetch('/api/v1/files/rename', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: sourcePath, targetPath }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to rename item');
    await fetchDirectory(currentPath);
  };

  const changePermissions = async (targetPath: string, mode: number) => {
    const res = await fetch('/api/v1/files/chmod', {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ path: targetPath, mode }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to change permissions');
    await fetchDirectory(currentPath);
  };

  const deleteSelected = async () => {
    for (const p of selectedPaths) {
      const res = await fetch('/api/v1/files/', {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ path: p }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || `Failed to delete ${p}`);
    }
    await fetchDirectory(currentPath);
    setSelectedPaths(new Set());
  };

  const compressItems = async (sourcePath: string, targetPath: string, format: 'zip' | 'tar.gz') => {
    const res = await fetch('/api/v1/files/archive', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: sourcePath, targetPath, format }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to archive item');
    await fetchDirectory(currentPath);
  };

  const extractArchive = async (archivePath: string, targetPath?: string) => {
    const res = await fetch('/api/v1/files/extract', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: archivePath, targetPath: targetPath || currentPath }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to extract archive');
    await fetchDirectory(currentPath);
  };

  const uploadFile = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          const targetPath = currentPath ? `${currentPath}/${file.name}` : file.name;

          const res = await fetch('/api/v1/files/upload', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: targetPath, content: base64, encoding: 'base64' }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error?.message || `Failed to upload ${file.name}`);
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const downloadFile = async (entry: FileEntry) => {
    const res = await fetch(`/api/v1/files/content?path=${encodeURIComponent(entry.path)}&encoding=base64`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to download file');

    const byteCharacters = atob(data.content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/octet-stream' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = entry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // Editor Actions
  const openEditor = async (entry: FileEntry) => {
    try {
      const res = await fetch(`/api/v1/files/content?path=${encodeURIComponent(entry.path)}&encoding=utf-8`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Failed to read file content');

      setEditorState({
        path: entry.path,
        name: entry.name,
        content: data.content || '',
        originalContent: data.content || '',
        language: detectLanguageFromFilename(entry.name),
        isDirty: false,
        isOpen: true,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveEditorContent = async () => {
    const res = await fetch('/api/v1/files/content', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        path: editorState.path,
        content: editorState.content,
        encoding: 'utf-8',
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to save file');

    setEditorState((prev) => ({
      ...prev,
      originalContent: prev.content,
      isDirty: false,
    }));
    await fetchDirectory(currentPath);
  };

  const closeEditor = (force: boolean = false) => {
    if (editorState.isDirty && !force) {
      if (typeof window !== 'undefined' && !window.confirm('You have unsaved changes. Discard changes and close?')) {
        return;
      }
    }
    setEditorState((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    currentPath,
    entries,
    isLoading,
    error,
    selectedPaths,
    searchFilter,
    sortBy,
    sortOrder,
    activeModal,
    modalTarget,
    editorState,
    folderTree,
    setSearchFilter,
    setSortBy,
    setSortOrder,
    setActiveModal,
    setModalTarget,
    setEditorState,
    navigateTo,
    goUp,
    toggleSelect,
    selectAll,
    refreshCurrent: () => fetchDirectory(currentPath),
    createFile,
    createFolder,
    renameItem,
    changePermissions,
    deleteSelected,
    compressItems,
    extractArchive,
    uploadFile,
    downloadFile,
    openEditor,
    saveEditorContent,
    closeEditor,
  };
}
