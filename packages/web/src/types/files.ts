export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  mode: number;
  owner: string;
  group: string;
  mtime: string;
  mimeType?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isExpanded: boolean;
  isLoading: boolean;
  children: TreeNode[];
}

export type ModalType =
  | 'new_file'
  | 'new_folder'
  | 'rename'
  | 'chmod'
  | 'delete'
  | 'compress'
  | 'extract'
  | 'upload';

export interface EditorState {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
  isOpen: boolean;
}

export interface ModeBreakdown {
  user: { r: boolean; w: boolean; x: boolean };
  group: { r: boolean; w: boolean; x: boolean };
  others: { r: boolean; w: boolean; x: boolean };
}
