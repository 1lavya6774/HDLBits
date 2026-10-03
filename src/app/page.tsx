'use client';

import React, { useState, useRef, useCallback } from 'react';
import { TopHeader } from '@/components/toolbar/TopHeader';
import { SignalTree } from '@/components/scope/SignalTree';
import { EditorPane } from '@/components/editor/EditorPane';
import { VivadoConsole } from '@/components/console/VivadoConsole';
import { WaveformViewer } from '@/components/waveform/WaveformViewer';
import { SchematicViewer } from '@/components/schematic/SchematicViewer';
import { UtilizationDashboard } from '@/components/synthesis/UtilizationDashboard';
import { usePlayground } from '@/context/PlaygroundContext';
import { Activity, Cpu, Layers2 } from 'lucide-react';

export default function VerilogStudioPage() {
  const {
    activeLowerTab,
    setActiveLowerTab,
    upperHeightPercent,
    setUpperHeightPercent,
    synthesisMetrics,
  } = usePlayground();

  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingSplitter || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - containerRect.top;
    const totalHeight = containerRect.height;

    const newPercent = Math.max(20, Math.min(75, (relativeY / totalHeight) * 100));
    setUpperHeightPercent(newPercent);
  }, [isDraggingSplitter, setUpperHeightPercent]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingSplitter) {
      setIsDraggingSplitter(false);
    }
  }, [isDraggingSplitter]);

  React.useEffect(() => {
    if (isDraggingSplitter) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0b0e14] select-none text-slate-200">
      {/* 1. Top Header Toolbar */}
      <TopHeader />

      {/* Main Split Container */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col w-full min-h-0 overflow-hidden relative"
      >
        {/* 2. Upper Split Workspace (Default 45vh) */}
        <div
          style={{ height: `${upperHeightPercent}%` }}
          className="w-full flex flex-row min-h-0 overflow-hidden"
        >
          {/* Left Panel: Scope & Signal Tree */}
          <SignalTree />

          {/* Center Panel: Tabbed Monaco Editor */}
          <EditorPane />

          {/* Right Panel: Diagnostics & Vivado Tcl Shell */}
          <VivadoConsole />
        </div>

        {/* 3. Resizable Horizontal Splitter (6px handle) */}
        <div
          onMouseDown={handleMouseDownSplitter}
          className={`h-[6px] w-full bg-[#121820] hover:bg-cyan-500/50 cursor-row-resize flex items-center justify-center transition-colors border-y border-[#1f2937] z-20 ${
            isDraggingSplitter ? 'bg-cyan-500' : ''
          }`}
          title="Drag to resize workspaces (Default 45vh)"
        >
          <div className="w-8 h-1 rounded-full bg-slate-600 hover:bg-slate-400" />
        </div>

        {/* 4. Lower Analysis Workspace (Remaining viewport height) */}
        <div
          style={{ height: `${100 - upperHeightPercent}%` }}
          className="w-full flex flex-col min-h-0 overflow-hidden bg-[#0b0e14]"
        >
          {/* Sub-Tabs Header */}
          <div className="h-8 bg-[#121820] border-b border-[#1f2937] flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-1">
              {/* Sub-tab 1: Waveform Viewer */}
              <button
                onClick={() => setActiveLowerTab('waveform')}
                className={`h-7 px-3 flex items-center gap-1.5 text-xs font-mono rounded-t transition-all ${
                  activeLowerTab === 'waveform'
                    ? 'bg-[#0b0e14] text-cyan-300 font-semibold border-t-2 border-t-cyan-400 border-x border-[#1f2937]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a222d]'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Waveform Viewer (xsim)</span>
              </button>

              {/* Sub-tab 2: RTL Schematic Viewer */}
              <button
                onClick={() => setActiveLowerTab('schematic')}
                className={`h-7 px-3 flex items-center gap-1.5 text-xs font-mono rounded-t transition-all ${
                  activeLowerTab === 'schematic'
                    ? 'bg-[#0b0e14] text-cyan-300 font-semibold border-t-2 border-t-cyan-400 border-x border-[#1f2937]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a222d]'
                }`}
              >
                <Layers2 className="w-3.5 h-3.5 text-purple-400" />
                <span>RTL Schematic</span>
              </button>

              {/* Sub-tab 3: Synthesis Utilization & Cell Report */}
              <button
                onClick={() => setActiveLowerTab('synthesis')}
                className={`h-7 px-3 flex items-center gap-1.5 text-xs font-mono rounded-t transition-all ${
                  activeLowerTab === 'synthesis'
                    ? 'bg-[#0b0e14] text-cyan-300 font-semibold border-t-2 border-t-cyan-400 border-x border-[#1f2937]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a222d]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Synthesis & Utilization</span>
                {synthesisMetrics && synthesisMetrics.inferredLatchCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 ml-1 animate-pulse" />
                )}
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-500">
              IEEE 1364 Stratified Timing Engine
            </div>
          </div>

          {/* Sub-Tab Contents */}
          <div className="flex-1 w-full min-h-0 overflow-hidden relative">
            {activeLowerTab === 'waveform' && <WaveformViewer />}
            {activeLowerTab === 'schematic' && <SchematicViewer />}
            {activeLowerTab === 'synthesis' && <UtilizationDashboard />}
          </div>
        </div>
      </div>
    </div>
  );
}
