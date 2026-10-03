'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, CornerDownLeft } from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';

export const VivadoConsole: React.FC = () => {
  const { logs, executeTclCommand, clearLogs } = usePlayground();
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setHistory((prev) => [...prev, inputVal]);
    setHistoryIdx(-1);
    executeTclCommand(inputVal);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx < history.length) {
          setHistoryIdx(nextIdx);
          setInputVal(history[nextIdx]);
        } else {
          setHistoryIdx(-1);
          setInputVal('');
        }
      }
    }
  };

  return (
    <div className="w-[340px] h-full bg-[#121820] border-l border-[#1f2937] flex flex-col shrink-0 overflow-hidden font-mono select-none">
      {/* Console Header */}
      <div className="h-8 px-3 bg-[#0e141c] border-b border-[#1f2937] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Vivado Tcl Shell</span>
        </div>
        <button
          onClick={clearLogs}
          className="text-slate-500 hover:text-slate-300 p-1 hover:bg-[#1a222d] rounded transition-colors"
          title="Clear console output"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Logs stream */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-1 text-xs select-text font-mono bg-[#0b0e14]"
      >
        {logs.map((log) => {
          const isError = log.level === 'error';
          const isWarn = log.level === 'warn';
          const isSuccess = log.level === 'success';
          const isCmd = log.level === 'cmd';

          return (
            <div
              key={log.id}
              className={`leading-relaxed break-words font-mono text-[11px] ${
                isError
                  ? 'text-red-400 bg-red-950/20 px-1 py-0.5 rounded border-l-2 border-red-500'
                  : isWarn
                  ? 'text-amber-300 bg-amber-950/20 px-1 py-0.5 rounded border-l-2 border-amber-500'
                  : isSuccess
                  ? 'text-emerald-400'
                  : isCmd
                  ? 'text-cyan-300 font-bold'
                  : 'text-slate-300'
              }`}
            >
              <span className="text-slate-600 text-[10px] mr-1.5">[{log.timestamp}]</span>
              {log.source && (
                <span className="text-[10px] text-slate-500 uppercase mr-1">
                  [{log.source}]
                </span>
              )}
              <span>{log.text}</span>
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="text-slate-600 text-xs italic py-4 text-center">
            Vivado Tcl console ready. Type &apos;help&apos; for list of commands.
          </div>
        )}
      </div>

      {/* Interactive Command Input */}
      <form
        onSubmit={handleSubmit}
        className="h-9 px-2.5 bg-[#0e141c] border-t border-[#1f2937] flex items-center gap-1.5 shrink-0"
      >
        <span className="text-emerald-400 font-bold text-xs select-none">Vivado%</span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. run 100ns, synth_design, export, help"
          className="flex-1 bg-transparent text-slate-200 text-xs font-mono focus:outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!inputVal.trim()}
          className="text-slate-500 hover:text-cyan-400 disabled:opacity-30 p-1"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
