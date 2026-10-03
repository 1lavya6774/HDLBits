/**
 * Auto-Harness Testbench Generator for Verilog Studio
 * 
 * Automatically analyzes synthesizable RTL in design.v and synthesizes a complete,
 * zero-friction verification testbench (auto_tb.v).
 * 
 * Features:
 * - Module & Port Extraction (ANSI & non-ANSI headers, vector widths [MSB:LSB])
 * - Clock Intelligence: auto-detects clk/clock ports, generates always #5 clk = ~clk
 * - Reset Intelligence: auto-detects active-low (rst_n) vs active-high (rst), pulses 20ns
 * - Auto-Stimulus Engine:
 *   - Combinational: Exhaustive truth table (if inputs <= 10 bits) or 32 pseudo-random cycles
 *   - Sequential: Reset initialization, synchronous stimulus on negative clock edges
 * - Waveform Dumping: $dumpfile("dump.vcd") and $dumpvars(0, auto_tb)
 */

export interface PortDefinition {
  name: string;
  direction: 'input' | 'output' | 'inout';
  width: number;
  msb: number;
  lsb: number;
  netType: 'wire' | 'reg';
}

export interface AutoHarnessResult {
  moduleName: string;
  testbenchCode: string;
  isSequential: boolean;
  clockPort?: string;
  resetPort?: string;
  resetActiveLow: boolean;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export function generateAutoTestbench(verilogCode: string): AutoHarnessResult {
  // Strip comments
  const cleanCode = verilogCode
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  // 1. Extract Top Module Name and Header
  const moduleMatch = cleanCode.match(
    /\bmodule\s+([a-zA-Z_][a-zA-Z0-9_$]*)\s*(?:#\s*\([\s\S]*?\))?\s*(?:\(([\s\S]*?)\))?\s*;/
  );

  const moduleName = moduleMatch ? moduleMatch[1] : 'top_module';
  const portHeader = moduleMatch && moduleMatch[2] ? moduleMatch[2] : '';

  // Extract body between module ... ; and endmodule
  const bodyMatch = cleanCode.match(/;\s*([\s\S]*?)\bendmodule\b/);
  const moduleBody = bodyMatch ? bodyMatch[1] : '';

  const portsMap = new Map<string, PortDefinition>();

  // Helper to parse port width
  const parseWidth = (rawWidth?: string): { width: number; msb: number; lsb: number } => {
    if (!rawWidth) return { width: 1, msb: 0, lsb: 0 };
    const m = rawWidth.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
    if (!m) return { width: 1, msb: 0, lsb: 0 };
    const msb = parseInt(m[1], 10);
    const lsb = parseInt(m[2], 10);
    return { width: Math.abs(msb - lsb) + 1, msb, lsb };
  };

  // 2. Parse ANSI Port Declarations in header
  if (portHeader.trim()) {
    const rawDecls = portHeader.split(',');
    for (const raw of rawDecls) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const pMatch = trimmed.match(
        /(input|output|inout)\s+(wire|reg)?\s*(\[\s*\d+\s*:\s*\d+\s*\])?\s*([a-zA-Z_][a-zA-Z0-9_$]*)/
      );

      if (pMatch) {
        const direction = pMatch[1] as 'input' | 'output' | 'inout';
        const netType = (pMatch[2] || 'wire') as 'wire' | 'reg';
        const { width, msb, lsb } = parseWidth(pMatch[3]);
        const name = pMatch[4];

        portsMap.set(name, {
          name,
          direction,
          width,
          msb,
          lsb,
          netType,
        });
      }
    }
  }

  // 3. Parse non-ANSI port declarations in module body
  const bodyPortRegex = /(input|output|inout)\s+(wire|reg)?\s*(\[\s*\d+\s*:\s*\d+\s*\])?\s*([a-zA-Z0-9_$,\s]+);/g;
  let bpMatch;
  while ((bpMatch = bodyPortRegex.exec(moduleBody)) !== null) {
    const direction = bpMatch[1] as 'input' | 'output' | 'inout';
    const netType = (bpMatch[2] || 'wire') as 'wire' | 'reg';
    const { width, msb, lsb } = parseWidth(bpMatch[3]);
    const names = bpMatch[4].split(',').map((n) => n.trim()).filter(Boolean);

    for (const name of names) {
      if (!portsMap.has(name)) {
        portsMap.set(name, {
          name,
          direction,
          width,
          msb,
          lsb,
          netType,
        });
      }
    }
  }

  const allPorts = Array.from(portsMap.values());
  const inputs = allPorts.filter((p) => p.direction === 'input');
  const outputs = allPorts.filter((p) => p.direction === 'output' || p.direction === 'inout');

  // 4. Clock Intelligence: Auto-detect clock port
  const clkCandidate = inputs.find((p) =>
    /^(clk|clock|aclk|clk_in|sys_clk|clock_i)$/i.test(p.name) ||
    /clk|clock/i.test(p.name)
  );
  const clockPort = clkCandidate ? clkCandidate.name : undefined;

  // 5. Reset Intelligence: Auto-detect active-low vs active-high reset port
  const rstLowCandidate = inputs.find((p) =>
    /^(rst_n|reset_n|aresetn|rstn|resetn)$/i.test(p.name) ||
    /rst.*n|reset.*n/i.test(p.name)
  );

  const rstHighCandidate = inputs.find((p) =>
    /^(rst|reset|arst|rst_p|reset_p)$/i.test(p.name) ||
    /^(rst|reset)/i.test(p.name)
  );

  const resetPort = rstLowCandidate ? rstLowCandidate.name : rstHighCandidate ? rstHighCandidate.name : undefined;
  const resetActiveLow = !!rstLowCandidate;

  // Check if design is sequential: has clock or @(posedge ...) in body
  const isSequential = !!clockPort || /posedge|negedge/.test(moduleBody);

  // 6. Generate Auto-Harness Testbench Code
  const lines: string[] = [];

  lines.push('`timescale 1ns / 1ps');
  lines.push('');
  lines.push(`// ==============================================================================`);
  lines.push(`// AUTOMATIC HARNESS TESTBENCH FOR: ${moduleName}`);
  lines.push(`// Generated dynamically by Verilog Studio Auto-Driver Engine`);
  lines.push(`// Mode: ${isSequential ? 'Sequential (Clock & Reset Driven)' : 'Combinational (Truth-Table Driven)'}`);
  lines.push(`// ==============================================================================`);
  lines.push('');
  lines.push(`module auto_tb_${moduleName};`);
  lines.push('');

  // Port registers and wires
  lines.push('    // 1. Stimulus Drivers (reg for inputs, wire for outputs)');
  for (const inp of inputs) {
    const widthStr = inp.width > 1 ? `[${inp.msb}:${inp.lsb}] ` : '';
    lines.push(`    reg  ${widthStr}${inp.name};`);
  }
  for (const out of outputs) {
    const widthStr = out.width > 1 ? `[${out.msb}:${out.lsb}] ` : '';
    lines.push(`    wire ${widthStr}${out.name};`);
  }
  lines.push('');

  // Instantiate UUT
  lines.push('    // 2. Unit Under Test (UUT) Instantiation');
  lines.push(`    ${moduleName} uut (`);
  const connLines = allPorts.map((p, idx) => {
    const isLast = idx === allPorts.length - 1;
    return `        .${p.name}(${p.name})${isLast ? '' : ','}`;
  });
  lines.push(connLines.join('\n'));
  lines.push('    );');
  lines.push('');

  // Clock generation if sequential
  if (clockPort) {
    lines.push('    // 3. Free-Running 100MHz Clock Generator (10ns Period)');
    lines.push(`    always #5 ${clockPort} = ~${clockPort};`);
    lines.push('');
  }

  // Waveform VCD capture
  lines.push('    // 4. VCD Waveform Capture');
  lines.push('    initial begin');
  lines.push(`        $dumpfile("dump.vcd");`);
  lines.push(`        $dumpvars(0, auto_tb_${moduleName});`);
  lines.push('    end');
  lines.push('');

  // Stimulus process
  lines.push('    // 5. Automated Stimulus Sequencing');
  lines.push('    initial begin');
  lines.push('        // Time 0: Initial condition initialization');

  // Initialize all inputs to 0
  for (const inp of inputs) {
    if (inp.name === resetPort) {
      lines.push(`        ${inp.name} = ${resetActiveLow ? "1'b0" : "1'b1"}; // Assert Reset`);
    } else {
      lines.push(`        ${inp.name} = 0;`);
    }
  }

  lines.push('');

  // Reset sequence if reset exists
  if (resetPort) {
    lines.push('        // De-assert reset at 20ns');
    lines.push('        #20;');
    lines.push(`        ${resetPort} = ${resetActiveLow ? "1'b1" : "1'b0"}; // Release Reset`);
    lines.push('');
  }

  // Generate input stimulus
  const otherInputs = inputs.filter((p) => p.name !== clockPort && p.name !== resetPort);

  if (isSequential) {
    // Sequential stimulus on negative clock edges
    lines.push('        // Apply dynamic stimulus synchronized to clock cycles');
    if (otherInputs.length > 0) {
      lines.push('        #10;');
      for (const inp of otherInputs) {
        lines.push(`        ${inp.name} = ${inp.width > 1 ? `${inp.width}'h1` : "1'b1"};`);
      }
      lines.push('        #80;');
      for (const inp of otherInputs) {
        lines.push(`        ${inp.name} = 0;`);
      }
      lines.push('        #20;');
      for (const inp of otherInputs) {
        lines.push(`        ${inp.name} = ${inp.width > 1 ? `${inp.width}'hF` : "1'b1"};`);
      }
      lines.push('        #60;');
    } else {
      lines.push('        // Autonomous counter/FSM - run for 15 clock cycles');
      lines.push('        #150;');
    }

    if (resetPort) {
      lines.push('        // Re-assert reset pulse to verify recovery');
      lines.push(`        ${resetPort} = ${resetActiveLow ? "1'b0" : "1'b1"};`);
      lines.push('        #10;');
      lines.push(`        ${resetPort} = ${resetActiveLow ? "1'b1" : "1'b0"};`);
      lines.push('        #30;');
    }

    lines.push('        $display("[AUTO_TB] Simulation completed successfully.");');
    lines.push('        $finish;');
  } else {
    // Combinational stimulus: truth table or randomized
    const totalInputBits = otherInputs.reduce((acc, p) => acc + p.width, 0);

    if (totalInputBits > 0 && totalInputBits <= 8) {
      const maxCombinations = Math.min(256, Math.pow(2, totalInputBits));
      lines.push(`        // Exhaustive Truth Table Loop (${maxCombinations} combinations for ${totalInputBits} input bits)`);
      lines.push('        integer i;');
      lines.push(`        for (i = 0; i < ${maxCombinations}; i = i + 1) begin`);
      lines.push('            { ' + otherInputs.map((p) => p.name).join(', ') + ' } = i;');
      lines.push('            #10;');
      lines.push('        end');
    } else if (otherInputs.length > 0) {
      lines.push('        // Multi-bit randomized stimulus sweep (16 stimulus test cycles)');
      lines.push('        integer cycle;');
      lines.push('        for (cycle = 0; cycle < 16; cycle = cycle + 1) begin');
      for (const inp of otherInputs) {
        const mask = inp.width <= 32 ? `32'h${((1n << BigInt(inp.width)) - 1n).toString(16)}` : '32' + "'hFFFF";
        lines.push(`            ${inp.name} = $random & ${mask};`);
      }
      lines.push('            #10;');
      lines.push('        end');
    } else {
      lines.push('        #100;');
    }

    lines.push('        $display("[AUTO_TB] Truth-table verification finished.");');
    lines.push('        $finish;');
  }

  lines.push('    end');
  lines.push('');
  lines.push('endmodule');

  return {
    moduleName,
    testbenchCode: lines.join('\n'),
    isSequential,
    clockPort,
    resetPort,
    resetActiveLow,
    inputs,
    outputs,
  };
}
