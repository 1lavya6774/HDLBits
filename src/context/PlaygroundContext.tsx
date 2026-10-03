'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  ProjectFile,
  WaveSignal,
  ScopeNode,
  ConsoleMessage,
  SynthesisMetrics,
  SimulationStatus,
  RadixType,
} from '@/types/playground';
import { INITIAL_FILES, PRESET_DESIGNS } from '@/lib/defaults';
import { VerilogSimulator } from '@/lib/simulation/simulator';
import { VerilogSynthesizer } from '@/lib/synthesis/synthesizer';
import { createEdaZipPackage, downloadBlob, extractModuleName } from '@/lib/export/zipPackager';
import { generateAutoTestbench } from '@/lib/harness/autoHarness';

interface PlaygroundContextType {
  files: ProjectFile[];
  activeFileId: string;
  activeLowerTab: 'waveform' | 'schematic' | 'synthesis';
  simStatus: SimulationStatus;
  cursorTime: number; // in ns
  zoom: number;       // px per ns
  scrollLeft: number;
  signals: WaveSignal[];
  scopeTree: ScopeNode[];
  logs: ConsoleMessage[];
  synthesisMetrics: SynthesisMetrics | null;
  maxSimTime: number;
  activePresetId: string;
  upperHeightPercent: number;
  isAutoDriverMode: boolean;
  
  // Actions
  updateFileContent: (id: string, content: string) => void;
  setActiveFileId: (id: string) => void;
  setActiveLowerTab: (tab: 'waveform' | 'schematic' | 'synthesis') => void;
  setCursorTime: (time: number) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setScrollLeft: (scroll: number | ((prev: number) => number)) => void;
  setUpperHeightPercent: (h: number) => void;
  setIsAutoDriverMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  runSimulation: (maxTime?: number) => Promise<void>;
  runSynthesis: () => Promise<void>;
  exportZip: () => Promise<void>;
  loadPreset: (presetId: string) => void;
  executeTclCommand: (cmd: string) => void;
  clearLogs: () => void;
  toggleSignalRadix: (signalId: string, radix?: RadixType) => void;
}

const PlaygroundContext = createContext<PlaygroundContextType | undefined>(undefined);

