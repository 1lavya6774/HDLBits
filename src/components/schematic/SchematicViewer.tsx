'use client';

import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Cpu,
  Layers,
  Zap,
  Info,
  Layers2,
  CheckCircle,
} from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';

interface ExtractedPort {
  name: string;
  width: number;
  direction: 'input' | 'output';
}

function parseModuleInfo(verilogCode: string) {
  const clean = verilogCode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  const modMatch = clean.match(/\bmodule\s+([a-zA-Z_][a-zA-Z0-9_$]*)/);
  const topModule = modMatch ? modMatch[1] : 'top_module';

  const isSequential = /\balways\s*@\s*\(\s*(?:posedge|negedge)\b/.test(clean);

  const inputs: ExtractedPort[] = [];
  const outputs: ExtractedPort[] = [];
  const seen = new Set<string>();

  const portRegex = /\b(input|output)\s+(?:reg|wire)?\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([a-zA-Z_][a-zA-Z0-9_$]*)/g;
  let pm: RegExpExecArray | null;
  while ((pm = portRegex.exec(clean)) !== null) {
    const dir = pm[1] as 'input' | 'output';
    const msb = pm[2] ? parseInt(pm[2], 10) : 0;
    const lsb = pm[3] ? parseInt(pm[3], 10) : 0;
    const width = Math.abs(msb - lsb) + 1;
    const name = pm[4];
    if (!seen.has(name)) {
      seen.add(name);
      if (dir === 'input') inputs.push({ name, width, direction: 'input' });
      else outputs.push({ name, width, direction: 'output' });
    }
  }

  // Parse continuous assignments: assign lhs = rhs;
  const assigns: { lhs: string; rhs: string }[] = [];
  const assignRegex = /\bassign\s+([a-zA-Z_][a-zA-Z0-9_$]*)\s*=\s*([^;]+);/g;
  let am: RegExpExecArray | null;
  while ((am = assignRegex.exec(clean)) !== null) {
    assigns.push({ lhs: am[1].trim(), rhs: am[2].trim() });
  }

  return { topModule, isSequential, inputs, outputs, assigns };
}

export const SchematicViewer: React.FC = () => {
  const { files, synthesisMetrics } = usePlayground();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const designFile = files.find((f) => f.id === 'design.v');
  const code = designFile ? designFile.content : '';

  const { topModule, isSequential, inputs, outputs, assigns } = parseModuleInfo(code);

  const ffCount = synthesisMetrics?.fdreCount ?? (isSequential ? 4 : 0);
  const lutCount = synthesisMetrics?.totalLuts ?? (isSequential ? 4 : Math.max(1, outputs.length));
  const latchCount = synthesisMetrics?.inferredLatchCount ?? 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    startPan.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - startPan.current.x,
      y: e.clientY - startPan.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Safe defaults if empty ports
  const displayInputs = inputs.length > 0 ? inputs : [
    { name: 'clk', width: 1, direction: 'input' as const },
    { name: 'rst_n', width: 1, direction: 'input' as const },
  ];
  const displayOutputs = outputs.length > 0 ? outputs : [
    { name: 'out', width: 1, direction: 'output' as const },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e14] overflow-hidden select-none relative">
      {/* Controls Bar */}
      <div className="h-8 bg-[#121820] border-b border-[#1f2937] px-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Layers2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-300">
            RTL Schematic: {topModule}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a222d] text-cyan-300 border border-[#232d3b]">
            {ffCount} FFs | {lutCount} LUTs {latchCount > 0 ? `| ${latchCount} Latches` : ''}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0f172a] text-slate-400 border border-[#1e293b]">
            {isSequential ? 'Sequential RTL' : 'Combinational Logic'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.2))}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a222d] hover:bg-[#232d3b] text-xs font-mono text-slate-300 hover:text-white border border-[#232d3b]"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Interactive SVG Diagram Canvas */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 w-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-[#090c10]"
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Subtle grid pattern */}
          <defs>
            <pattern id="schematicGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="0.75" fill="#1e293b" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#schematicGrid)" />

          <g transform="translate(100, 50)">
            {/* Top Module Boundary Box */}
            <rect
              x="0"
              y="0"
              width={isSequential ? 720 : 660}
              height={Math.max(340, Math.max(displayInputs.length, displayOutputs.length) * 60 + 120)}
              rx="8"
              fill="#101721"
              stroke="#232d3b"
              strokeWidth="2"
            />

            {/* Title Badge */}
            <rect x="20" y="16" width="240" height="26" rx="4" fill="#16202c" stroke="#334155" />
            <text x="30" y="33" fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
              MODULE: {topModule} ({isSequential ? 'Sequential' : 'Combinational'})
            </text>

            {/* ============================================================== */}
            {/* A. COMBINATIONAL CIRCUIT (e.g. Full Adder, Gates, ALU)        */}
            {/* ============================================================== */}
            {!isSequential ? (
              <g transform="translate(30, 70)">
                {/* Inputs Column */}
                <g>
                  {displayInputs.map((inp, idx) => {
                    const y = 35 + idx * 55;
                    return (
                      <g key={inp.name}>
                        <text
                          x="0"
                          y={y - 8}
                          fill="#10b981"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {inp.name.toUpperCase()} {inp.width > 1 ? `[${inp.width - 1}:0]` : ''}
                        </text>
                        {/* Wire */}
                        <line
                          x1="0"
                          y1={y}
                          x2="140"
                          y2={y}
                          stroke="#10b981"
                          strokeWidth={inp.width > 1 ? 3 : 2}
                        />
                        <polygon points={`0,${y} 6,${y - 4} 6,${y + 4}`} fill="#10b981" />
                        <circle cx="140" cy={y} r="3" fill="#10b981" />
                      </g>
                    );
                  })}
                </g>

                {/* Logic Cells in Middle */}
                <g transform="translate(180, 0)">
                  {displayOutputs.map((out, idx) => {
                    const y = 20 + idx * 110;
                    const assignMatch = assigns.find((a) => a.lhs === out.name);
                    const formula = assignMatch ? assignMatch.rhs : `${out.name} logic`;

                    // Detect logic type
                    const isXor = formula.includes('^');
                    const isMajority = formula.includes('&') && formula.includes('|');
                    const label = isXor ? 'XOR Gate (LUT)' : isMajority ? 'Majority / Carry (LUT)' : 'Logic Cell (LUT)';

                    return (
                      <g key={out.name} transform={`translate(0, ${y})`}>
                        {/* Cell box */}
                        <rect
                          x="0"
                          y="0"
                          width="240"
                          height="90"
                          rx="6"
                          fill="#121d2a"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        {/* Cell Header */}
                        <text x="14" y="22" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                          LUT: {out.name.toUpperCase()}
                        </text>
                        <text x="14" y="38" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                          {label}
                        </text>

                        {/* Formula snippet */}
                        <rect x="12" y="46" width="216" height="30" rx="4" fill="#0b121a" stroke="#1f2937" />
                        <text x="20" y="66" fill="#34d399" fontSize="10" fontFamily="monospace">
                          {formula.length > 26 ? formula.slice(0, 24) + '...' : formula}
                        </text>

                        {/* Connection from Input bus to this LUT */}
                        <line x1="-40" y1="45" x2="0" y2="45" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />

                        {/* Output wire connecting to Output port */}
                        <line x1="240" y1="45" x2="310" y2="45" stroke="#38bdf8" strokeWidth={out.width > 1 ? 3 : 2} />
                        <circle cx="240" cy="45" r="3" fill="#38bdf8" />
                      </g>
                    );
                  })}
                </g>

                {/* Outputs Column */}
                <g transform="translate(490, 0)">
                  {displayOutputs.map((out, idx) => {
                    const y = 65 + idx * 110;
                    return (
                      <g key={out.name}>
                        <line
                          x1="0"
                          y1={y}
                          x2="90"
                          y2={y}
                          stroke="#38bdf8"
                          strokeWidth={out.width > 1 ? 3 : 2}
                        />
                        <polygon points={`90,${y} 82,${y - 4} 82,${y + 4}`} fill="#38bdf8" />
                        <text
                          x="98"
                          y={y + 4}
                          fill="#38bdf8"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {out.name.toUpperCase()} {out.width > 1 ? `[${out.width - 1}:0]` : ''}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            ) : (
              /* ============================================================== */
              /* B. SEQUENTIAL CIRCUIT (e.g. Counter, FSM, Shift Register)      */
              /* ============================================================== */
              <g transform="translate(40, 80)">
                {/* Inputs Column */}
                <g>
                  {displayInputs.map((inp, idx) => {
                    const y = 20 + idx * 45;
                    const isClk = inp.name.toLowerCase().includes('clk');
                    const isRst = inp.name.toLowerCase().includes('rst');
                    const color = isClk ? '#10b981' : isRst ? '#f59e0b' : '#38bdf8';
                    return (
                      <g key={inp.name}>
                        <text
                          x="-30"
                          y={y - 4}
                          fill={color}
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {inp.name.toUpperCase()}
                        </text>
                        <line x1="-5" y1={y} x2="60" y2={y} stroke={color} strokeWidth="2" />
                        <polygon points={`-5,${y} 0,${y - 3} 0,${y + 3}`} fill={color} />
                      </g>
                    );
                  })}
                </g>

                {/* Combinational Logic Block (LUT / Next-State) */}
                <g transform="translate(140, 20)">
                  <rect
                    x="0"
                    y="0"
                    width="140"
                    height="160"
                    rx="6"
                    fill="#121d2a"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <text x="18" y="24" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    NEXT-STATE
                  </text>
                  <text x="18" y="42" fill="#64748b" fontSize="9" fontFamily="monospace">
                    (Combinational LUT)
                  </text>

                  {/* Internal Gate Icon */}
                  <circle cx="70" cy="85" r="22" fill="#182637" stroke="#38bdf8" strokeWidth="1.2" />
                  <text x="61" y="90" fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
                    f(x)
                  </text>

                  {/* Ports */}
                  <circle cx="0" cy="40" r="3" fill="#38bdf8" />
                  <circle cx="0" cy="90" r="3" fill="#38bdf8" />
                  <circle cx="140" cy="80" r="3" fill="#38bdf8" />
                  <text x="110" y="76" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                    D
                  </text>
                </g>

                {/* Routing Bus */}
                <line x1="280" y1="100" x2="350" y2="100" stroke="#38bdf8" strokeWidth="3" />

                {/* Sequential Register Block (FDRE / Flip-Flops) */}
                <g transform="translate(350, 20)">
                  <rect
                    x="0"
                    y="0"
                    width="150"
                    height="160"
                    rx="6"
                    fill="#0f231c"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                  <text x="18" y="24" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    REG (FDRE x{ffCount})
                  </text>
                  <text x="18" y="42" fill="#64748b" fontSize="9" fontFamily="monospace">
                    Sequential State
                  </text>

                  {/* Clock Arrow */}
                  <polygon points="0,110 12,118 0,126" fill="none" stroke="#10b981" strokeWidth="1.5" />
                  <text x="16" y="122" fill="#10b981" fontSize="9" fontFamily="monospace">
                    CLK
                  </text>

                  {/* Pins */}
                  <circle cx="0" cy="80" r="3" fill="#38bdf8" />
                  <text x="12" y="84" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                    D
                  </text>

                  <circle cx="150" cy="80" r="3" fill="#10b981" />
                  <text x="120" y="84" fill="#10b981" fontSize="9" fontFamily="monospace">
                    Q
                  </text>
                </g>

                {/* Feedback Wire to LUT */}
                <path
                  d="M 500 100 L 530 100 L 530 210 L 210 210 L 210 180"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <text x="320" y="225" fill="#64748b" fontSize="9" fontFamily="monospace">
                  Feedback State Net
                </text>

                {/* Output Ports */}
                <g transform="translate(500, 100)">
                  {displayOutputs.map((out, idx) => {
                    const y = idx * 30;
                    return (
                      <g key={out.name} transform={`translate(0, ${y})`}>
                        <line x1="0" y1="0" x2="110" y2="0" stroke="#10b981" strokeWidth={out.width > 1 ? 3 : 2} />
                        <polygon points="110,0 102,-4 102,4" fill="#10b981" />
                        <text x="120" y="4" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="bold">
                          {out.name.toUpperCase()} {out.width > 1 ? `[${out.width - 1}:0]` : ''}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            )}

            {/* If Inferred Latches detected */}
            {latchCount > 0 && (
              <g transform="translate(180, 280)">
                <rect x="0" y="0" width="300" height="32" rx="4" fill="#451a03" stroke="#f59e0b" />
                <text x="12" y="21" fill="#fde68a" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  [!] INFERRED LATCH DETECTED (LDCE)
                </text>
              </g>
            )}
          </g>
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-[#121820]/90 border border-[#232d3b] p-2.5 rounded text-[10px] font-mono flex items-center gap-4 text-slate-300 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span>Registers (FDRE)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
            <span>Logic LUTs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-400" />
            <span>Latches</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-cyan-400" />
            <span>Multi-bit Bus</span>
          </div>
        </div>
      </div>
    </div>
  );
};
