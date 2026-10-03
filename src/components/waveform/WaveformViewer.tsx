'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  SkipBack,
  SkipForward,
  Clock,
  Eye,
} from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';
import { WaveSignal } from '@/types/playground';

export const WaveformViewer: React.FC = () => {
  const {
    signals,
    cursorTime,
    setCursorTime,
    zoom,
    setZoom,
    scrollLeft,
    setScrollLeft,
    maxSimTime,
    toggleSignalRadix,
  } = usePlayground();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCursor = useRef<boolean>(false);
  const isPanning = useRef<boolean>(false);
  const lastMouseX = useRef<number>(0);

  const TRACK_HEIGHT = 32;
  const HEADER_HEIGHT = 28;
  const LABEL_WIDTH = 180; // Left sticky label column

  // Draw the entire waveform canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Retina High-DPI scaling
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const waveAreaWidth = width - LABEL_WIDTH;

    // Clear canvas with Base canvas background
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, width, height);

    if (signals.length === 0) {
      ctx.fillStyle = '#475569';
      ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No simulation trace available. Click "Run Simulation" above.', width / 2, height / 2);
      return;
    }

    // --- 1. Draw Time Ruler Header Background ---
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT);
    ctx.lineTo(width, HEADER_HEIGHT);
    ctx.stroke();

    // Time Ruler Grids & Ticks
    const timePerMajorTick = zoom > 15 ? 5 : zoom > 5 ? 10 : zoom > 2 ? 20 : 50; // in ns
    const startT = Math.max(0, Math.floor(scrollLeft / zoom / timePerMajorTick) * timePerMajorTick);
    const endT = (scrollLeft + waveAreaWidth) / zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(LABEL_WIDTH, 0, waveAreaWidth, height);
    ctx.clip();

    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (let t = startT; t <= endT; t += timePerMajorTick) {
      const x = LABEL_WIDTH + (t * zoom - scrollLeft);

      // Major grid line across all tracks
      ctx.strokeStyle = '#16202c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Tick on ruler
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(x, HEADER_HEIGHT - 6);
      ctx.lineTo(x, HEADER_HEIGHT);
      ctx.stroke();

      // Time label
      ctx.fillText(`${t} ns`, x, HEADER_HEIGHT - 8);

      // Minor tick halfway
      const minorX = x + (timePerMajorTick * zoom) / 2;
      if (minorX < width) {
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(minorX, HEADER_HEIGHT - 3);
        ctx.lineTo(minorX, HEADER_HEIGHT);
        ctx.stroke();
      }
    }
    ctx.restore();

    // --- 2. Draw Signal Waveform Tracks ---
    signals.forEach((sig, idx) => {
      const trackTop = HEADER_HEIGHT + idx * TRACK_HEIGHT;

      // Track alternating background
      ctx.fillStyle = idx % 2 === 0 ? '#0b0e14' : '#0e131a';
      ctx.fillRect(LABEL_WIDTH, trackTop, waveAreaWidth, TRACK_HEIGHT);

      // Track bottom border
      ctx.strokeStyle = '#161e29';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LABEL_WIDTH, trackTop + TRACK_HEIGHT);
      ctx.lineTo(width, trackTop + TRACK_HEIGHT);
      ctx.stroke();

      // Track rails:
      // High rail: Top 6px -> trackTop + 6
      // Low rail: Bottom 26px -> trackTop + 26
      // Midline (Z): 16px -> trackTop + 16
      const highY = trackTop + 6;
      const lowY = trackTop + 26;
      const midY = trackTop + 16;

      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL_WIDTH, trackTop, waveAreaWidth, TRACK_HEIGHT);
      ctx.clip();

      const samples = sig.samples;
      const isBus = sig.width > 1;

      for (let sIdx = 0; sIdx < samples.length; sIdx++) {
        const sample = samples[sIdx];
        const nextSample = samples[sIdx + 1];

        const tStart = sample.time;
        const tEnd = nextSample ? nextSample.time : Math.max(maxSimTime, (scrollLeft + waveAreaWidth) / zoom);

        const x1 = LABEL_WIDTH + (tStart * zoom - scrollLeft);
        const x2 = LABEL_WIDTH + (tEnd * zoom - scrollLeft);

        if (x2 < LABEL_WIDTH || x1 > width) continue;

        const val = sample.value;
        const isUnknown = val.toLowerCase().includes('x');
        const isHighZ = val.toLowerCase() === 'z';

        if (!isBus) {
          // --- 1-Bit Logic Signal ---
          if (isHighZ) {
            ctx.strokeStyle = '#eab308';
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x1, midY);
            ctx.lineTo(x2, midY);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (isUnknown) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.fillRect(x1, highY, x2 - x1, lowY - highY);

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, highY);
            ctx.lineTo(x2, highY);
            ctx.moveTo(x1, lowY);
            ctx.lineTo(x2, lowY);
            ctx.stroke();

            ctx.save();
            ctx.beginPath();
            ctx.rect(x1, highY, x2 - x1, lowY - highY);
            ctx.clip();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
            const step = 8;
            for (let hx = x1 - 30; hx < x2 + 30; hx += step) {
              ctx.beginPath();
              ctx.moveTo(hx, lowY);
              ctx.lineTo(hx + (lowY - highY), highY);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            const isHigh = val === '1';
            const y = isHigh ? highY : lowY;

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            if (sIdx > 0) {
              const prevVal = samples[sIdx - 1].value;
              const prevY = prevVal === '1' ? highY : prevVal === 'z' ? midY : lowY;
              ctx.moveTo(x1, prevY);
              ctx.lineTo(x1, y);
            } else {
              ctx.moveTo(x1, y);
            }
            ctx.lineTo(x2, y);
            ctx.stroke();
          }
        } else {
          // --- Multi-Bit Bus Signal (Hexagonal Lozenge) ---
          const boxLeft = Math.max(LABEL_WIDTH, x1);
          const boxRight = Math.min(width, x2);
          const boxWidth = boxRight - boxLeft;

          if (boxWidth > 1) {
            const hexIndent = Math.min(5, (x2 - x1) / 3);

            ctx.beginPath();
            ctx.moveTo(x1 + hexIndent, highY);
            ctx.lineTo(x2 - hexIndent, highY);
            ctx.lineTo(x2, midY);
            ctx.lineTo(x2 - hexIndent, lowY);
            ctx.lineTo(x1 + hexIndent, lowY);
            ctx.lineTo(x1, midY);
            ctx.closePath();

            if (isUnknown) {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            } else {
              ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
            }
            ctx.fill();

            ctx.strokeStyle = isUnknown ? '#ef4444' : '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (boxWidth > 20) {
              let displayVal = val;
              if (!isUnknown && !isHighZ) {
                const n = parseInt(val, 16);
                if (!isNaN(n)) {
                  if (sig.radix === 'dec') displayVal = n.toString(10);
                  else if (sig.radix === 'bin') displayVal = n.toString(2).padStart(sig.width, '0');
                  else displayVal = "h'" + n.toString(16).toUpperCase();
                }
              }

              ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
              ctx.fillStyle = isUnknown ? '#f87171' : '#bae6fd';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(displayVal, (boxLeft + boxRight) / 2, midY);
            }
          }
        }
      }

      ctx.restore();
    });

    // --- 3. Yellow Time Cursor & Top Timestamp Pill ---
    const cursorX = LABEL_WIDTH + (cursorTime * zoom - scrollLeft);

    if (cursorX >= LABEL_WIDTH && cursorX <= width) {
      // 1px yellow vertical line
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();

      // Top timestamp pill: [ 45.00 ns ]
      const pillText = `[ ${cursorTime.toFixed(2)} ns ]`;
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
      const textMetrics = ctx.measureText(pillText);
      const pillWidth = textMetrics.width + 12;
      const pillHeight = 18;
      const pillX = Math.max(LABEL_WIDTH + 4, Math.min(width - pillWidth - 4, cursorX - pillWidth / 2));
      const pillY = 5;

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 3);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillHeight / 2);
    }

    // --- 4. Left Sticky Signal Inspector Header & Names Column ---
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, LABEL_WIDTH, HEADER_HEIGHT);
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(0, 0, LABEL_WIDTH, HEADER_HEIGHT);

    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIGNAL NAME', 12, HEADER_HEIGHT / 2);
    ctx.textAlign = 'right';
    ctx.fillText('RADIX', LABEL_WIDTH - 12, HEADER_HEIGHT / 2);

    signals.forEach((sig, idx) => {
      const trackTop = HEADER_HEIGHT + idx * TRACK_HEIGHT;

      ctx.fillStyle = '#121820';
      ctx.fillRect(0, trackTop, LABEL_WIDTH, TRACK_HEIGHT);

      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, trackTop + TRACK_HEIGHT);
      ctx.lineTo(LABEL_WIDTH, trackTop + TRACK_HEIGHT);
      ctx.moveTo(LABEL_WIDTH, trackTop);
      ctx.lineTo(LABEL_WIDTH, trackTop + TRACK_HEIGHT);
      ctx.stroke();

      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = sig.direction === 'input' ? '#10b981' : sig.direction === 'output' ? '#38bdf8' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(10, trackTop + TRACK_HEIGHT / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      const isBus = sig.width > 1;
      const displayName = isBus ? `${sig.name}[${sig.width - 1}:0]` : sig.name;
      ctx.fillText(displayName, 20, trackTop + TRACK_HEIGHT / 2);

      if (isBus) {
        ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(sig.radix.toUpperCase(), LABEL_WIDTH - 10, trackTop + TRACK_HEIGHT / 2);
      }
    });

  }, [signals, cursorTime, zoom, scrollLeft, maxSimTime]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    lastMouseX.current = e.clientX;

    if (mouseX < LABEL_WIDTH) {
      if (mouseY > HEADER_HEIGHT) {
        const sigIdx = Math.floor((mouseY - HEADER_HEIGHT) / TRACK_HEIGHT);
        const sig = signals[sigIdx];
        if (sig && sig.width > 1) {
          toggleSignalRadix(sig.id);
        }
      }
      return;
    }

    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
      return;
    }

    isDraggingCursor.current = true;
    const clickTime = Math.max(0, (mouseX - LABEL_WIDTH + scrollLeft) / zoom);
    setCursorTime(Math.min(maxSimTime, Math.max(0, clickTime)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const dx = e.clientX - lastMouseX.current;
    lastMouseX.current = e.clientX;

    if (isDraggingCursor.current) {
      const scrubTime = (mouseX - LABEL_WIDTH + scrollLeft) / zoom;
      setCursorTime(Math.min(maxSimTime, Math.max(0, scrubTime)));
    } else if (isPanning.current) {
      setScrollLeft((prev) => Math.max(0, prev - dx));
    }
  };

  const handleMouseUp = () => {
    isDraggingCursor.current = false;
    isPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const mouseX = rect ? e.clientX - rect.left - LABEL_WIDTH : 0;
      const timeAtMouse = (mouseX + scrollLeft) / zoom;

      const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
      const nextZoom = Math.max(1, Math.min(80, zoom * zoomFactor));

      setZoom(nextZoom);
      setScrollLeft(Math.max(0, timeAtMouse * nextZoom - mouseX));
    } else {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setScrollLeft((prev) => Math.max(0, prev + delta));
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(80, prev * 1.3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1, prev / 1.3));
  };

  const handleZoomFit = () => {
    const container = containerRef.current;
    if (!container || maxSimTime <= 0) return;
    const waveAreaWidth = container.clientWidth - LABEL_WIDTH - 20;
    const fitZoom = Math.max(1, waveAreaWidth / maxSimTime);
    setZoom(fitZoom);
    setScrollLeft(0);
  };

  const handleGoToZero = () => {
    setCursorTime(0);
    setScrollLeft(0);
  };

  const handleGoToEnd = () => {
    setCursorTime(maxSimTime);
    const container = containerRef.current;
    if (container) {
      const waveAreaWidth = container.clientWidth - LABEL_WIDTH;
      setScrollLeft(Math.max(0, maxSimTime * zoom - waveAreaWidth / 2));
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e14] overflow-hidden select-none">
      {/* Waveform Controls Bar */}
      <div className="h-8 bg-[#121820] border-b border-[#1f2937] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Timing Cursor:
          </span>
          <span className="font-mono text-xs font-bold text-amber-300 bg-[#0b0e14] px-2 py-0.5 rounded border border-[#232d3b]">
            {cursorTime.toFixed(2)} ns
          </span>
          <span className="text-[10px] text-slate-500 font-mono ml-1">
            (Total: {maxSimTime.toFixed(0)}ns)
          </span>
        </div>

        {/* Navigation & Zoom Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleGoToZero}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Jump to 0.00 ns"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleGoToEnd}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Jump to End of Trace"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-[1px] bg-[#232d3b] mx-1" />

          <button
            onClick={handleZoomIn}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Zoom In (Ctrl + Wheel)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-300 hover:text-white border border-[#232d3b]"
            title="Zoom Out (Ctrl + Wheel)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomFit}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1a222d] hover:bg-[#232d3b] text-xs font-mono text-slate-300 hover:text-white border border-[#232d3b]"
            title="Zoom to Fit Simulation"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full block"
        />
      </div>
    </div>
  );
};
