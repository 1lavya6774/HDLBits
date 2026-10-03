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
import { extractModuleName } from '@/lib/export/zipPackager';

export const SchematicViewer: React.FC = () => {
  const { files, synthesisMetrics, runSynthesis } = usePlayground();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const designFile = files.find((f) => f.id === 'design.v');
  const code = designFile ? designFile.content : '';
  const topModule = extractModuleName(code, 'counter');

  const lutCount = synthesisMetrics?.totalLuts || 4;
  const ffCount = synthesisMetrics?.fdreCount || 4;
  const latchCount = synthesisMetrics?.inferredLatchCount || 0;

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

          <g transform="translate(140, 80)">
            {/* Top Module Boundary */}
            <rect
              x="0"
              y="0"
              width="680"
              height="340"
              rx="8"
              fill="#101721"
              stroke="#232d3b"
              strokeWidth="2"
            />

            {/* Title Badge */}
            <rect x="20" y="16" width="180" height="26" rx="4" fill="#16202c" stroke="#334155" />
            <text x="32" y="33" fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
              MODULE: {topModule}
            </text>

            {/* Inputs Column */}
            <g transform="translate(40, 80)">
              <text x="-25" y="15" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                CLK
              </text>
              <line x1="-5" y1="12" x2="60" y2="12" stroke="#10b981" strokeWidth="2" />
              <polygon points="-5,12 0,9 0,15" fill="#10b981" />

              <text x="-28" y="65" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                RST_N
              </text>
              <line x1="-5" y1="62" x2="60" y2="62" stroke="#10b981" strokeWidth="2" />
              <polygon points="-5,62 0,59 0,65" fill="#10b981" />

              <text x="-32" y="115" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                ENABLE
              </text>
              <line x1="-5" y1="112" x2="60" y2="112" stroke="#10b981" strokeWidth="2" />
              <polygon points="-5,112 0,109 0,115" fill="#10b981" />
            </g>

            {/* Combinational Logic Block (LUT / Next-State) */}
            <g transform="translate(160, 80)">
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
                LUT LOGIC
              </text>
              <text x="18" y="42" fill="#64748b" fontSize="9" fontFamily="monospace">
                (Add / Incr / Mux)
              </text>

              {/* Internal Gate Icon */}
              <circle cx="70" cy="85" r="24" fill="#182637" stroke="#38bdf8" strokeWidth="1.2" />
              <text x="63" y="90" fill="#38bdf8" fontSize="14" fontFamily="monospace" fontWeight="bold">
                +1
              </text>

              {/* Ports */}
              <circle cx="0" cy="40" r="3" fill="#38bdf8" />
              <circle cx="0" cy="90" r="3" fill="#38bdf8" />
              <circle cx="140" cy="80" r="3" fill="#38bdf8" />
              <text x="105" y="76" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                D[3:0]
              </text>
            </g>

            {/* Routing Bus */}
            <line x1="300" y1="160" x2="380" y2="160" stroke="#38bdf8" strokeWidth="3" />
            <text x="325" y="152" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
              [3:0]
            </text>

            {/* Sequential Register Block (FDRE / Flip-Flops) */}
            <g transform="translate(380, 80)">
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
                REG (FDRE x4)
              </text>
              <text x="18" y="42" fill="#64748b" fontSize="9" fontFamily="monospace">
                Sequential State
              </text>

              {/* Pins */}
              <polygon points="0,110 12,118 0,126" fill="none" stroke="#10b981" strokeWidth="1.5" />
              <text x="16" y="122" fill="#10b981" fontSize="9" fontFamily="monospace">
                CLK
              </text>

              <circle cx="0" cy="145" r="3" fill="#10b981" />
              <text x="16" y="148" fill="#10b981" fontSize="9" fontFamily="monospace">
                CLR_N
              </text>

              <circle cx="0" cy="80" r="3" fill="#38bdf8" />
              <text x="12" y="84" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                D[3:0]
              </text>

              <circle cx="150" cy="80" r="3" fill="#10b981" />
              <text x="110" y="84" fill="#10b981" fontSize="9" fontFamily="monospace">
                Q[3:0]
              </text>
            </g>

            {/* Feedback Wire to LUT */}
            <path
              d="M 530 160 L 560 160 L 560 270 L 230 270 L 230 240"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <text x="360" y="285" fill="#64748b" fontSize="9" fontFamily="monospace">
              Feedback Net: count[3:0]
            </text>

            {/* Output Port */}
            <g transform="translate(530, 160)">
              <line x1="0" y1="0" x2="110" y2="0" stroke="#10b981" strokeWidth="3" />
              <polygon points="110,0 102,-5 102,5" fill="#10b981" />
              <text x="120" y="4" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="bold">
                COUNT [3:0]
              </text>
            </g>

            {/* If Inferred Latches detected */}
            {latchCount > 0 && (
              <g transform="translate(200, 290)">
                <rect x="0" y="0" width="280" height="30" rx="4" fill="#451a03" stroke="#f59e0b" />
                <text x="12" y="20" fill="#fde68a" fontSize="10" fontFamily="monospace" fontWeight="bold">
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