export const PlaygroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<ProjectFile[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('design.v');
  const [activeLowerTab, setActiveLowerTab] = useState<'waveform' | 'schematic' | 'synthesis'>('waveform');
  const [simStatus, setSimStatus] = useState<SimulationStatus>('idle');
  const [cursorTime, setCursorTime] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(6); // 6px per ns default
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [signals, setSignals] = useState<WaveSignal[]>([]);
  const [scopeTree, setScopeTree] = useState<ScopeNode[]>([]);
  const [logs, setLogs] = useState<ConsoleMessage[]>([]);
  const [synthesisMetrics, setSynthesisMetrics] = useState<SynthesisMetrics | null>(null);
  const [maxSimTime, setMaxSimTime] = useState<number>(200);
  const [activePresetId, setActivePresetId] = useState<string>('counter-4bit');
  const [upperHeightPercent, setUpperHeightPercent] = useState<number>(45);
  const [isAutoDriverMode, setIsAutoDriverMode] = useState<boolean>(true);

  const simWorkerRef = useRef<Worker | null>(null);

  const addLog = useCallback((
    source: 'SIM' | 'SYNTH' | 'TCL' | 'SYSTEM',
    level: 'info' | 'warn' | 'error' | 'success' | 'cmd',
    text: string
  ) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source,
        level,
        text,
      },
    ]);
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content } : f))
    );
  }, []);

  // Run discrete simulation (with Auto-Driver support)
  const runSimulation = useCallback(async (customMaxTime?: number) => {
    const designFile = files.find((f) => f.id === 'design.v');
    let tbFile = files.find((f) => f.id === 'testbench.v');

    if (!designFile) {
      addLog('SYSTEM', 'error', 'Missing design.v');
      return;
    }

    // Auto-Harness Generation if Auto-Driver Mode is ON
    let effectiveTb = tbFile ? tbFile.content : '';
    if (isAutoDriverMode) {
      const harness = generateAutoTestbench(designFile.content);
      effectiveTb = harness.testbenchCode;
      updateFileContent('testbench.v', effectiveTb);
      addLog(
        'SIM',
        'info',
        `[Auto-Harness] Synthesized testbench for '${harness.moduleName}' (${
          harness.isSequential ? 'Sequential Mode: Clock & Reset' : 'Combinational Mode: Truth Table'
        }).`
      );
    }

    setSimStatus('running');
    addLog('SIM', 'cmd', `run_simulation -mode behavioral -runtime ${customMaxTime || maxSimTime}ns`);

    try {
      if (typeof window !== 'undefined' && window.Worker) {
        if (!simWorkerRef.current) {
          try {
            simWorkerRef.current = new Worker(
              new URL('../workers/sim.worker.ts', import.meta.url)
            );
          } catch (e) {
            simWorkerRef.current = null;
          }
        }
      }

      if (simWorkerRef.current) {
        const worker = simWorkerRef.current;
        worker.onmessage = (e: MessageEvent) => {
          const { type, result, error } = e.data;
          if (type === 'SIM_COMPLETE' && result) {
            setSignals(result.signals || []);
            setScopeTree(result.scopeTree || []);
            setMaxSimTime(result.maxTime || 200);
            if (result.logs) {
              setLogs((prev) => [...prev, ...result.logs]);
            }
            if (result.error) {
              setSimStatus('error');
              addLog('SIM', 'error', result.error);
            } else {
              setSimStatus('done');
              addLog('SIM', 'success', `Simulation completed. Resolved ${result.signals.length} nets over ${result.maxTime.toFixed(1)}ns.`);
            }
          } else if (type === 'SIM_ERROR') {
            setSimStatus('error');
            addLog('SIM', 'error', error || 'Simulation failed.');
          }
        };

        worker.postMessage({
          type: 'RUN_SIM',
          design: designFile.content,
          testbench: effectiveTb,
          options: { maxSimTime: customMaxTime || maxSimTime },
        });
      } else {
        const simulator = new VerilogSimulator();
        const result = simulator.run(designFile.content, effectiveTb, {
          maxSimTime: customMaxTime || maxSimTime,
        });

        setSignals(result.signals || []);
        setScopeTree(result.scopeTree || []);
        setMaxSimTime(result.maxTime || 200);
        if (result.logs) {
          setLogs((prev) => [...prev, ...result.logs]);
        }
        if (result.error) {
          setSimStatus('error');
          addLog('SIM', 'error', result.error);
        } else {
          setSimStatus('done');
          addLog('SIM', 'success', `Simulation completed. Resolved ${result.signals.length} nets over ${result.maxTime.toFixed(1)}ns.`);
        }
      }
    } catch (err: any) {
      setSimStatus('error');
      addLog('SIM', 'error', err?.message || String(err));
    }
  }, [files, maxSimTime, isAutoDriverMode, addLog, updateFileContent]);

  // Run Synthesis and Latch Inference Check
  const runSynthesis = useCallback(async () => {
    const designFile = files.find((f) => f.id === 'design.v');
    if (!designFile) return;

    addLog('SYNTH', 'cmd', 'synth_design -top auto -part xc7a35tcpg236-1');

    try {
      const synthesizer = new VerilogSynthesizer();
      const metrics = synthesizer.synthesize(designFile.content);

      setSynthesisMetrics(metrics);
      setActiveLowerTab('synthesis');

      updateFileContent('synth.log', metrics.rawReport);

      for (const w of metrics.warnings) {
        addLog('SYNTH', 'warn', w);
      }

      if (metrics.inferredLatchCount > 0) {
        addLog('SYNTH', 'warn', `[Synth 8-327] Inferring latch for variable '${metrics.inferredLatches.join(', ')}'`);
      }

      addLog(
        'SYNTH',
        'success',
        `Synthesis finished. Used: ${metrics.totalLuts} LUTs (${metrics.lut4Count} LUT4, ${metrics.lut6Count} LUT6), ${metrics.fdreCount} FDRE registers.`
      );
    } catch (err: any) {
      addLog('SYNTH', 'error', `Synthesis failed: ${err?.message || String(err)}`);
    }
  }, [files, addLog, updateFileContent]);

  // 1-Click EDA Export Pipeline
  const exportZip = useCallback(async () => {
    const designFile = files.find((f) => f.id === 'design.v');
    const tbFile = files.find((f) => f.id === 'testbench.v');

    if (!designFile || !tbFile) {
      addLog('SYSTEM', 'error', 'Cannot export: design.v or testbench.v missing.');
      return;
    }

    addLog('SYSTEM', 'cmd', 'export_eda_package -vivado -quartus');

    try {
      const topModule = extractModuleName(designFile.content, 'top_module');
      const zipBlob = await createEdaZipPackage(designFile.content, tbFile.content);
      const filename = `${topModule}_eda_package.zip`;

      downloadBlob(zipBlob, filename);
      addLog('SYSTEM', 'success', `Generated 1-Click EDA ZIP: '${filename}' (includes Vivado & Quartus Tcl scripts).`);
    } catch (err: any) {
      addLog('SYSTEM', 'error', `Failed to generate ZIP package: ${err?.message || String(err)}`);
    }
  }, [files, addLog]);

  // Load Presets
  const loadPreset = useCallback((presetId: string) => {
    const preset = PRESET_DESIGNS.find((p) => p.id === presetId);
    if (!preset) return;

    setActivePresetId(presetId);
    setFiles([
      { id: 'design.v', name: 'design.v', type: 'design', content: preset.designCode },
      { id: 'testbench.v', name: 'testbench.v', type: 'testbench', content: preset.testbenchCode },
      {
        id: 'synth.log',
        name: 'synth.log',
        type: 'log',
        content: `// Verilog Studio Synthesis Engine\n// Loaded preset '${preset.title}'. Click 'Synthesize' to regenerate report.\n`,
        isReadOnly: true,
      },
    ]);
    setActiveFileId('design.v');
    setCursorTime(0);
    addLog('SYSTEM', 'info', `Loaded preset '${preset.title}'`);
  }, [addLog]);

  // Execute Vivado Tcl Shell Commands
  const executeTclCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLog('TCL', 'cmd', `Vivado% ${trimmed}`);

    const parts = trimmed.split(/\s+/);
    const op = parts[0].toLowerCase();

    switch (op) {
      case 'run': {
        const timeArg = parts[1] || '100ns';
        const num = parseInt(timeArg.replace(/[^0-9]/g, ''), 10) || 100;
        runSimulation(num);
        break;
      }
      case 'restart': {
        setCursorTime(0);
        addLog('TCL', 'info', 'Simulation time reset to 0.00ns.');
        break;
      }
      case 'synth_design': {
        runSynthesis();
        break;
      }
      case 'report_utilization': {
        if (synthesisMetrics) {
          addLog('TCL', 'info', `LUTs: ${synthesisMetrics.totalLuts} | Registers: ${synthesisMetrics.totalRegisters} | Latches: ${synthesisMetrics.inferredLatchCount}`);
        } else {
          runSynthesis();
        }
        break;
      }
      case 'export': {
        exportZip();
        break;
      }
      case 'clear': {
        setLogs([]);
        break;
      }
      case 'help': {
        addLog('TCL', 'info', `Supported Tcl Commands:
  run [time]          - Simulate for specified duration (e.g., 'run 200ns')
  restart             - Reset simulation cursor to 0ns
  synth_design        - Execute logic synthesis and latch auditing
  report_utilization  - Display FPGA cell resource metrics
  export              - Download 1-Click EDA ZIP bundle
  clear               - Clear console history
  help                - Display this list of shell commands`);
        break;
      }
      default: {
        addLog('TCL', 'error', `Unknown Tcl command: '${op}'. Type 'help' for available commands.`);
      }
    }
  }, [runSimulation, runSynthesis, exportZip, synthesisMetrics, addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const toggleSignalRadix = useCallback((signalId: string, radix?: RadixType) => {
    setSignals((prev) =>
      prev.map((s) => {
        if (s.id !== signalId) return s;
        const nextRadix = radix || (s.radix === 'hex' ? 'dec' : s.radix === 'dec' ? 'bin' : 'hex');
        return { ...s, radix: nextRadix };
      })
    );
  }, []);

  useEffect(() => {
    addLog('SYSTEM', 'info', 'Verilog Studio v1.0.0 Ready. "Dark Silicon" theme initialized.');
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlaygroundContext.Provider
      value={{
        files,
        activeFileId,
        activeLowerTab,
        simStatus,
        cursorTime,
        zoom,
        scrollLeft,
        signals,
        scopeTree,
        logs,
        synthesisMetrics,
        maxSimTime,
        activePresetId,
        upperHeightPercent,
        isAutoDriverMode,
        updateFileContent,
        setActiveFileId,
        setActiveLowerTab,
        setCursorTime,
        setZoom,
        setScrollLeft,
        setUpperHeightPercent,
        setIsAutoDriverMode,
        runSimulation,
        runSynthesis,
        exportZip,
        loadPreset,
        executeTclCommand,
        clearLogs,
        toggleSignalRadix,
      }}
    >
      {children}
    </PlaygroundContext.Provider>
  );
};

export const usePlayground = () => {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlayground must be used within a PlaygroundProvider');
  }
  return context;
};

