# PHASES.md: Verilog Studio Implementation Roadmap

A phased execution strategy designed to take the project from zero to a fully functioning in-browser simulator and EDA export suite without scope creep.

---

## Phase 1: Core Shell, Types & Editor Foundation
**Goal:** A working multi-pane workbench UI with Monaco editor, state management, and file switching.

* **Key Deliverables:**
  * Initialize Next.js project with Tailwind CSS, TypeScript, and Lucide icons.
  * Define core data schemas in `src/types/playground.ts` (Files, Signals, Samples, Metrics).
  * Configure Monaco Editor with custom Verilog syntax highlighting rules and dark IDE theme.
  * Build the virtual tab switcher (`design.v`, `testbench.v`, and output log views).
  * Implement the top header and action toolbar with responsive split-pane resizing.
* **Success Metric:** User can edit multiple files, switch tabs with zero state loss, and resize panels smoothly at 60 FPS.

---

## Phase 2: Simulation Worker & Event Queue Engine
**Goal:** Event-driven simulation running in a background Web Worker adhering to IEEE 1364 stratified scheduling.

* **Key Deliverables:**
  * Scaffold `src/workers/sim.worker.ts` with bidirectional `postMessage` protocol.
  * Implement the stratified event scheduler:
    * Active queue (`assign`, blocking `=`, non-blocking RHS).
    * Inactive queue (`#0`).
    * NBA queue (LHS non-blocking updates).
    * Postponed queue (signal sample generation).
  * Integrate inertial delay filtering for continuous assignments and transport delay for non-blocking assignments.
  * Implement the 100,000 delta-cycle watchdog to detect and safely abort combinational feedback loops.
  * Output structured signal transition arrays (`WaveSignal[]`) with timestamps and 4-state logic (`0`, `1`, `x`, `z`).
* **Success Metric:** The pre-loaded 4-bit counter testbench simulates `#delays` accurately off-thread without freezing the UI.

---

## Phase 3: High-DPI Canvas Waveform Viewer
**Goal:** Vivado-style timing viewer with interactive navigation, radix switching, and time tracking.

* **Key Deliverables:**
  * Build `WaveformViewer.tsx` on HTML5 `<canvas>` using `devicePixelRatio` scaling.
  * Render 1-bit logic step traces, unknown states (`x`, red fill), and high-impedance (`z`, center dotted line).
  * Render multi-bit buses as hexagonal lozenges with centered values and selectable radix (`hex`, `bin`, `dec`).
  * Implement mouse-drag / trackpad panning and wheel-based horizontal zooming.
  * Implement the interactive yellow time cursor linked to an object value inspector.
* **Success Metric:** Dragging the time cursor smoothly updates signal values in the inspector across a 1,000 ns simulation trace with zero blurriness.

---

## Phase 4: Vivado & Quartus 1-Click Export Packager
**Goal:** In-browser ZIP bundling that allows students to download their code and run it directly in lab EDA tools.

* **Key Deliverables:**
  * Implement `src/lib/export/vivadoTcl.ts` to output headless, batch-compatible Vivado scripts targeting the Basys 3 (`xc7a35tcpg236-1`).
  * Implement `src/lib/export/quartusTcl.ts` targeting Cyclone IV E with project creation and elaboration commands.
  * Implement `src/lib/export/zipPackager.ts` using `jszip` to construct the canonical directory layout:
    * `/rtl/design.v`
    * `/tb/testbench.v`
    * `/scripts/run_vivado.tcl`
    * `/scripts/run_quartus.tcl`
    * `README.txt`
  * Bind export trigger to the "Export for EDA" toolbar button.
* **Success Metric:** Unzipping the downloaded archive and running `source scripts/run_vivado.tcl` in Vivado terminal successfully builds the project and launches simulation without manual tweaks.

---

## Phase 5: Synthesis Elaboration & Resource Utilization
**Goal:** Logic synthesis checks that estimate FPGA resource utilization and flag bad RTL design habits.

* **Key Deliverables:**
  * Scaffold `src/workers/synth.worker.ts` integrating WebAssembly Yosys (`@yowasp/yosys`).
  * Enforce synthesizability checks (flag `#delays`, `initial` blocks, and non-synthesizable constructs in `design.v`).
  * Add automatic latch detection for incomplete `if-else` and unhandled `case` branches.
  * Parse synthesis outputs into metric cards: LUT counts (`LUT4`/`LUT6`), Flip-Flop counts (`FDRE`/`DFFE`), and Inferred Latches.
  * Build the "Synthesis Report & Utilization" UI tab.
* **Success Metric:** Synthesizing an incomplete `case` statement correctly flags an inferred latch warning and displays cell counts in the UI.

---

## Phase 6: Polish, Hardening & Community Sharing
**Goal:** Edge-case handling, URL-based circuit sharing, and usability refinements.

* **Key Deliverables:**
  * Implement lossless URL hash compression using `lz-string` to share runnable code snippets via direct link.
  * Add simulated Vivado Tcl console input parsing (`run <time>`, `restart`, `step`).
  * Add inline syntax error markers in the Monaco editor mapped from compiler stderr.
  * Ensure full mobile and tablet touch responsiveness for the waveform viewer and navigation drawers.
* **Success Metric:** A student can open a shared URL on a laptop or tablet, run the simulation, inspect the waveforms, and export the project in under 30 seconds.