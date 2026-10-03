import JSZip from 'jszip';
import { generateVivadoTcl } from './vivadoTcl';
import { generateQuartusTcl } from './quartusTcl';

export function extractModuleName(verilogCode: string, fallback: string): string {
  const match = verilogCode.match(/\bmodule\s+([a-zA-Z_][a-zA-Z0-9_$]*)/);
  return match ? match[1] : fallback;
}

export function generateReadme(topModule: string, tbModule: string): string {
  return `================================================================================
VERILOG STUDIO - 1-CLICK EDA EXPORT BUNDLE
================================================================================
Generated for: ${topModule} (Testbench: ${tbModule})
Platform: Verilog Studio Browser Workbench
Target Boards: AMD Xilinx Artix-7 (Basys 3) & Intel Cyclone IV E

--------------------------------------------------------------------------------
DIRECTORY STRUCTURE:
--------------------------------------------------------------------------------
.
|-- rtl/
|   \`-- design.v          Synthesizable Verilog RTL source
|-- tb/
|   \`-- testbench.v       Verification testbench with stimulus and assertions
|-- scripts/
|   |-- run_vivado.tcl    Headless Xilinx Vivado automated synthesis & xsim script
|   \`-- run_quartus.tcl   Headless Intel Quartus Prime analysis & elaboration script
\`-- README.txt            This instruction guide

--------------------------------------------------------------------------------
HOW TO EXECUTE IN AMD XILINX VIVADO (Lab Workstation):
--------------------------------------------------------------------------------
1. Open a terminal or the Vivado Command Prompt (Tcl Shell).
2. Navigate to this unzipped project root directory:
     cd /path/to/${topModule}_eda_package
3. Run the automated headless batch script:
     vivado -mode batch -source scripts/run_vivado.tcl
   Or open the interactive Vivado GUI and run in the Tcl Console:
     source scripts/run_vivado.tcl
4. Outputs:
   - Behavioral simulation waveform database: ./vivado_prj/${topModule}_prj.sim/
   - Synthesis utilization report: ./vivado_prj/utilization_report.txt
   - Timing summary: ./vivado_prj/timing_summary.txt

--------------------------------------------------------------------------------
HOW TO EXECUTE IN INTEL QUARTUS PRIME:
--------------------------------------------------------------------------------
1. Open the Quartus Command Prompt (or bash shell with Quartus bin in PATH).
2. Navigate to this unzipped project root directory.
3. Run Quartus Shell:
     quartus_sh -t scripts/run_quartus.tcl
4. Outputs:
   - Elaboration project and compilation database: ./quartus_prj/
================================================================================
`;
}

export async function createEdaZipPackage(designCode: string, testbenchCode: string): Promise<Blob> {
  const topModule = extractModuleName(designCode, 'counter');
  const tbModule = extractModuleName(testbenchCode, 'tb_counter');

  const zip = new JSZip();

  // 1. rtl/design.v
  zip.file('rtl/design.v', designCode);

  // 2. tb/testbench.v
  zip.file('tb/testbench.v', testbenchCode);

  // 3. scripts/run_vivado.tcl
  const vivadoTcl = generateVivadoTcl(topModule, tbModule);
  zip.file('scripts/run_vivado.tcl', vivadoTcl);

  // 4. scripts/run_quartus.tcl
  const quartusTcl = generateQuartusTcl(topModule);
  zip.file('scripts/run_quartus.tcl', quartusTcl);

  // 5. README.txt
  const readme = generateReadme(topModule, tbModule);
  zip.file('README.txt', readme);

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
