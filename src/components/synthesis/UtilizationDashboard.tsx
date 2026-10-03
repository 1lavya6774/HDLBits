'use client';

import React from 'react';
import {
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';

export const UtilizationDashboard: React.FC = () => {
  const { synthesisMetrics, runSynthesis } = usePlayground();
  const [copied, setCopied] = React.useState(false);

  const handleCopyReport = () => {
    if (synthesisMetrics?.rawReport) {
      navigator.clipboard.writeText(synthesisMetrics.rawReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!synthesisMetrics) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0e14] text-slate-400 gap-3 p-6">
        <Cpu className="w-10 h-10 text-slate-600 animate-pulse" />
        <div className="text-sm font-medium">No synthesis run recorded yet.</div>
        <p className="text-xs text-slate-500 max-w-sm text-center">
          Click the button below or &quot;Synthesize&quot; in the top toolbar to elaborate your RTL design, audit latches, and compute FPGA cell metrics.
        </p>
        <button
          onClick={() => runSynthesis()}
          className="mt-2 px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40 transition-colors"
        >
          Run Logic Synthesis (synth_design)
        </button>
      </div>
    );
  }

  const {
    topModule,
    lut4Count,
    lut6Count,
    fdreCount,
    totalLuts,
    inferredLatchCount,
    inferredLatches,
    ioCount,
    rawReport,
    timestamp,
  } = synthesisMetrics;

  const ARTIX_LUTS = 20800;
  const ARTIX_FFS = 41600;
  const ARTIX_IOBS = 106;

  const lutPercent = ((totalLuts / ARTIX_LUTS) * 100).toFixed(2);
  const ffPercent = ((fdreCount / ARTIX_FFS) * 100).toFixed(2);
  const ioPercent = ((ioCount / ARTIX_IOBS) * 100).toFixed(2);

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e14] overflow-y-auto p-4 select-text">
      {/* Top Banner / Target info */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1f2937] mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              FPGA Utilization Report - Module &apos;{topModule}&apos;
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
              Xilinx Artix-7 (xc7a35tcpg236-1)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Synthesis completed: {new Date(timestamp).toLocaleTimeString()} | Target Board: Digilent Basys 3
          </p>
        </div>

        <button
          onClick={handleCopyReport}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 border border-[#232d3b] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Report Copied' : 'Copy Log'}</span>
        </button>
      </div>

      {/* Latch Inference Critical Warning Card */}
      {inferredLatchCount > 0 && (
        <div className="mb-4 rounded-lg bg-amber-950/30 border border-amber-500/50 p-3.5 shadow-lg shadow-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-amber-500/20 text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  [Synth 8-327] Unintended Latch Inference Detected!
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-bold">
                  {inferredLatchCount} Inferred Latch{inferredLatchCount > 1 ? 'es' : ''}
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                The synthesizer inferred transparent level-sensitive latches (LDCE) for variable(s):{' '}
                <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded">
                  {inferredLatches.join(', ')}
                </span>
                . In combinational <code className="font-mono">always @(*)</code> blocks, all outputs must be assigned along every possible execution path (missing <code className="font-mono">else</code> branch or incomplete <code className="font-mono">case</code> statement without a <code className="font-mono">default</code> arm).
              </p>
              <div className="mt-2 text-[11px] font-mono text-amber-400/80 bg-[#0e141c] p-2 rounded border border-amber-900/40">
                Fix recommendation: Add a &apos;default:&apos; branch to your case statement or assign default values at the top of the always block.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Design Banner */}
      {inferredLatchCount === 0 && (
        <div className="mb-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 p-2.5 flex items-center gap-2.5 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <b>Clean Synchronous RTL:</b> No unwanted sequential latches inferred. All combinational assignments are fully specified.
          </span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {/* Slice LUTs */}
        <div className="bg-[#121820] border border-[#1f2937] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Slice LUTs</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-100">{totalLuts}</div>
            <div className="text-[11px] text-slate-500 font-mono">
              {lut4Count} LUT4 + {lut6Count} LUT6
            </div>
          </div>
          <div>
            <div className="w-full bg-[#1a222d] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full"
                style={{ width: `${Math.max(1, parseFloat(lutPercent) * 20)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>{lutPercent}% used</span>
              <span>20,800 Max</span>
            </div>
          </div>
        </div>

        {/* Slice Registers (FDRE) */}
        <div className="bg-[#121820] border border-[#1f2937] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Registers (FDRE)</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-100">{fdreCount}</div>
            <div className="text-[11px] text-slate-500 font-mono">D-Type Flip-Flops</div>
          </div>
          <div>
            <div className="w-full bg-[#1a222d] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${Math.max(1, parseFloat(ffPercent) * 20)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>{ffPercent}% used</span>
              <span>41,600 Max</span>
            </div>
          </div>
        </div>

        {/* Inferred Latches */}
        <div
          className={`border rounded-lg p-3 flex flex-col justify-between ${
            inferredLatchCount > 0
              ? 'bg-amber-950/20 border-amber-600/50'
              : 'bg-[#121820] border-[#1f2937]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Inferred Latches</span>
            <AlertTriangle
              className={`w-4 h-4 ${inferredLatchCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}
            />
          </div>
          <div className="my-2">
            <div
              className={`text-2xl font-bold font-mono ${
                inferredLatchCount > 0 ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {inferredLatchCount}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {inferredLatchCount > 0 ? 'LDCE Cells (Unwanted)' : '0 Transparent Latches'}
            </div>
          </div>
          <div className="text-[10px] font-mono font-semibold">
            {inferredLatchCount > 0 ? (
              <span className="text-amber-400">RISK: Timing glitches</span>
            ) : (
              <span className="text-emerald-400">PASS: Pure synchronous</span>
            )}
          </div>
        </div>

        {/* I/O Pin Count */}
        <div className="bg-[#121820] border border-[#1f2937] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Bonded I/O Pins</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-slate-100">{ioCount}</div>
            <div className="text-[11px] text-slate-500 font-mono">IBUF + OBUF</div>
          </div>
          <div>
            <div className="w-full bg-[#1a222d] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full"
                style={{ width: `${Math.max(1, parseFloat(ioPercent))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>{ioPercent}% used</span>
              <span>106 Max</span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Synthesis Log Output */}
      <div className="flex-1 flex flex-col min-h-[140px] bg-[#0e141c] rounded-lg border border-[#1f2937] overflow-hidden">
        <div className="h-7 px-3 bg-[#121820] border-b border-[#1f2937] flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400 uppercase">
          <span>Vivado Synthesis Log Stream</span>
          <span className="text-[10px] text-slate-500">ASCII Text Report</span>
        </div>
        <div className="flex-1 overflow-auto p-3 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre bg-[#0b0e14]">
          {rawReport}
        </div>
      </div>
    </div>
  );
};
