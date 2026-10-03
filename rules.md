# RULES.md: Verilog Studio Design & Engineering Constraints

This document defines the behavioral, technical, and architectural rules for developing the in-browser Verilog Playground. All code generation, model prompts, and feature additions must strictly adhere to these specifications.

---

## 1. Verilog Simulation & Timing Engine Rules

* **Rule 1.1: Stratified Event Queue Compliance**
  * The simulation engine must follow the IEEE 1364 stratified event execution model:
    1. Active Queue: Continuous assignments (`assign`), blocking statements (`=`), RHS evaluations of non-blocking assignments (`<=`).
    2. Inactive Queue: Explicit zero-delay assignments (`#0`).
    3. Non-Blocking Assignment (NBA) Queue: LHS update step for non-blocking assignments (`<=`).
    4. Postponed Queue: Timing trace captures (`$dumpvars`, `$monitor`).
  * Combining blocking and non-blocking assignments to the same net in identical edge domains is strictly illegal.

* **Rule 1.2: Delay Modeling & Signal Filtering**
  * **Inertial Delay:** Continuous assignments with delays (e.g., `assign #3 y = a & b;`) must filter out transient input pulses shorter than the propagation delay ($t_{pulse} < 3\,\text{ns}$).
  * **Transport Delay:** Non-blocking intra-assignment delays (e.g., `q <= #3 d;`) must preserve and schedule the value across the boundary regardless of intermediate glitches.

* **Rule 1.3: Runaway Loop Guardrails (Delta-Cycle Watchdog)**
  * Simulations must implement a hard ceiling of **100,000 delta-cycles** per discrete timestamp.
  * If zero-delay combinational loops (such as cross-coupled NAND gates without explicit propagation delay) exceed this threshold, the worker must abort execution and emit an explicit error: `ERROR: Combinational loop detected at simulation time Xns. Delta cycle threshold exceeded.`
  * The browser UI thread must never hang or frame-drop due to simulation execution.

* **Rule 1.4: Four-Valued Logic Preservation**
  * Signals must not be cast to native JavaScript booleans.
  * The simulator must explicitly preserve and propagate standard Verilog logic levels:
    * `0`: Logic Low
    * `1`: Logic High
    * `x`: Unknown / Uninitialized / Contention
    * `z`: High Impedance / Floating / Tri-state

---

## 2. Synthesis & Elaboration Rules

* **Rule 2.1: Synthesizable vs. Simulation-Only Construct Separation**
  * The synthesis worker (`synth.worker.ts`) must enforce standard RTL synthesizability:
    * **Forbidden in synthesizable RTL:** `#delays`, `initial` blocks, `$finish`, `$time`, `$display`, `fork...join`.
    * If non-synthesizable constructs appear in `design.v`, the synthesis engine must flag them as errors or synthesis warnings, distinct from pure simulation logs.

* **Rule 2.2: Latch Inference Auditing**
  * The synthesis parser must track combinational `always @(*)` blocks:
    * If any branch fails to assign all outputs, or if a `case` statement lacks a `default` arm without full condition coverage, the tool must log an explicit warning: `[Synth 8-327] Inferring latch for variable '<signal_name>'`.
    * Inferred latches must be enumerated in the Utilization Report metrics.

* **Rule 2.3: Technology Mapping Defaults**
  * Primitive cell estimations must map to standard FPGA equivalents:
    * Look-Up Tables: Report equivalent 4-input (`LUT4`) or 6-input (`LUT6`) count.
    * Registers: Report D-type Flip-Flops with Enable/Reset (`FDRE` / `DFFE`).
    * Block Memory: Detect and flag RAM arrays that infer distributed logic vs. dedicated block memory.

---

## 3. UI, Canvas & Waveform Viewer Rules

* **Rule 3.1: High-DPI (Retina) Canvas Rendering**
  * Waveform rendering must dynamically scale the HTML5 canvas buffer by `window.devicePixelRatio`:
    ```typescript
    canvas.width = Math.floor(rect.width * window.devicePixelRatio);
    canvas.height = Math.floor(rect.height * window.devicePixelRatio);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ```
  * Waveform lines and text must never appear blurry or aliased during zoom/pan operations.

* **Rule 3.2: Standardized Waveform Visualization**
  * **1-bit signals:** Step functions switching between a high rail (top 20% of track) and low rail (bottom 20% of track).
  * **Unknown (`x`):** Rendered between rails using a red background fill or cross-hatch strokes.
  * **High-Z (`z`):** Rendered as a dotted yellow line along the exact vertical center (50%) of the signal track.
  * **Multi-bit buses:** Hexagonal lozenge boundaries containing centered string values formatted according to the user's selected radix (Hexadecimal by default).

* **Rule 3.3: Interactive Time Cursor Synchronization**
  * Hovering or dragging across the waveform area must lock a vertical yellow hairline cursor to the current mouse timestamp.
  * The Signal Inspector panel must immediately reflect the resolved logic values of all displayed nets at that specific nanosecond slice without noticeable latency.

---

## 4. EDA Export & Compatibility Rules

* **Rule 4.1: Deterministic Directory Hierarchy**
  * The generated `.zip` package must strictly follow this internal structure:
    ```
    <project_name>_export/
    ├── rtl/
    │   └── design.v
    ├── tb/
    │   └── testbench.v
    ├── scripts/
    │   ├── run_vivado.tcl
    │   └── run_quartus.tcl
    └── README.txt
    ```

* **Rule 4.2: Vivado Tcl Script Compliance**
  * Scripts targeting Vivado must execute headlessly and remain compatible with Vivado batch mode (`vivado -mode tcl -source run_vivado.tcl`):
    * Create project in an isolated subfolder (`./vivado_prj`).
    * Set target part to standard educational board: `xc7a35tcpg236-1` (Artix-7 / Basys 3).
    * Explicitly assign `top` for synthesis (`[current_fileset]`) and simulation (`[get_filesets sim_1]`).
    * Run `synth_design` followed by `launch_simulation`.

* **Rule 4.3: Quartus Prime Tcl Compliance**
  * Scripts targeting Intel Quartus Prime must execute clean project initialization:
    * Set FPGA family to `Cyclone IV E` (standard university lab standard).
    * Set top-level entity matching `design.v`.
    * Run `execute_flow -analysis_and_elaboration`.

---

## 5. Coding & Performance Standards

* **Rule 5.1: Zero Main-Thread Blocking**
  * All code compilation, lexical tokenizing, event loop processing, and ZIP generation must run in Web Workers or asynchronous chunks. The main React thread is strictly reserved for user inputs and UI renders.
* **Rule 5.2: State Immutability**
  * Signal waveform samples and simulation histories must be stored as immutable arrays or typed arrays (`Float64Array` / `Uint8Array`) to allow efficient canvas redrawing without triggering garbage collection spikes during high-frequency zooming.