# CONTEXT.md: Project Context & Domain Landscape

This document establishes the background, student problem space, existing tooling limitations, target audience, and engineering goals for **Verilog Studio**.

---

## 1. Background & Community Origins

* **Project Origin:** Born out of an engineering college VLSI student community initiative to solve common friction points encountered in digital electronics and RTL design coursework.
* **The Core Problem:** 
  * Industry-standard Electronic Design Automation (EDA) suites (like AMD Xilinx Vivado and Intel Quartus Prime) are massive downloads (20 GB to 60 GB+), resource-heavy, and incompatible with low-spec laptops, Chromebooks, and mobile platforms.
  * College digital design labs often suffer from licensed machine availability bottlenecks, OS version conflicts, and cumbersome GUI setup rituals just to verify a simple 4-bit counter or finite state machine.
  * Existing lightweight browser tools (like HDLBits or generic code playgrounds) either lack realistic event-driven timing delay modeling (`#delays`, inertial vs. transport glitches), don't provide interactive waveform inspection, or operate as closed environments with no easy migration path to lab workstations.

---

## 2. Target Audience & Personas

1. **Undergraduate Engineering Students (ECE / EEE / CS):**
   * Taking core subjects: *Digital Electronics*, *Computer Architecture*, and *VLSI Design*.
   * Preparing for academic lab exams, sessional tests, and practical vivas.
   * Need immediate feedback on whether their RTL compiles, functions as expected, and avoids unwanted sequential latches.

2. **Core Placement & Competitive Hardware Aspirants:**
   * Practicing Verilog RTL design for internships and entry-level digital design roles at semiconductor companies (Intel, NVIDIA, Qualcomm, AMD, TI, Synopsys).
   * Preparing for competitive gate-level questions and standard placement challenges (sequence detectors, gray counters, clock domain crossings, synchronizers).

3. **Community Mentors & Lab TAs:**
   * Need a friction-free link they can drop in Discord/WhatsApp/Slack to review student code, demonstrate race conditions, or illustrate clock-edge behavior without requiring everyone to fire up a heavyweight IDE.

---

## 3. Product Vision & Success Criteria

**Verilog Studio** is a browser-native "pre-Vivado workbench":

* **Frictionless Entry:** Zero-install, instantaneous load time in any modern browser, operating completely offline once loaded (via Web Workers / PWA caching).
* **High Educational Fidelity:** Simulates authentic digital hardware behavior—including IEEE 1364 stratified event scheduling, active-low reset assertion, non-blocking assignment transitions, and delay handling—rather than treating Verilog like procedural C/C++ code.
* **Direct Desktop Bridge:** Never locks code into a web silo. The platform features a **1-click EDA Export** that generates clean directory trees bundled with automated Tcl scripts for both Vivado and Quartus Prime, allowing students to transition seamlessly from quick web prototyping to full synthesis and bitstream generation on lab machines.

---

## 4. Key Differentiators vs. Existing Tools

| Feature | Standard Web Sandboxes | HDLBits | Vivado / Quartus Desktop | **Verilog Studio (This Project)** |
| :--- | :--- | :--- | :--- | :--- |
| **Install Footprint** | 0 MB (Browser) | 0 MB (Browser) | 30 GB - 80 GB | **0 MB (Browser-native)** |
| **Hardware Overhead** | Minimal | Minimal | 16 GB+ RAM, multi-core CPU | **Runs on basic laptops & tablets** |
| **Delay Simulation (`#5`)**| Typically ignored or errors out | Disabled (zero-delay functional only)| Full IEEE event-driven support | **Accurate stratified event scheduling** |
| **Waveform UI** | Static or raw text logs | Pre-rendered static images | Interactive canvas with markers | **Interactive High-DPI canvas with time cursor** |
| **FPGA Export** | Manual copy-paste of `.v` | None | Native | **1-Click ZIP with auto-run Tcl scripts** |
| **Resource Estimation** | None | Synthesis log snippets | Full detailed device reports | **In-browser LUT, FF & Latch metrics** |

---

## 5. Typical Student Workflow (The Golden Path)

1. **Write & Iterate:** The student opens the studio and writes their module in `design.v` alongside stimulus with `#delays` in `testbench.v`.
2. **Simulate & Inspect:** Clicks **Run Simulation**. The worker calculates the signal transitions. The waveform viewer immediately displays clock edges, bus values (in Hex/Dec), and reset de-assertion. The student scrubs the yellow time cursor across transitions to verify setup/hold behavior.
3. **Synthesis Sanity-Check:** Clicks **Synthesize**. The worker parses the AST, checks for missing branches, displays estimated LUT and Flip-Flop usage, and warns if an unwanted latch was inferred.
4. **Take It to the Lab:** Clicks **Export for EDA**. Downloads a structured `.zip` package. In the college lab, the student opens Vivado or Quartus, types `source scripts/run_vivado.tcl`, and their web project runs immediately without manual GUI configuration.