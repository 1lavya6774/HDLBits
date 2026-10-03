# Verilog Studio ⚡

> **A zero-friction, production-grade browser workbench & EDA simulator for Verilog HDL.**  
> Features automated testbench synthesis (Auto-Harness), high-DPI canvas waveform inspection, live gate-level schematics, Vivado Tcl diagnostics, and 1-click EDA packaging.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/1lavya6774/HDLBits)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

---

## 🚀 Instant Deployment (Netlify)

Click the button below to deploy your own instance of **Verilog Studio** to Netlify with zero setup:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/1lavya6774/HDLBits)

### Manual Netlify Setup (2 Steps):
1. Go to [app.netlify.com](https://app.netlify.com) and log in with your GitHub account.
2. Click **"Add new site"** → **"Import an existing project"** → **"GitHub"**.
3. Select **`1lavya6774/HDLBits`**.
4. The build settings are auto-configured by `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `out`
5. Click **"Deploy HDLBits"**! Your site is immediately built and live on Netlify's global edge network.

---

## ✨ Key Features

### 1. 🤖 Intelligent Auto-Harness Generator
- **Zero Boilerplate:** Beginners and students only need to write synthesizable RTL code in `design.v`.
- **Clock Intelligence:** Automatically discovers clocks (`clk`, `clock`), generating synchronous free-running square waves (`always #5 clk = ~clk;`).
- **Reset Intelligence:** Detects active-low (`rst_n`) vs active-high (`rst`) resets, automatically cycling them appropriately before stimulus injection.
- **Stimulus Engine:** Synthesizes exhaustive truth-table sequences for combinational circuits, or pseudorandom/sequential vectors for multi-bit sequential modules.
- **Manual Mode Toggle:** Switch seamlessly between **Auto-Driver Mode** and standard **Manual Testbench Mode**.

### 2. 🌊 High-DPI Canvas Waveform Viewer (xsim style)
- **Retina Crisp:** Dynamic scaling with `window.devicePixelRatio`.
- **Logic Color Standard:** High/Low rails (`#10b981`), Multi-bit bus boundary lozenges (`#38bdf8`), Unknown `X` cross-hatches (`#ef4444`), and High-Z `Z` dotted levels (`#eab308`).
- **Interactive Inspection:** Smooth panning, zooming, and a draggable 1px yellow vertical cursor with a top timestamp pill (`[ 45.00 ns ]`) synchronized in real time with the sticky signal hierarchy inspector.

### 3. 🔬 Interactive RTL Gate Schematic Viewer
- Renders an interactive SVG gate-level circuit graph (flip-flops, logic gates, multiplexers, and I/O pads) synthesized directly from your code.
- Interactive pan, zoom, and component inspection.

### 4. 📊 Synthesis & Latch Inference Diagnostics
- FPGA primitive estimation targeting AMD Xilinx Artix-7 (`LUT4`, `LUT6`, `FDRE`, `IBUF`, `OBUF`).
- **Latch Inference Checker:** Scans combinational blocks for incomplete branch assignments and emits standard Vivado warnings (`[Synth 8-327] Inferring latch for variable '<signal>'`) with prominent warning cards.

### 5. 📦 1-Click EDA Export Pipeline
- Instantly bundles a complete ZIP package (`<module>_eda_package.zip`) containing:
  - `rtl/design.v`: Synthesizable RTL source.
  - `tb/testbench.v`: Testbench verification file.
  - `scripts/run_vivado.tcl`: Headless batch script for AMD Xilinx Vivado (targeting `xc7a35tcpg236-1`).
  - `scripts/run_quartus.tcl`: Headless script for Intel Quartus Prime (targeting `Cyclone IV E`).
  - `README.txt`: Step-by-step instructions to run headless simulation and bitstream generation.

---

## 🛠️ Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.17 or higher recommended)
- `npm` or `yarn` / `pnpm`

### Installation
```bash
# Clone the repository
git clone https://github.com/1lavya6774/HDLBits.git
cd HDLBits

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to start designing.

### Running Test Suite
```bash
node tests/verify-all.mjs
```
Runs 49 automated unit tests verifying the auto-harness generator, stratified simulation engine, synthesis cell counters, and export scripts.

### Building for Production
```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router (page.tsx, layout.tsx, globals.css)
│   ├── components/
│   │   ├── console/            # Vivado Tcl Shell and diagnostic log drawer
│   │   ├── editor/             # Tabbed Monaco Editor with custom Dark Silicon theme
│   │   ├── schematic/          # Interactive SVG RTL Gate Schematic Viewer
│   │   ├── scope/              # Hierarchical Scope and Signal Tree inspector
│   │   ├── synthesis/          # FPGA Utilization and Cell Report dashboard
│   │   ├── toolbar/            # Fixed 48px Top Header toolbar with actions & presets
│   │   └── waveform/           # High-DPI Canvas Waveform Viewer
│   ├── context/                # Global Playground state context & reducer
│   ├── lib/
│   │   ├── export/             # AMD Vivado, Intel Quartus Tcl scripts & JSZip packager
│   │   ├── harness/            # Intelligent Auto-Harness testbench generator
│   │   ├── simulation/         # IEEE stratified event-driven logic simulator
│   │   └── synthesis/          # Logic linter & FPGA cell resource estimator
│   ├── types/                  # TypeScript interface definitions
│   └── workers/                # Web Workers for simulation and synthesis
├── tests/
│   └── verify-all.mjs          # Comprehensive 49-assertion test suite
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Dark Silicon design tokens
└── tsconfig.json               # TypeScript compiler configuration
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
