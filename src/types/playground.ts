// Core TypeScript types and data contracts for Verilog Studio

export type FileType = 'design' | 'testbench' | 'constraints' | 'log';

export interface ProjectFile {
  id: string;
  name: string;
  type: FileType;
  content: string;
  isReadOnly?: boolean;
}

export type LogicLevel = '0' | '1' | 'x' | 'z';

export interface SignalSample {
  time: number;          // Time in simulation base units (nanoseconds)
  value: string;         // '0', '1', 'x', 'z', or bitstring / hex value
}

export type RadixType = 'bin' | 'hex' | 'dec' | 'oct';

export interface WaveSignal {
  id: string;
  name: string;
  scope: string;         // e.g. "/tb" or "/tb/uut"
  width: number;         // 1 for single-bit wires/regs, >1 for multi-bit vectors
  radix: RadixType;
  samples: SignalSample[];
  direction?: 'input' | 'output' | 'inout' | 'internal';
  netType?: 'wire' | 'reg' | 'logic';
}

export interface ScopeNode {
  name: string;
  fullPath: string;      // e.g. "/tb" or "/tb/uut"
  moduleName: string;
  signals: WaveSignal[];
  children: ScopeNode[];
}

export type SimulationStatus = 'idle' | 'running' | 'done' | 'error';

export interface SimulationResult {
  status: SimulationStatus;
  maxTime: number;
  signals: WaveSignal[];
  scopeTree: ScopeNode[];
  logs: ConsoleMessage[];
  error?: string;
}

export interface SynthesisMetrics {
  topModule: string;
  lut4Count: number;
  lut6Count: number;
  fdreCount: number;
  totalLuts: number;
  totalRegisters: number;
  inferredLatchCount: number;
  inferredLatches: string[];
  ioCount: number;
  combLoopDetected: boolean;
  warnings: string[];
  rawReport: string;
  timestamp: string;
}

export interface ConsoleMessage {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'cmd';
  source?: 'SIM' | 'SYNTH' | 'TCL' | 'SYSTEM';
  text: string;
}

export interface PresetDesign {
  id: string;
  title: string;
  description: string;
  designCode: string;
  testbenchCode: string;
}

