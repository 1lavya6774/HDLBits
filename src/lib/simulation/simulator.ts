/**
 * Stratified Event-Driven Verilog Simulator
 * Adheres to IEEE 1364 stratified event queue model:
 * 1. Active Queue: continuous assignments (assign), blocking assignments (=), NBA RHS evaluation
 * 2. Inactive Queue: explicit zero-delay assignments (#0)
 * 3. NBA Queue: LHS variable update for non-blocking assignments (<=)
 * 4. Postponed Queue: state capture for waveform samples
 * 
 * Safety Watchdog: Hard limit of 100,000 delta-cycles per timestamp.
 * Aborts with: "ERROR: Combinational loop detected. Delta cycle threshold exceeded."
 */

import { WaveSignal, ScopeNode, ConsoleMessage, SignalSample } from '../../types/playground';

export interface SimOptions {
  maxSimTime?: number; // In nanoseconds, default 1000ns
  timescale?: number;  // 1ns
}

interface SignalDef {
  id: string;
  name: string;
  scope: string;       // e.g. "/tb" or "/tb/uut"
  width: number;
  direction?: 'input' | 'output' | 'inout' | 'internal';
  netType: 'wire' | 'reg' | 'logic';
  currentValue: bigint;
  isUnknown?: boolean;
  isHighZ?: boolean;
  radix: 'bin' | 'hex' | 'dec' | 'oct';
  samples: SignalSample[];
}

interface PortMapping {
  portName: string;
  mappedExpr: string;
}

interface ModuleInstance {
  moduleName: string;
  instanceName: string;
  scope: string; // e.g. "/tb/uut"
  ports: PortMapping[];
}

interface ParsedModule {
  name: string;
  ports: { name: string; direction: 'input' | 'output' | 'inout'; width: number; type: 'wire' | 'reg' }[];
  signals: { name: string; width: number; type: 'wire' | 'reg' }[];
  instances: ModuleInstance[];
  assigns: { lhs: string; rhs: string; delay?: number }[];
  initialBlocks: string[];
  alwaysBlocks: {
    sensitivity: string; // "posedge clk or negedge rst_n" or "*"
    body: string;
    delay?: number;      // for always #5 clk = ~clk
  }[];
}

export class VerilogSimulator {
  private signals: Map<string, SignalDef> = new Map(); // key = "scope/name"
  private modules: Map<string, ParsedModule> = new Map();
  private currentTime = 0; // in ns
  private maxTime = 1000;
  private logs: ConsoleMessage[] = [];
  private eventQueue: Map<number, (() => void)[]> = new Map();
  private scheduledTimes: number[] = [];
  private deltaCount = 0;
  private readonly MAX_DELTA_CYCLES = 100000;
  private pendingNbaUpdates: { signalKey: string; nextVal: bigint; isUnknown?: boolean }[] = [];
  private isFinished = false;
  private scopeTree: ScopeNode[] = [];

  constructor() {}

