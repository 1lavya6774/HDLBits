'use client';

import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Activity,
  Hash,
  Binary,
  Radio,
  Sliders,
  Box,
  CornerDownRight,
} from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';
import { WaveSignal, ScopeNode, RadixType } from '@/types/playground';

export const SignalTree: React.FC = () => {
  const { signals, scopeTree, cursorTime, toggleSignalRadix } = usePlayground();
  const [selectedScope, setSelectedScope] = useState<string>('/tb/uut');
  const [expandedScopes, setExpandedScopes] = useState<Record<string, boolean>>({
    '/tb': true,
    '/tb/uut': true,
  });

  const toggleExpand = (path: string) => {
    setExpandedScopes((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Helper to find signal's value at cursorTime
  const getValueAtTime = (signal: WaveSignal, time: number): string => {
    if (!signal.samples || signal.samples.length === 0) return 'x';

    // Find the latest sample where sample.time <= time
    let low = 0;
    let high = signal.samples.length - 1;
    let foundIdx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (signal.samples[mid].time <= time) {
        foundIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const rawVal = signal.samples[foundIdx]?.value || 'x';

    // Format based on radix if bus
    if (signal.width > 1 && !rawVal.toLowerCase().includes('x') && !rawVal.toLowerCase().includes('z')) {
      const num = parseInt(rawVal, 16);
      if (!isNaN(num)) {
        if (signal.radix === 'dec') return num.toString(10);
        if (signal.radix === 'bin') return num.toString(2).padStart(signal.width, '0');
        return 'h' + num.toString(16).toUpperCase();
      }
    }

    return rawVal;
  };

  const renderScopeTree = (node: ScopeNode, level: number = 0) => {
    const isExpanded = expandedScopes[node.fullPath] ?? true;
    const isSelected = selectedScope === node.fullPath;

    return (
      <div key={node.fullPath} className="select-none text-xs">
        <div
          onClick={() => {
            setSelectedScope(node.fullPath);
          }}
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded transition-colors group ${
            isSelected
              ? 'bg-cyan-950/40 text-cyan-300 font-medium border-l-2 border-cyan-400'
              : 'text-slate-300 hover:bg-[#1a222d]'
          }`}
          style={{ paddingLeft: `${Math.max(8, level * 14 + 6)}px` }}
        >
          {node.children.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.fullPath);
              }}
              className="p-0.5 text-slate-500 hover:text-slate-300"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3.5 inline-block" />
          )}

          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}

          <span className="truncate">{node.name}</span>
          <span className="text-[10px] text-slate-500 font-mono ml-auto">({node.moduleName})</span>
        </div>

        {isExpanded && node.children.length > 0 && (
          <div className="flex flex-col">
            {node.children.map((child) => renderScopeTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-[260px] h-full bg-[#121820] border-r border-[#1f2937] flex flex-col shrink-0 overflow-hidden select-none">
      {/* Panel Header */}
      <div className="h-8 px-3 bg-[#0e141c] border-b border-[#1f2937] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Scope & Inspector</span>
        </div>
        <div className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a222d] text-amber-300 border border-[#232d3b]">
          {cursorTime.toFixed(1)} ns
        </div>
      </div>

      {/* Scope Hierarchy Tree (Top Half) */}
      <div className="h-[38%] border-b border-[#1f2937] overflow-y-auto p-1.5">
        <div className="text-[10px] font-mono text-slate-500 uppercase px-2 py-1 tracking-wider font-semibold">
          Hierarchy
        </div>
        {scopeTree.length > 0 ? (
          scopeTree.map((n) => renderScopeTree(n, 0))
        ) : (
          <div className="text-xs text-slate-500 px-3 py-2 italic">No scopes loaded</div>
        )}
      </div>

      {/* Signal Inspector Table (Bottom Half) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0e131a]">
        <div className="h-7 px-3 bg-[#121820] border-b border-[#1f2937] flex items-center justify-between text-[10px] font-mono text-slate-400 font-semibold uppercase">
          <span>Net / Port</span>
          <span>Value @ {cursorTime.toFixed(0)}ns</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#1a222d]/70 p-0.5">
          {signals.map((sig) => {
            const val = getValueAtTime(sig, cursorTime);
            const isBus = sig.width > 1;

            return (
              <div
                key={sig.id}
                className="px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-[#161e29] transition-colors group"
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  {/* Direction Badge */}
                  <span
                    className={`text-[9px] font-mono px-1 rounded uppercase font-semibold shrink-0 ${
                      sig.direction === 'input'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : sig.direction === 'output'
                        ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {sig.direction === 'input' ? 'IN' : sig.direction === 'output' ? 'OUT' : 'NET'}
                  </span>

                  <span className="font-mono text-slate-300 text-[11px] truncate" title={sig.id}>
                    {sig.name}
                    {isBus && (
                      <span className="text-slate-500 ml-0.5">[{sig.width - 1}:0]</span>
                    )}
                  </span>
                </div>

                {/* Live Value Display */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isBus && (
                    <button
                      onClick={() => toggleSignalRadix(sig.id)}
                      className="text-[9px] font-mono text-slate-500 hover:text-cyan-400 px-1 py-0.5 rounded bg-[#1a222d] border border-[#232d3b]"
                      title="Toggle Radix (Hex / Dec / Bin)"
                    >
                      {sig.radix.toUpperCase()}
                    </button>
                  )}

                  <span
                    className={`font-mono font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                      val === '1'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/60'
                        : val === '0'
                        ? 'bg-slate-900 text-slate-400 border border-slate-800'
                        : val.toLowerCase().includes('x')
                        ? 'bg-red-950/80 text-red-400 border border-red-900/60'
                        : val.toLowerCase() === 'z'
                        ? 'bg-amber-950/80 text-amber-400 border border-amber-900/60'
                        : 'bg-cyan-950/80 text-cyan-300 border border-cyan-900/60'
                    }`}
                  >
                    {val}
                  </span>
                </div>
              </div>
            );
          })}

          {signals.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-500 italic">
              Run simulation to inspect nets
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
