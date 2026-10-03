Markdown
# Architecture Specification: Verilog Studio Playground

An in-browser digital design, simulation, and synthesis workbench built with Next.js, Web Workers, and WebAssembly, designed for seamless export to desktop EDA workflows (AMD Xilinx Vivado and Intel Quartus Prime).

---

## 1. System Topology Overview

The application adopts a decoupled, client-side execution model. Computationally intensive tasks (event simulation, netlist elaboration, and ZIP packaging) are offloaded to Web Workers to ensure the UI thread maintains 60 FPS rendering.

┌─────────────────────────────────────────────────────────────────────────────┐
│                             Main UI Thread                                  │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Monaco Editor (Tabs)  │  │ Canvas Waveform View  │  │ Vivado Console  │  │
│  │ - design.v (RTL)      │  │ - 1-bit logic lines   │  │ - Tcl commands  │  │
│  │ - testbench.v (Stim)  │  │ - Multi-bit bus boxes │  │ - Timing logs   │  │
│  │ - constraints.xdc     │  │ - Time cursor & sync  │  │ - Lint warnings │  │
│  └───────────┬───────────┘  └───────────▲───────────┘  └────────▲────────┘  │
│              │                          │                       │           │
│              ▼                          │ State Update          │ Logs      │
│  ┌──────────────────────────────────────┴───────────────────────┴────────┐  │
│  │                  Playground State Manager (Zustand/Context)           │  │
│  └───────────────┬───────────────────────────────┬───────────────────────┘  │
└──────────────────┼───────────────────────────────┼──────────────────────────┘
│ postMessage(RTL, TB)          │ postMessage(RTL)
▼                               ▼
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│         sim.worker.ts              │  │        synth.worker.ts             │
│                                    │  │                                    │
│  ┌──────────────────────────────┐  │  │  ┌──────────────────────────────┐  │
│  │ Icarus Verilog WASM / Engine │  │  │  │ Yosys WASM (@yowasp/yosys)   │  │
│  │ - Stratified event queue     │  │  │  │ - AST parsing                │  │
│  │ - Inertial & transport delay │  │  │  │ - Cell mapping (LUT/FF)      │  │
│  │ - VCD generator / Parser     │  │  │  │ - Latch inference checks     │  │
│  └──────────────┬───────────────┘  │  │  └──────────────┬───────────────┘  │
│                 │ Structured VCD   │  │                 │ Gate JSON / Stats│
│                 ▼                  │  │                 ▼                  │
│       ArrayBuffer of Samples       │  │        Synthesis Report Payload    │
└────────────────────────────────────┘  └────────────────────────────────────┘


---

## 2. Directory & Component Structure

verilog-studio/
├── public/
│   └── wasm/                       # Pre-compiled Icarus & Yosys WebAssembly binaries
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root styling, fonts, and dark theme wrapper
│   │   └── page.tsx                # Dynamic split-panel grid layout
│   ├── components/
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx         # Run Sim, Synthesize, Export buttons
│   │   │   └── SimControls.tsx     # Step 10ns, Run 100ns, Zoom, Restart controls
│   │   ├── editor/
│   │   │   ├── EditorPane.tsx      # Monaco editor wrapper with multi-tab header
│   │   │   └── TabBar.tsx          # File switcher (design.v, testbench.v)
│   │   ├── waveform/
│   │   │   ├── WaveformViewer.tsx  # HTML5 Canvas rendering engine
│   │   │   ├── SignalTree.tsx      # Scope hierarchy & port signal names
│   │   │   └── TimeCursor.tsx      # Yellow draggable cursor with time readout
│   │   ├── console/
│   │   │   ├── VivadoConsole.tsx   # Simulated Tcl command line & stream output
│   │   │   └── ErrorAnnotator.tsx  # Maps compiler errors back to Monaco line markers
│   │   └── synthesis/
│   │       ├── NetlistViewer.tsx   # Interactive gate/block schematic viewer
│   │       └── UtilizationTab.tsx  # LUT, Register, and Latch count summary
│   ├── workers/
│   │   ├── sim.worker.ts           # Web Worker executing discrete-event simulation
│   │   └── synth.worker.ts         # Web Worker running logic elaboration/synthesis
│   ├── lib/
│   │   ├── simulation/
│   │   │   ├── vcdParser.ts        # Parses standard Value Change Dump (VCD) files
│   │   │   └── eventQueue.ts       # Fallback event dispatcher with infinite-loop guards
│   │   ├── synthesis/
│   │   │   └── cellCounter.ts      # Aggregates LUT4/LUT6/FDRE instances from netlists
│   │   ├── export/
│   │   │   ├── vivadoTcl.ts        # Dynamic Vivado batch setup script generator
│   │   │   ├── quartusTcl.ts       # Dynamic Quartus batch setup script generator
│   │   │   └── zipPackager.ts      # In-browser ZIP bundling via JSZip
│   │   └── defaults.ts             # Default starter files (4-bit counter + testbench)
│   └── types/
│       └── playground.ts           # Core TypeScript contracts and schemas
├── ARCHITECTURE.md
├── package.json
└── tsconfig.json


