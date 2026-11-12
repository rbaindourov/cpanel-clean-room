/**
 * packages/web/src/pages/TerminalPage.tsx
 * Embedded xterm.js WebSocket terminal with auto-fit ResizeObserver,
 * ANSI Jupiter color palette, status pill, and action toolbar.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TermIcon,
  RefreshCw,
  Trash2,
  Copy,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  Circle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../api/client.ts';

const jupiterTerminalTheme = {
  background: '#0F111A',
  foreground: '#D8DEE9',
  cursor: '#00D2FF',
  cursorAccent: '#0F111A',
  selectionBackground: 'rgba(0, 210, 255, 0.3)',
  black: '#1E222D',
  red: '#F87171',
  green: '#4ADE80',
  yellow: '#FBBF24',
  blue: '#60A5FA',
  magenta: '#C084FC',
  cyan: '#22D3EE',
  white: '#F1F5F9',
  brightBlack: '#475569',
  brightRed: '#EF4444',
  brightGreen: '#22C55E',
  brightYellow: '#EAB308',
  brightBlue: '#3B82F6',
  brightMagenta: '#A855F7',
  brightCyan: '#06B6D4',
  brightWhite: '#FFFFFF',
};

export const TerminalPage: React.FC = () => {
  const { effectiveUser } = useAuth();
  const token = api.getToken() || '';
  const username = effectiveUser?.username || 'vahag';

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<{ cols: number; rows: number }>({ cols: 80, rows: 24 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return;

    // Clean up any existing instances
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }

    // 1. Instantiate Terminal
    const term = new Terminal({
      theme: jupiterTerminalTheme,
      fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    setDimensions({ cols: term.cols, rows: term.rows });

    // 2. Connect WebSocket
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const wsUrl = `${protocol}//${host}/ws/terminal?token=${encodeURIComponent(token)}&cols=${term.cols}&rows=${term.rows}`;

    setStatus('connecting');
    setExitCode(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      term.writeln('\x1b[1;36m╭─────────────────────────────────────────────────────────────╮\x1b[0m');
      term.writeln(`\x1b[1;36m│\x1b[0m  \x1b[1;37mcPanel Clean-Room Modern Appliance\x1b[0m — Interactive Shell   \x1b[1;36m│\x1b[0m`);
      term.writeln(`\x1b[1;36m│\x1b[0m  Logged in as: \x1b[1;32m${username}\x1b[0m (isolated tenant environment)       \x1b[1;36m│\x1b[0m`);
      term.writeln('\x1b[1;36m╰─────────────────────────────────────────────────────────────╯\x1b[0m\r\n');

      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{')) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'exit') {
            setStatus('disconnected');
            setExitCode(parsed.code ?? 0);
            term.writeln(`\r\n\x1b[90m[Process exited with code ${parsed.code ?? 0}]\x1b[0m`);
            return;
          }
          if (parsed.type === 'pong') return;
        } catch {
          // Pass through to raw terminal write
        }
      }
      term.write(data);
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[91m[WebSocket connection error]\x1b[0m');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }, [token, username]);

  useEffect(() => {
    initTerminal();

    const resizeObserver = new ResizeObserver(() => {
      if (!fitAddonRef.current || !termRef.current || !wsRef.current) return;
      try {
        fitAddonRef.current.fit();
        const cols = termRef.current.cols;
        const rows = termRef.current.rows;
        setDimensions({ cols, rows });
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      } catch {}
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        termRef.current.dispose();
      }
    };
  }, [initTerminal]);

  const handleClear = () => {
    termRef.current?.clear();
  };

  const handleCopy = async () => {
    const selection = termRef.current?.getSelection();
    if (selection) {
      await navigator.clipboard.writeText(selection);
    }
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    if (text && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(text);
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#0F111A] text-slate-200 rounded-xl overflow-hidden border border-[#343B52] shadow-xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[calc(100vh-8rem)]'
      }`}
    >
      {/* Terminal Top Control Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1B1E2B] border-b border-[#343B52] select-none">
        <div className="flex items-center gap-3">
          <TermIcon className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-sm text-white">Interactive Shell</span>

          {/* Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#141721] border border-white/5">
            {status === 'connected' && (
              <>
                <Circle className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Connected ({username})</span>
              </>
            )}
            {status === 'connecting' && (
              <>
                <Circle className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-amber-400">Connecting...</span>
              </>
            )}
            {status === 'disconnected' && (
              <>
                <Circle className="w-2.5 h-2.5 text-red-400 fill-red-400" />
                <span className="text-red-400">
                  Disconnected {exitCode !== null && `(code ${exitCode})`}
                </span>
              </>
            )}
          </div>

          <span className="text-xs font-mono text-slate-500 hidden sm:inline">
            {dimensions.cols}x{dimensions.rows}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={initTerminal}
            title="Reconnect Shell"
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-[#232736] hover:bg-[#2A2F42] text-slate-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Reconnect
          </button>
          <button
            onClick={handleClear}
            title="Clear Buffer"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            title="Copy Selection"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handlePaste}
            title="Paste Clipboard"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* xterm.js Canvas Container */}
      <div ref={containerRef} className="flex-1 w-full h-full p-2 bg-[#0F111A] overflow-hidden" />
    </div>
  );
};