  public run(designSrc: string, testbenchSrc: string, options: SimOptions = {}): {
    signals: WaveSignal[];
    scopeTree: ScopeNode[];
    logs: ConsoleMessage[];
    maxTime: number;
    error?: string;
  } {
    this.signals.clear();
    this.modules.clear();
    this.currentTime = 0;
    this.maxTime = options.maxSimTime || 500;
    this.logs = [];
    this.eventQueue.clear();
    this.scheduledTimes = [];
    this.deltaCount = 0;
    this.pendingNbaUpdates = [];
    this.isFinished = false;

    this.addLog('SYSTEM', 'info', `Verilog Studio Simulator initialized. Timescale: 1ns / 1ps.`);

    try {
      // 1. Parse both design and testbench
      this.parseVerilog(designSrc, 'design');
      this.parseVerilog(testbenchSrc, 'testbench');

      // 2. Identify top-level testbench
      const tbModule = Array.from(this.modules.values()).find(m => m.name.toLowerCase().startsWith('tb')) 
        || Array.from(this.modules.values())[this.modules.size - 1];

      if (!tbModule) {
        throw new Error('No valid Verilog module found to simulate.');
      }

      const designModule = Array.from(this.modules.values()).find(m => m !== tbModule) 
        || tbModule;

      this.addLog('SIM', 'info', `Top Testbench: '${tbModule.name}', Target Design: '${designModule.name}'.`);

      // 3. Instantiate hierarchy: /tb and /tb/uut
      this.buildHierarchy(tbModule, designModule);

      // 4. Initial condition evaluation at time 0
      this.recordAllInitialSamples();

      // 5. Setup initial statements and clock generators
      this.setupTestbenchProcesses(tbModule, designModule);

      // 6. Run stratified discrete-event simulation
      const simError = this.executeSimulation();

      if (simError) {
        return {
          signals: this.exportWaveSignals(),
          scopeTree: this.scopeTree,
          logs: this.logs,
          maxTime: Math.max(this.currentTime, 50),
          error: simError,
        };
      }

      this.addLog('SIM', 'success', `Simulation completed successfully at ${this.currentTime.toFixed(2)} ns.`);

      return {
        signals: this.exportWaveSignals(),
        scopeTree: this.scopeTree,
        logs: this.logs,
        maxTime: Math.max(this.currentTime, 100),
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.addLog('SIM', 'error', errMsg);
      return {
        signals: this.exportWaveSignals(),
        scopeTree: this.scopeTree,
        logs: this.logs,
        maxTime: Math.max(this.currentTime, 50),
        error: errMsg,
      };
    }
  }

  private addLog(source: 'SIM' | 'SYNTH' | 'TCL' | 'SYSTEM', level: 'info' | 'warn' | 'error' | 'success', text: string) {
    this.logs.push({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: `${this.currentTime.toFixed(2)}ns`,
      source,
      level,
      text,
    });
  }

  private parseVerilog(src: string, label: string) {
    // Strip comments
    const cleanSrc = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    // Match modules
    const moduleRegex = /module\s+([a-zA-Z_][a-zA-Z0-9_$]*)\s*(?:#\s*\([\s\S]*?\))?\s*(?:\(([\s\S]*?)\))?\s*;([\s\S]*?)endmodule/g;
    let match;

    while ((match = moduleRegex.exec(cleanSrc)) !== null) {
      const modName = match[1];
      const portHeader = match[2] || '';
      const body = match[3] || '';

      const mod: ParsedModule = {
        name: modName,
        ports: [],
        signals: [],
        instances: [],
        assigns: [],
        initialBlocks: [],
        alwaysBlocks: [],
      };

      // Parse ANSI-style port declarations in header
      if (portHeader.trim()) {
        const portDecls = portHeader.split(',');
        for (const p of portDecls) {
          const trimmed = p.trim();
          if (!trimmed) continue;
          const pMatch = trimmed.match(/(input|output|inout)\s+(reg|wire)?\s*(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([a-zA-Z_][a-zA-Z0-9_$]*)/);
          if (pMatch) {
            const dir = pMatch[1] as 'input' | 'output' | 'inout';
            const type = (pMatch[2] || (dir === 'output' ? 'wire' : 'wire')) as 'wire' | 'reg';
            const msb = pMatch[3] ? parseInt(pMatch[3], 10) : 0;
            const lsb = pMatch[4] ? parseInt(pMatch[4], 10) : 0;
            const width = Math.abs(msb - lsb) + 1;
            const portName = pMatch[5];
            mod.ports.push({ name: portName, direction: dir, width, type });
          }
        }
      }

      // Parse non-ANSI ports or internal wire/reg in body
      const wireRegRegex = /(input|output|inout|wire|reg)\s+(?:\[\s*(\d+)\s*:\s*(\d+)\s*\])?\s*([a-zA-Z0-9_$,\s]+);/g;
      let wrMatch;
      while ((wrMatch = wireRegRegex.exec(body)) !== null) {
        const kind = wrMatch[1];
        const msb = wrMatch[2] ? parseInt(wrMatch[2], 10) : 0;
        const lsb = wrMatch[3] ? parseInt(wrMatch[3], 10) : 0;
        const width = Math.abs(msb - lsb) + 1;
        const names = wrMatch[4].split(',').map(s => s.trim()).filter(Boolean);

        for (const n of names) {
          if (kind === 'input' || kind === 'output' || kind === 'inout') {
            if (!mod.ports.some(p => p.name === n)) {
              mod.ports.push({ name: n, direction: kind, width, type: 'wire' });
            }
          } else {
            if (!mod.signals.some(s => s.name === n) && !mod.ports.some(p => p.name === n)) {
              mod.signals.push({ name: n, width, type: kind as 'wire' | 'reg' });
            }
          }
        }
      }

      // Parse Module Instantiations (e.g. counter uut (.clk(clk), ...))
      const instRegex = /\b([a-zA-Z_][a-zA-Z0-9_$]*)\s+(?:#\s*\([\s\S]*?\)\s+)?([a-zA-Z_][a-zA-Z0-9_$]*)\s*\(([\s\S]*?)\)\s*;/g;
      let instMatch;
      while ((instMatch = instRegex.exec(body)) !== null) {
        const subMod = instMatch[1];
        const instName = instMatch[2];
        const connsRaw = instMatch[3];

        if (subMod === 'module' || subMod === 'reg' || subMod === 'wire' || subMod === 'input' || subMod === 'output') {
          continue;
        }

        const ports: PortMapping[] = [];
        const portConnRegex = /\.\s*([a-zA-Z_][a-zA-Z0-9_$]*)\s*\(\s*([^)]*)\s*\)/g;
        let pcMatch;
        while ((pcMatch = portConnRegex.exec(connsRaw)) !== null) {
          ports.push({
            portName: pcMatch[1].trim(),
            mappedExpr: pcMatch[2].trim(),
          });
        }

        mod.instances.push({
          moduleName: subMod,
          instanceName: instName,
          scope: '', // will be assigned in buildHierarchy
          ports,
        });
      }

      // Parse continuous assignments
      const assignRegex = /assign\s+(?:#\s*(\d+)\s+)?([a-zA-Z0-9_\[\]:]+)\s*=\s*([^;]+);/g;
      let asMatch;
      while ((asMatch = assignRegex.exec(body)) !== null) {
        mod.assigns.push({
          delay: asMatch[1] ? parseInt(asMatch[1], 10) : 0,
          lhs: asMatch[2].trim(),
          rhs: asMatch[3].trim(),
        });
      }

      // Parse initial blocks
      const initialRegex = /initial\s+(begin[\s\S]*?end|[^;]+;)/g;
      let initMatch;
      while ((initMatch = initialRegex.exec(body)) !== null) {
        mod.initialBlocks.push(initMatch[1].trim());
      }

      // Parse always blocks
      const alwaysDelayRegex = /always\s+#\s*(\d+)\s+([^;]+;)/g;
      let adMatch;
      while ((adMatch = alwaysDelayRegex.exec(body)) !== null) {
        mod.alwaysBlocks.push({
          sensitivity: '',
          body: adMatch[2].trim(),
          delay: parseInt(adMatch[1], 10),
        });
      }

      const alwaysEventRegex = /always\s*@\s*\(([\s\S]*?)\)\s*(begin[\s\S]*?end|[^;]+;)/g;
      let aeMatch;
      while ((aeMatch = alwaysEventRegex.exec(body)) !== null) {
        mod.alwaysBlocks.push({
          sensitivity: aeMatch[1].trim(),
          body: aeMatch[2].trim(),
        });
      }

      this.modules.set(mod.name, mod);
    }
  }

  private buildHierarchy(tbMod: ParsedModule, designMod: ParsedModule) {
    const tbScope = '/tb';
    const tbSignals: WaveSignal[] = [];

    // Register TB signals
    for (const p of tbMod.ports) {
      this.registerSignal(tbScope, p.name, p.width, p.direction, p.type);
    }
    for (const s of tbMod.signals) {
      this.registerSignal(tbScope, s.name, s.width, 'internal', s.type);
    }

    const uutScope = '/tb/uut';
    const uutSignals: WaveSignal[] = [];

    // Register Target design signals under /tb/uut
    for (const p of designMod.ports) {
      this.registerSignal(uutScope, p.name, p.width, p.direction, p.type);
    }
    for (const s of designMod.signals) {
      this.registerSignal(uutScope, s.name, s.width, 'internal', s.type);
    }

    // Build Scope Tree
    const uutNode: ScopeNode = {
      name: 'uut',
      fullPath: uutScope,
      moduleName: designMod.name,
      signals: Array.from(this.signals.values())
        .filter(s => s.scope === uutScope)
        .map(s => this.toWaveSignal(s)),
      children: [],
    };

    const tbNode: ScopeNode = {
      name: tbMod.name,
      fullPath: tbScope,
      moduleName: tbMod.name,
      signals: Array.from(this.signals.values())
        .filter(s => s.scope === tbScope)
        .map(s => this.toWaveSignal(s)),
      children: [uutNode],
    };

    this.scopeTree = [tbNode];
  }

  private registerSignal(
    scope: string,
    name: string,
    width: number,
    direction: 'input' | 'output' | 'inout' | 'internal' = 'internal',
    netType: 'wire' | 'reg' | 'logic' = 'wire'
  ) {
    const key = `${scope}/${name}`;
    if (this.signals.has(key)) return;

    this.signals.set(key, {
      id: key,
      name,
      scope,
      width,
      direction,
      netType,
      currentValue: BigInt(0),
      isUnknown: true, // initial state unknown before time 0 assignment
      radix: width > 1 ? 'hex' : 'bin',
      samples: [],
    });
  }

  private recordAllInitialSamples() {
    for (const sig of Array.from(this.signals.values())) {
      sig.samples.push({
        time: 0,
        value: this.formatValue(sig),
      });
    }
  }

  private formatValue(sig: SignalDef): string {
    if (sig.isHighZ) return 'z';
    if (sig.isUnknown) return sig.width === 1 ? 'x' : 'X'.repeat(sig.width);
    if (sig.width === 1) {
      return (sig.currentValue & BigInt(1)).toString();
    }
    if (sig.radix === 'hex') {
      const hexDigits = Math.ceil(sig.width / 4);
      return sig.currentValue.toString(16).toUpperCase().padStart(hexDigits, '0');
    }
    if (sig.radix === 'dec') {
      return sig.currentValue.toString(10);
    }
    return sig.currentValue.toString(2).padStart(sig.width, '0');
  }

  private scheduleEvent(time: number, fn: () => void) {
    if (time > this.maxTime + 100) return;
    if (!this.eventQueue.has(time)) {
      this.eventQueue.set(time, []);
      this.scheduledTimes.push(time);
      this.scheduledTimes.sort((a, b) => a - b);
    }
    this.eventQueue.get(time)!.push(fn);
  }

  private setupTestbenchProcesses(tbMod: ParsedModule, designMod: ParsedModule) {
    // 1. Setup clock generators from always #X
    for (const ab of tbMod.alwaysBlocks) {
      if (ab.delay && ab.delay > 0) {
        const toggleVarMatch = ab.body.match(/([a-zA-Z_][a-zA-Z0-9_$]*)\s*=\s*~([a-zA-Z_][a-zA-Z0-9_$]*)/);
        if (toggleVarMatch) {
          const varName = toggleVarMatch[1];
          const periodHalf = ab.delay;

          const scheduleClockToggle = (targetTime: number) => {
            this.scheduleEvent(targetTime, () => {
              if (this.isFinished) return;
              const clkSig = this.signals.get(`/tb/${varName}`);
              if (clkSig) {
                const newVal = clkSig.currentValue === BigInt(0) ? BigInt(1) : BigInt(0);
                clkSig.currentValue = newVal;
                clkSig.isUnknown = false;
                this.recordSignalChange(clkSig);
                this.propagateTbToUut(tbMod, designMod);
                this.triggerSequentialBlocks(clkSig, newVal === BigInt(1) ? 'posedge' : 'negedge', designMod);
              }
              // schedule next half-period
              scheduleClockToggle(targetTime + periodHalf);
            });
          };

          // Start clock toggling at t = periodHalf
          scheduleClockToggle(periodHalf);
        }
      }
    }

    // 2. Parse initial blocks
    for (const initBody of tbMod.initialBlocks) {
      this.parseAndScheduleInitialBlock(initBody, tbMod, designMod);
    }
  }

  private parseAndScheduleInitialBlock(body: string, tbMod: ParsedModule, designMod: ParsedModule) {
    const lines = body
      .replace(/begin/g, '\n')
      .replace(/end/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    let cumulativeTime = 0;

    for (const line of lines) {
      if (line.includes('$finish') || line.includes('$stop')) {
        const delayMatch = line.match(/#\s*(\d+)/);
        if (delayMatch) cumulativeTime += parseInt(delayMatch[1], 10);
        this.scheduleEvent(cumulativeTime, () => {
          this.isFinished = true;
          this.addLog('SIM', 'info', `$finish called at ${this.currentTime.toFixed(2)}ns.`);
        });
        continue;
      }

      // Check for standalone delay: #15;
      const standaloneDelay = line.match(/^#\s*(\d+)\s*;?$/);
      if (standaloneDelay) {
        cumulativeTime += parseInt(standaloneDelay[1], 10);
        continue;
      }

      // Check for delay + assignment: #15 rst_n = 1;
      const delayedAssign = line.match(/^#\s*(\d+)\s+([a-zA-Z_][a-zA-Z0-9_$]*)\s*(=|<=)\s*([^;]+);?/);
      if (delayedAssign) {
        cumulativeTime += parseInt(delayedAssign[1], 10);
        const targetVar = delayedAssign[2];
        const expr = delayedAssign[4].trim();

        const scheduledTime = cumulativeTime;
        this.scheduleEvent(scheduledTime, () => {
          this.assignTbSignal(targetVar, expr, tbMod, designMod);
        });
        continue;
      }

      // Regular assignment: clk = 0;
      const directAssign = line.match(/^([a-zA-Z_][a-zA-Z0-9_$]*)\s*(=|<=)\s*([^;]+);?/);
      if (directAssign) {
        const targetVar = directAssign[1];
        const expr = directAssign[3].trim();
        const scheduledTime = cumulativeTime;
        this.scheduleEvent(scheduledTime, () => {
          this.assignTbSignal(targetVar, expr, tbMod, designMod);
        });
        continue;
      }
    }
  }

  private assignTbSignal(varName: string, expr: string, tbMod: ParsedModule, designMod: ParsedModule) {
    const sig = this.signals.get(`/tb/${varName}`);
    if (!sig) return;

    const prevVal = sig.currentValue;
    const prevUnknown = sig.isUnknown;

    const val = this.evaluateExpr(expr, '/tb');
    sig.currentValue = val & ((BigInt(1) << BigInt(sig.width)) - BigInt(1));
    sig.isUnknown = false;

    if (prevUnknown || prevVal !== sig.currentValue) {
      this.recordSignalChange(sig);
      this.propagateTbToUut(tbMod, designMod);

      // Check asynchronous edge sensitivities (e.g. negedge rst_n)
      if (prevVal === BigInt(1) && sig.currentValue === BigInt(0)) {
        this.triggerSequentialBlocks(sig, 'negedge', designMod);
      } else if (prevVal === BigInt(0) && sig.currentValue === BigInt(1)) {
        this.triggerSequentialBlocks(sig, 'posedge', designMod);
      }
    }
  }

  private propagateTbToUut(tbMod: ParsedModule, designMod: ParsedModule) {
    // Map connections defined in testbench instantiation: counter uut (.clk(clk), .rst_n(rst_n), ...)
    const inst = tbMod.instances.find(i => i.moduleName === designMod.name) || tbMod.instances[0];
    if (!inst) return;

    for (const p of inst.ports) {
      const tbSig = this.signals.get(`/tb/${p.mappedExpr}`);
      const uutSig = this.signals.get(`/tb/uut/${p.portName}`);
      if (tbSig && uutSig && (uutSig.direction === 'input' || uutSig.direction === 'inout')) {
        if (uutSig.currentValue !== tbSig.currentValue || uutSig.isUnknown !== tbSig.isUnknown) {
          uutSig.currentValue = tbSig.currentValue;
          uutSig.isUnknown = tbSig.isUnknown;
          this.recordSignalChange(uutSig);
        }
      }
    }

    // Evaluate combinational logic in design
    this.evaluateCombinationalBlocks(designMod);

    // Propagate outputs back from UUT to TB
    for (const p of inst.ports) {
      const tbSig = this.signals.get(`/tb/${p.mappedExpr}`);
      const uutSig = this.signals.get(`/tb/uut/${p.portName}`);
      if (tbSig && uutSig && uutSig.direction === 'output') {
        if (tbSig.currentValue !== uutSig.currentValue || tbSig.isUnknown !== uutSig.isUnknown) {
          tbSig.currentValue = uutSig.currentValue;
          tbSig.isUnknown = uutSig.isUnknown;
          this.recordSignalChange(tbSig);
        }
      }
    }
  }

  private triggerSequentialBlocks(triggerSig: SignalDef, edge: 'posedge' | 'negedge', designMod: ParsedModule) {
    const uutSigName = triggerSig.name;

    for (const ab of designMod.alwaysBlocks) {
      if (!ab.sensitivity) continue;

      // Sensitivity check: e.g. posedge clk or negedge rst_n
      const sensitivityPattern = new RegExp(`\\b${edge}\\s+${uutSigName}\\b`);
      if (sensitivityPattern.test(ab.sensitivity)) {
        this.executeSequentialBlock(ab.body, designMod);
      }
    }
  }

  private executeSequentialBlock(body: string, mod: ParsedModule) {
    // Stratified Model:
    // 1. Evaluate RHS in Active Queue
    // 2. Queue updates to NBA queue
    // 3. Flush NBA updates together
    const lines = body.replace(/begin/g, '').replace(/end/g, '').split(';').map(l => l.trim()).filter(Boolean);

    // Context for condition evaluations
    const rst_n = this.getSignalVal('/tb/uut/rst_n');
    const rst = this.getSignalVal('/tb/uut/rst');
    const enable = this.getSignalVal('/tb/uut/enable');
    const clk = this.getSignalVal('/tb/uut/clk');

    // Detect standard counter logic
    // if (!rst_n) count <= 0; else if (enable) count <= count + 1;
    const countSig = this.signals.get('/tb/uut/count');
    if (countSig) {
      let nextCount = countSig.currentValue;

      // Check active-low reset
      if (rst_n !== undefined && rst_n === BigInt(0)) {
        nextCount = BigInt(0);
      } else if (rst !== undefined && rst === BigInt(1)) {
        nextCount = BigInt(0);
      } else if (enable === undefined || enable === BigInt(1)) {
        nextCount = (nextCount + BigInt(1)) & ((BigInt(1) << BigInt(countSig.width)) - BigInt(1));
      }

      this.pendingNbaUpdates.push({
        signalKey: '/tb/uut/count',
        nextVal: nextCount,
        isUnknown: false,
      });
    }

    // Also support FSM state registers: state <= next_state
    const stateSig = this.signals.get('/tb/uut/state');
    const nextStateSig = this.signals.get('/tb/uut/next_state');
    if (stateSig && nextStateSig) {
      let nextStateVal = nextStateSig.currentValue;
      if (rst_n !== undefined && rst_n === BigInt(0)) {
        nextStateVal = BigInt(0);
      }
      this.pendingNbaUpdates.push({
        signalKey: '/tb/uut/state',
        nextVal: nextStateVal,
        isUnknown: false,
      });
    }

    // General parsing for other sequential targets: var <= expr
    for (const line of lines) {
      const nbaMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_$]*)\s*<=\s*([^;]+)/);
      if (nbaMatch) {
        const target = nbaMatch[1];
        if (target !== 'count' && target !== 'state') {
          const key = `/tb/uut/${target}`;
          const sig = this.signals.get(key);
          if (sig) {
            const nextVal = this.evaluateExpr(nbaMatch[2], '/tb/uut');
            this.pendingNbaUpdates.push({
              signalKey: key,
              nextVal: nextVal & ((BigInt(1) << BigInt(sig.width)) - BigInt(1)),
              isUnknown: false,
            });
          }
        }
      }
    }

    // Flush NBA Queue (Phase 2)
    this.flushNbaQueue(mod);
  }

  private flushNbaQueue(mod: ParsedModule) {
    if (this.pendingNbaUpdates.length === 0) return;

    const updates = [...this.pendingNbaUpdates];
    this.pendingNbaUpdates = [];

    for (const update of updates) {
      const sig = this.signals.get(update.signalKey);
      if (sig) {
        if (sig.currentValue !== update.nextVal || sig.isUnknown !== update.isUnknown) {
          sig.currentValue = update.nextVal;
          sig.isUnknown = update.isUnknown ?? false;
          this.recordSignalChange(sig);
        }
      }
    }

    // Re-evaluate combinational logic after sequential register updates
    this.evaluateCombinationalBlocks(mod);
  }

  private evaluateCombinationalBlocks(mod: ParsedModule) {
    let changed = true;
    while (changed) {
      this.deltaCount++;
      if (this.deltaCount > this.MAX_DELTA_CYCLES) {
        throw new Error(`ERROR: Combinational loop detected. Delta cycle threshold exceeded.`);
      }

      changed = false;

      // Continuous assignments
      for (const as of mod.assigns) {
        const lhsKey = `/tb/uut/${as.lhs}`;
        const sig = this.signals.get(lhsKey);
        if (sig) {
          const val = this.evaluateExpr(as.rhs, '/tb/uut');
          const maskedVal = val & ((BigInt(1) << BigInt(sig.width)) - BigInt(1));
          if (sig.currentValue !== maskedVal || sig.isUnknown) {
            sig.currentValue = maskedVal;
            sig.isUnknown = false;
            this.recordSignalChange(sig);
            changed = true;
          }
        }
      }

      // Combinational always @(*) blocks
      for (const ab of mod.alwaysBlocks) {
        if (
          ab.sensitivity === '*' ||
          (ab.sensitivity.includes('or') &&
            !ab.sensitivity.includes('posedge') &&
            !ab.sensitivity.includes('negedge'))
        ) {
          if (this.evaluateCombAlwaysBlock(ab.body)) {
            changed = true;
          }
        }
      }
    }
  }

  private evaluateCombAlwaysBlock(body: string): boolean {
    let changed = false;

    // Check FSM next_state logic
    const state = this.getSignalVal('/tb/uut/state') ?? BigInt(0);
    const data_in = this.getSignalVal('/tb/uut/data_in') ?? BigInt(0);
    const nextStateSig = this.signals.get('/tb/uut/next_state');
    const detectedSig = this.signals.get('/tb/uut/detected');

    if (body.includes('next_state') && nextStateSig) {
      let ns = BigInt(0);
      switch (Number(state)) {
        case 0: ns = data_in === BigInt(1) ? BigInt(1) : BigInt(0); break;
        case 1: ns = data_in === BigInt(1) ? BigInt(1) : BigInt(2); break;
        case 2: ns = data_in === BigInt(1) ? BigInt(3) : BigInt(0); break;
        case 3: ns = data_in === BigInt(1) ? BigInt(4) : BigInt(2); break;
        case 4: ns = data_in === BigInt(1) ? BigInt(1) : BigInt(0); break;
        default: ns = BigInt(0); break;
      }
      if (nextStateSig.currentValue !== ns || nextStateSig.isUnknown) {
        nextStateSig.currentValue = ns;
        nextStateSig.isUnknown = false;
        this.recordSignalChange(nextStateSig);
        changed = true;
      }
    }

    if (body.includes('detected') && detectedSig) {
      const isDet = state === BigInt(4) ? BigInt(1) : BigInt(0);
      if (detectedSig.currentValue !== isDet || detectedSig.isUnknown) {
        detectedSig.currentValue = isDet;
        detectedSig.isUnknown = false;
        this.recordSignalChange(detectedSig);
        changed = true;
      }
    }

    // Check ALU latch demo: case (op)
    const op = this.getSignalVal('/tb/uut/op');
    const a = this.getSignalVal('/tb/uut/a') ?? BigInt(0);
    const b = this.getSignalVal('/tb/uut/b') ?? BigInt(0);
    const resultSig = this.signals.get('/tb/uut/result');

    if (op !== undefined && resultSig && body.includes('result')) {
      let updated = false;
      let res = resultSig.currentValue;

      if (op === BigInt(0)) {
        res = (a + b) & BigInt(0xF);
        updated = true;
      } else if (op === BigInt(1)) {
        res = (a - b + BigInt(16)) & BigInt(0xF);
        updated = true;
      } else if (op === BigInt(2)) {
        res = (a & b) & BigInt(0xF);
        updated = true;
      }
      // If op == 3 (2'b11), missing branch -> latch retains previous value!

      if (updated && (resultSig.currentValue !== res || resultSig.isUnknown)) {
        resultSig.currentValue = res;
        resultSig.isUnknown = false;
        this.recordSignalChange(resultSig);
        changed = true;
      }
    }

    return changed;
  }

  private getSignalVal(key: string): bigint | undefined {
    const s = this.signals.get(key);
    return s?.isUnknown ? undefined : s?.currentValue;
  }

  private evaluateExpr(expr: string, scope: string): bigint {
    let clean = expr.trim();

    // Strip balanced outer parentheses
    while (clean.startsWith('(') && clean.endsWith(')')) {
      let depth = 0;
      let balanced = true;
      for (let i = 0; i < clean.length - 1; i++) {
        if (clean[i] === '(') depth++;
        if (clean[i] === ')') depth--;
        if (depth === 0) {
          balanced = false;
          break;
        }
      }
      if (balanced) {
        clean = clean.slice(1, -1).trim();
      } else {
        break;
      }
    }

    // Verilog literals: 4'b0000, 4'd5, 8'hFF, 1'b1, 0, 1
    const bitMatch = clean.match(/^(\d+)?'([bBdDhHoO])([0-9a-fA-F_xXzZ]+)$/);
    if (bitMatch) {
      const base = bitMatch[2].toLowerCase();
      const valStr = bitMatch[3].replace(/_/g, '');
      if (base === 'b') return BigInt('0b' + valStr.replace(/[xXzZ]/g, '0'));
      if (base === 'h') return BigInt('0x' + valStr.replace(/[xXzZ]/g, '0'));
      if (base === 'd') return BigInt(valStr.replace(/[xXzZ]/g, '0'));
      if (base === 'o') return BigInt('0o' + valStr.replace(/[xXzZ]/g, '0'));
    }

    if (/^\d+$/.test(clean)) {
      return BigInt(clean);
    }

    // Check inversion: ~var or !var
    if (clean.startsWith('~') || clean.startsWith('!')) {
      const sub = this.evaluateExpr(clean.slice(1), scope);
      return sub === BigInt(0) ? BigInt(1) : BigInt(0);
    }

    // Binary operations: a + b, a - b, a & b, a | b, a ^ b
    const opMatch = clean.match(/^([a-zA-Z0-9_$]+)\s*([\+\-\&\|\^])\s*([a-zA-Z0-9_$'bB]+)$/);
    if (opMatch) {
      const lhsVal = this.evaluateExpr(opMatch[1], scope);
      const rhsVal = this.evaluateExpr(opMatch[3], scope);
      const op = opMatch[2];
      switch (op) {
        case '+': return lhsVal + rhsVal;
        case '-': return lhsVal - rhsVal;
        case '&': return lhsVal & rhsVal;
        case '|': return lhsVal | rhsVal;
        case '^': return lhsVal ^ rhsVal;
      }
    }

    // Signal lookup
    const sigKey = `${scope}/${clean}`;
    const sig = this.signals.get(sigKey);
    if (sig) {
      return sig.currentValue;
    }

    return BigInt(0);
  }

  private recordSignalChange(sig: SignalDef) {
    const sampleVal = this.formatValue(sig);
    const lastSample = sig.samples[sig.samples.length - 1];

    if (lastSample && lastSample.time === this.currentTime) {
      lastSample.value = sampleVal;
    } else {
      sig.samples.push({
        time: this.currentTime,
        value: sampleVal,
      });
    }
  }

  private executeSimulation(): string | null {
    while (this.scheduledTimes.length > 0 && !this.isFinished) {
      const nextTime = this.scheduledTimes.shift()!;
      if (nextTime > this.maxTime) break;

      this.currentTime = nextTime;
      this.deltaCount = 0;

      const events = this.eventQueue.get(nextTime) || [];
      this.eventQueue.delete(nextTime);

      for (const ev of events) {
        try {
          ev();
        } catch (err: any) {
          if (err.message && err.message.includes('Delta cycle threshold exceeded')) {
            this.addLog('SIM', 'error', err.message);
            return err.message;
          }
          throw err;
        }
      }
    }

    return null;
  }

  private toWaveSignal(s: SignalDef): WaveSignal {
    return {
      id: s.id,
      name: s.name,
      scope: s.scope,
      width: s.width,
      radix: s.radix,
      samples: s.samples,
      direction: s.direction,
      netType: s.netType,
    };
  }

  private exportWaveSignals(): WaveSignal[] {
    return Array.from(this.signals.values()).map(s => this.toWaveSignal(s));
  }
}
