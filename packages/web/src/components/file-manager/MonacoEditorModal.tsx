/**
 * packages/web/src/components/file-manager/MonacoEditorModal.tsx
 * Full-screen / Large modal hosting @monaco-editor/react with Jupiter dark theme,
 * syntax auto-detection, keyboard shortcuts (Ctrl+S / Cmd+S), and dirty state.
 */

import React, { useState, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Save, X, Maximize2, Minimize2, WrapText, FileCode } from 'lucide-react';
import type { EditorState } from '../../types/files.ts';
import { jupiterMonacoTheme } from '../../utils/monaco.ts';

const MonacoEditor = (Editor as any).default || Editor;

interface MonacoEditorModalProps {
  state: EditorState;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export const MonacoEditorModal: React.FC<MonacoEditorModalProps> = ({
  state,
  onChange,
  onSave,
  onClose,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off');
  const [editorLanguage, setEditorLanguage] = useState(state.language);
  const monaco = useMonaco();

  // Register Jupiter Dark theme on Monaco mount
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('jupiter-dark', jupiterMonacoTheme as any);
      monaco.editor.setTheme('jupiter-dark');
    }
  }, [monaco]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Ctrl+S / Cmd+S save hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-6">
      <div
        className={`flex flex-col bg-[#141721] border border-white/10 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-[95vw] h-[90vh]'
        }`}
      >
        {/* Editor Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1B1E2B] border-b border-white/5 select-none">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-100">{state.name}</span>
              {state.isDirty && (
                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                  ● Unsaved
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-mono truncate hidden md:inline">
              ({state.path})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <select
              value={editorLanguage}
              onChange={(e) => setEditorLanguage(e.target.value)}
              className="text-xs bg-[#141721] border border-white/10 text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="php">PHP</option>
              <option value="html">HTML</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="sql">SQL</option>
              <option value="ini">INI / .htaccess</option>
              <option value="shell">Shell / Bash</option>
              <option value="markdown">Markdown</option>
              <option value="plaintext">Plain Text</option>
            </select>

            {/* Word wrap toggle */}
            <button
              onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
              title={`Word Wrap: ${wordWrap}`}
              className={`p-1.5 rounded transition ${
                wordWrap === 'on' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-white/10'
              }`}
            >
              <WrapText className="w-4 h-4" />
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title="Toggle Fullscreen"
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !state.isDirty}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save File'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 w-full h-full relative">
          <MonacoEditor
            height="100%"
            language={editorLanguage}
            value={state.content}
            theme="jupiter-dark"
            onChange={(val?: string) => onChange(val || '')}
            options={{
              fontSize: 14,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
              fontLigatures: true,
              automaticLayout: true,
              minimap: { enabled: true, maxColumn: 80 },
              wordWrap: wordWrap,
              tabSize: 4,
              insertSpaces: true,
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
            }}
          />
        </div>
      </div>
    </div>
  );
};
