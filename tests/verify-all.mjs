// Automated Verification Test Suite for Verilog Studio
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('================================================================');
  console.log('VERILOG STUDIO AUTOMATED VERIFICATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Check File Integrity
  console.log('\n--- 1. Workspace & Architecture Integrity ---');
  const criticalFiles = [
    'src/types/playground.ts',
    'src/lib/defaults.ts',
    'src/lib/simulation/simulator.ts',
    'src/lib/synthesis/synthesizer.ts',
    'src/lib/export/vivadoTcl.ts',
    'src/lib/export/quartusTcl.ts',
    'src/lib/export/zipPackager.ts',
    'src/workers/sim.worker.ts',
    'src/workers/synth.worker.ts',
    'src/components/toolbar/TopHeader.tsx',
    'src/components/scope/SignalTree.tsx',
    'src/components/editor/EditorPane.tsx',
    'src/components/console/VivadoConsole.tsx',
    'src/components/waveform/WaveformViewer.tsx',
    'src/components/synthesis/UtilizationDashboard.tsx',
    'src/app/page.tsx',
    'src/app/globals.css',
  ];

  for (const f of criticalFiles) {
    const fullPath = path.resolve(f);
    assert(fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0, `File exists and non-empty: ${f}`);
  }

  // 2. Test Simulation Engine
  console.log('\n--- 2. Discrete Simulation Engine & Stratified Event Queue ---');
  const defaults = await import('../src/lib/defaults.ts');
  const simModule = await import('../src/lib/simulation/simulator.ts');
  const simulator = new simModule.VerilogSimulator();

  const simResult = simulator.run(defaults.DEFAULT_DESIGN_VERILOG, defaults.DEFAULT_TESTBENCH_VERILOG, {
    maxSimTime: 200,
  });

  assert(simResult.signals.length > 0, `Signals generated: ${simResult.signals.length}`);
  const clkSig = simResult.signals.find(s => s.name === 'clk');
  const rstSig = simResult.signals.find(s => s.name === 'rst_n');
  const countSig = simResult.signals.find(s => s.name === 'count');

  assert(clkSig !== undefined, 'Found clk signal in simulation');
  assert(clkSig && clkSig.samples.length >= 10, `Clock toggles generated (${clkSig?.samples.length} transitions)`);
  assert(rstSig !== undefined, 'Found rst_n signal in simulation');
  assert(countSig !== undefined, 'Found count[3:0] signal in simulation');

  // Verify reset pulse behavior at 15ns
  const rstAt0 = rstSig?.samples.find(s => s.time === 0);
  const rstAt15 = rstSig?.samples.find(s => s.time === 15);
  assert(rstAt0?.value === '0', 'Reset asserted low (rst_n = 0) at 0ns');
  assert(rstAt15?.value === '1', 'Reset de-asserted high (rst_n = 1) at 15ns');

  // Verify counting behavior: count increases
  const finalCount = countSig?.samples[countSig.samples.length - 1];
  assert(finalCount && parseInt(finalCount.value, 16) > 0, `Counter incremented successfully to ${finalCount?.value}`);

  // 3. Test Combinational Loop Watchdog (100,000 Delta-Cycles Ceiling)
  console.log('\n--- 3. Delta Cycle Watchdog & Runaway Loop Guardrails ---');
  const loopPreset = defaults.PRESET_DESIGNS.find(p => p.id === 'comb-loop');
  const loopSim = new simModule.VerilogSimulator();
  const loopResult = loopSim.run(loopPreset.designCode, loopPreset.testbenchCode, { maxSimTime: 50 });

  assert(loopResult.error !== undefined, 'Watchdog detected combinational loop');
  assert(
    loopResult.error && loopResult.error.includes('Delta cycle threshold exceeded'),
    `Emitted exact required error: "${loopResult.error}"`
  );

  // 4. Test Synthesis Elaboration & Latch Inference Checker
  console.log('\n--- 4. Synthesis Elaboration & Latch Inference Checker ---');
  const synthModule = await import('../src/lib/synthesis/synthesizer.ts');
  const synthesizer = new synthModule.VerilogSynthesizer();

  // Test standard counter synthesis (clean)
  const counterSynth = synthesizer.synthesize(defaults.DEFAULT_DESIGN_VERILOG);
  assert(counterSynth.inferredLatchCount === 0, 'Clean counter: 0 inferred latches');
  assert(counterSynth.fdreCount === 4, `Counter registers: ${counterSynth.fdreCount} FDRE cells`);
  assert(counterSynth.totalLuts > 0, `Counter LUT estimation: ${counterSynth.totalLuts} LUTs`);

  // Test Latch Demo ALU (unintended latch inference)
  const latchPreset = defaults.PRESET_DESIGNS.find(p => p.id === 'latch-demo');
  const latchSynth = synthesizer.synthesize(latchPreset.designCode);
  assert(latchSynth.inferredLatchCount > 0, `Inferred latches detected: ${latchSynth.inferredLatchCount}`);
  assert(
    latchSynth.warnings.some(w => w.includes('[Synth 8-327] Inferring latch for variable')),
    'Emitted [Synth 8-327] Inferring latch warning'
  );

  // 5. Test 1-Click EDA Export Pipeline
  console.log('\n--- 5. 1-Click EDA Export Pipeline ---');
  const vivadoExport = await import('../src/lib/export/vivadoTcl.ts');
  const quartusExport = await import('../src/lib/export/quartusTcl.ts');
  const zipModule = await import('../src/lib/export/zipPackager.ts');

  const vivadoTcl = vivadoExport.generateVivadoTcl('counter', 'tb_counter');
  assert(vivadoTcl.includes('xc7a35tcpg236-1'), 'Vivado Tcl targets Artix-7 xc7a35tcpg236-1');
  assert(vivadoTcl.includes('synth_design'), 'Vivado Tcl contains synth_design command');
  assert(vivadoTcl.includes('launch_simulation'), 'Vivado Tcl contains launch_simulation command');

  const quartusTcl = quartusExport.generateQuartusTcl('counter');
  assert(quartusTcl.includes('Cyclone IV E'), 'Quartus Tcl targets Cyclone IV E');
  assert(quartusTcl.includes('execute_flow -analysis_and_elaboration'), 'Quartus Tcl runs analysis & elaboration');

  const zipBlob = await zipModule.createEdaZipPackage(defaults.DEFAULT_DESIGN_VERILOG, defaults.DEFAULT_TESTBENCH_VERILOG);
  assert(zipBlob !== null && zipBlob.size > 0, `ZIP package created (${zipBlob.size} bytes)`);

  // 6. Test Auto-Harness Generator
  console.log('\n--- 6. Auto-Harness Testbench Generator ---');
  const harnessModule = await import('../src/lib/harness/autoHarness.ts');
  const harnessResult = harnessModule.generateAutoTestbench(defaults.DEFAULT_DESIGN_VERILOG);

  assert(harnessResult.moduleName === 'counter', `Extracted top module: ${harnessResult.moduleName}`);
  assert(harnessResult.isSequential === true, 'Detected sequential design');
  assert(harnessResult.clockPort === 'clk', `Detected clock port: ${harnessResult.clockPort}`);
  assert(harnessResult.resetPort === 'rst_n', `Detected reset port: ${harnessResult.resetPort}`);
  assert(harnessResult.resetActiveLow === true, 'Detected active-low reset polarity');
  assert(harnessResult.inputs.length === 3, `Extracted 3 inputs: ${harnessResult.inputs.map(i => i.name).join(', ')}`);
  assert(harnessResult.outputs.length === 1 && harnessResult.outputs[0].width === 4, 'Extracted 4-bit output: count[3:0]');
  assert(harnessResult.testbenchCode.includes('always #5 clk = ~clk;'), 'Generated free-running 100MHz clock');
  assert(harnessResult.testbenchCode.includes('$dumpfile("dump.vcd");'), 'Included VCD waveform dumping');

  // Test combinational auto-harness (truth-table generation)
  const combVerilog = `module and_gate(input wire a, input wire b, output wire y); assign y = a & b; endmodule`;
  const combHarness = harnessModule.generateAutoTestbench(combVerilog);
  assert(combHarness.isSequential === false, 'Detected purely combinational circuit');
  assert(combHarness.testbenchCode.includes('for (i = 0; i < 4; i = i + 1)'), 'Generated exhaustive truth-table loop');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