---

## 3. Data Contracts & State Management

### 3.1 File & Project Schema (`types/playground.ts`)
```typescript
export type FileType = 'design' | 'testbench' | 'constraints';

export interface ProjectFile {
  id: string;
  name: string;
  type: FileType;
  content: string;
  isTopLevel: boolean;
}

export interface SignalSample {
  time: number;          // In simulation base units (e.g., picoseconds or nanoseconds)
  value: string;         // '0', '1', 'x', 'z', or hex/decimal string for buses
}

export interface WaveSignal {
  id: string;
  name: string;
  scope: string;         // e.g., "testbench.uut"
  width: number;         // 1 for wires, >1 for vectors
  radix: 'bin' | 'hex' | 'dec' | 'signed' | 'ascii';
  samples: SignalSample[];
}

export interface SynthesisMetrics {
  lutCount: number;
  flipFlopCount: number;
  inferredLatchCount: number;
  inferredLatches: string[];
  combLoopDetected: boolean;
  warnings: string[];
}
4. Simulation Engine Design (sim.worker.ts)
To mimic Vivado's xsim, the simulation runtime adheres to the IEEE 1364 Stratified Event Queue semantics:

Preprocessing & Transpilation:

Source code is checked for basic syntax errors and passed into the simulation engine.

Timescale directives (e.g., timescale 1ns / 1ps) establish simulation units and precision steps.

Scheduling Loop:

Active Queue: Evaluates continuous assignments (assign), evaluates RHS and schedules LHS for non-blocking (<=), and executes blocking statements (=).

Inactive Queue: Handles explicit zero-delay assignments (#0).

NBA Queue: Updates non-blocking assignment variables simultaneously.

Postponed Queue: Generates output samples for the VCD buffer.

Execution Guardrails:

Cycle Watchdog: Caps evaluation iterations at 100,000 steps per simulation cycle. Unbounded combinational feedback loops (e.g., cross-coupled gates without explicit delays) are interrupted with a COMB_LOOP_TIMEOUT error rather than locking the worker.

5. Waveform Canvas Architecture (WaveformViewer.tsx)
The waveform viewer renders dynamic traces on an HTML5 <canvas> using double-buffering:

Coordinate Mapping:

X_pixel = (T_sample - T_start) * ZoomFactor
High-DPI Adaptation: Canvas width and height are scaled by window.devicePixelRatio with CSS dimensions anchored to parent split-panes.

1-Bit Rendering: Traces step between vertical rails (logic 0 at bottom, logic 1 at top, X drawn with cross-hatched lines, and Z rendered as a mid-level dotted line).

Bus Rendering: Multi-bit signals are rendered as hollow lozenge shapes (hexagonal ends) with centered text reflecting the chosen radix (Hex, Dec, Bin).

Interactive Cursors: A single primary yellow cursor calculates the precise current timestamp and updates the object inspection table with exact signal values at that slice in time.

6. Synthesis & Elaboration Pipeline (synth.worker.ts)
Engine: WebAssembly build of Yosys (@yowasp/yosys).

Pass Pipeline:

read_verilog -sv design.v

hierarchy -check -top <top_module>

proc; opt; fsm; opt; memory; opt

techmap; opt

dfflegalize to identify inferred sequential elements vs. combinational feedback.

stat -json to extract precise counts for:

Look-Up Tables ($_LUT4_, $_LUT6_)

Registers ($_DFFE_PP0P_, FDRE)

Latches ($_DLATCH_P_, indicating missing default or incomplete if-else)

7. Direct EDA Export System (zipPackager.ts)
Export generates an idiomatic project folder with automated batch configuration scripts:

exported_project.zip
├── rtl/
│   └── design.v               <- Primary synthesizable module
├── tb/
│   └── testbench.v            <- Stimulus testbench
├── scripts/
│   ├── run_vivado.tcl         <- Vivado headless / batch launcher
│   └── run_quartus.tcl        <- Quartus Prime elaboration script
└── README.txt                 <- Command-line instructions for lab use
Vivado Execution:

Bash
vivado -mode tcl -source scripts/run_vivado.tcl
Initializes project, configures Artix-7/Basys3 target (xc7a35tcpg236-1), attaches filesets, executes synthesis, and launches the behavioral xsim GUI.

Quartus Execution:

Bash
quartus_sh -t scripts/run_quartus.tcl
Creates project, targets Cyclone IV E, maps Verilog inputs, and runs analysis & elaboration.


<ElicitationsGroup message="Next deliverables for your Antigravity build:">
  <Elicitation label="Generate complete package.json" query="Provide the exact package.json with dependencies and build scripts for the Verilog playground."/>
  <Elicitation label="Generate src/types/playground.ts" query="Generate the raw copyable code for src/types/playground.ts."/>
  <Elicitation label="Generate vivadoTcl.ts and quartusTcl.ts" query="Provide the copyable code for the Tcl export generators in src/lib/export/."/>
</ElicitationsGroup>