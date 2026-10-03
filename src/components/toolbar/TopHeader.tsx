'use client';

import React from 'react';
import {
  Play,
  Cpu,
  Download,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Wand2,
  FileCode2,
} from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';
import { PRESET_DESIGNS } from '@/lib/defaults';

export const TopHeader: React.FC = () => {
  const {
    runSimulation,
    runSynthesis,
    exportZip,
    simStatus,
    activePresetId,
    loadPreset,
    maxSimTime,
    isAutoDriverMode,
    setIsAutoDriverMode,
  } = usePlayground();

  const [isPresetOpen, setIsPresetOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePreset = PRESET_DESIGNS.find((p) => p.id === activePresetId) || PRESET_DESIGNS[0];

  return (
    <header className="h-[48px] bg-[#121820] border-b border-[#1f2937] px-3.5 flex items-center justify-between select-none shrink-0 z-30">
      {/* Left: Brand & Presets */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm tracking-wider bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
              VERILOG STUDIO
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1a222d] border border-[#232d3b] text-cyan-400 font-semibold tracking-wide">
              EDA BROWSER
            </span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-[#232d3b] mx-1" />

        {/* Preset Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsPresetOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 border border-[#232d3b] hover:border-slate-600 transition-colors"
            title="Load standard academic circuits and verification benches"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium max-w-[170px] truncate">{activePreset.title}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {isPresetOpen && (
            <div className="absolute left-0 mt-1 w-72 rounded-md bg-[#161e29] border border-[#232d3b] shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-[#232d3b]">
                Academic Lab Presets
              </div>
              {PRESET_DESIGNS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    loadPreset(preset.id);
                    setIsPresetOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[#1f2937] transition-colors flex flex-col gap-0.5 ${
                    preset.id === activePresetId ? 'bg-cyan-950/30 text-cyan-300 border-l-2 border-cyan-400' : 'text-slate-300'
                  }`}
                >
                  <span className="font-semibold">{preset.title}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{preset.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Driver Mode Switch */}
        <button
          onClick={() => setIsAutoDriverMode((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-all ${
            isAutoDriverMode
              ? 'bg-emerald-950/60 border-emerald-600/70 text-emerald-300 shadow-sm shadow-emerald-950/30'
              : 'bg-[#1a222d] border-[#232d3b] text-slate-400 hover:text-slate-300'
          }`}
          title={
            isAutoDriverMode
              ? 'Auto-Driver Mode ON: Only write design.v; testbench is auto-synthesized in background'
              : 'Manual Mode: Simulates using custom code in testbench.v tab'
          }
        >
          {isAutoDriverMode ? (
            <Wand2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>{isAutoDriverMode ? 'Auto-Driver: ON' : 'Auto-Driver: OFF'}</span>
        </button>
      </div>

      {/* Center: Status Indicator */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0b0e14] border border-[#232d3b] text-[11px] font-mono">
          {simStatus === 'running' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-300">SIMULATING...</span>
            </>
          )}
          {simStatus === 'done' && (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">RESOLVED ({maxSimTime.toFixed(0)}ns)</span>
            </>
          )}
          {simStatus === 'error' && (
            <>
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-red-400">SIM ERROR</span>
            </>
          )}
          {simStatus === 'idle' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span className="text-slate-400">READY</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Run Simulation */}
        <button
          onClick={() => runSimulation()}
          disabled={simStatus === 'running'}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-950/30 transition-all border border-emerald-500/50"
          title="Run stratified behavioral simulation in background worker"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run Simulation</span>
        </button>

        {/* Synthesize */}
        <button
          onClick={() => runSynthesis()}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-[#1a222d] hover:bg-[#232d3b] active:bg-[#1a222d] text-cyan-300 border border-cyan-800/60 hover:border-cyan-500/80 transition-all shadow-sm"
          title="Elaborate RTL, audit latches, and report LUT/FF utilization"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Synthesize</span>
        </button>

        {/* 1-Click EDA Export */}
        <button
          onClick={() => exportZip()}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 active:to-amber-600 text-slate-950 shadow-md shadow-amber-950/40 transition-all border border-amber-400/80"
          title="Download 1-Click ZIP bundle with Vivado and Quartus Prime Tcl scripts"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Export for EDA</span>
        </button>
      </div>
    </header>
  );
};
