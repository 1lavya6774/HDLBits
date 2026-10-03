import { generateAutoTestbench } from '../src/lib/harness/autoHarness.ts';
import { VerilogSimulator } from '../src/lib/simulation/simulator.ts';
import { VerilogSynthesizer } from '../src/lib/synthesis/synthesizer.ts';

const fullAdderRtl = `// 1-Bit Full Adder
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (b & cin) | (a & cin);
endmodule
`;

console.log('====================================================');
console.log('TESTING FULL ADDER VERILOG PIPELINE');
console.log('====================================================\n');

// 1. Auto-Harness
console.log('--- 1. Auto-Harness Generation ---');
const harness = generateAutoTestbench(fullAdderRtl);
console.log('Detected Top Module:', harness.moduleName);
console.log('Is Sequential:', harness.isSequential);
console.log('Inputs:', harness.inputs.map(i => i.name).join(', '));
console.log('Outputs:', harness.outputs.map(o => o.name).join(', '));
console.log('\nGenerated Auto-Testbench Code:');
console.log(harness.testbenchCode);

// 2. Simulation
console.log('\n--- 2. Discrete Stratified Simulation ---');
const sim = new VerilogSimulator();
const result = sim.run(fullAdderRtl, harness.testbenchCode, { maxSimTime: 100 });
console.log('Simulation Signals:', result.signals.map(s => s.name).join(', '));

// Print Truth Table from Simulation
console.log('\n--- 3. Verified Truth Table Output ---');
console.log('| Time (ns) | A | B | Cin | Sum | Cout | Expected (Sum, Cout) | Status |');
console.log('|-----------|---|---|-----|-----|------|----------------------|--------|');

const aSig = result.signals.find(s => s.name === 'a');
const bSig = result.signals.find(s => s.name === 'b');
const cinSig = result.signals.find(s => s.name === 'cin');
const sumSig = result.signals.find(s => s.name === 'sum');
const coutSig = result.signals.find(s => s.name === 'cout');

function getValAt(sig, time) {
  if (!sig || !sig.samples) return 'x';
  let val = 'x';
  for (const s of sig.samples) {
    if (s.time <= time) val = s.value;
    else break;
  }
  return val;
}

let allPassed = true;
for (let i = 0; i < 8; i++) {
  const t = i * 10;
  const a = getValAt(aSig, t);
  const b = getValAt(bSig, t);
  const cin = getValAt(cinSig, t);
  const sum = getValAt(sumSig, t);
  const cout = getValAt(coutSig, t);

  const expA = (i >> 2) & 1;
  const expB = (i >> 1) & 1;
  const expCin = i & 1;
  const expSum = expA ^ expB ^ expCin;
  const expCout = (expA & expB) | (expB & expCin) | (expA & expCin);

  const passed = (parseInt(sum) === expSum) && (parseInt(cout) === expCout);
  if (!passed) allPassed = false;

  console.log(`| ${String(t).padEnd(9)} | ${a} | ${b} | ${cin}   | ${sum}   | ${cout}    | Sum=${expSum}, Cout=${expCout}       | ${passed ? '✓ PASS' : '✗ FAIL'} |`);
}

// 4. Synthesis
console.log('\n--- 4. Synthesis & Cell Estimation ---');
const synth = new VerilogSynthesizer();
const synthRes = synth.synthesize(fullAdderRtl);
console.log('LUT Count:', synthRes.totalLuts);
console.log('IBUF Count:', synthRes.ibufCount);
console.log('OBUF Count:', synthRes.obufCount);
console.log('Inferred Latches:', synthRes.inferredLatchCount);
console.log('Warnings:', synthRes.warnings.length === 0 ? 'None (Clean)' : synthRes.warnings);

console.log('\n====================================================');
console.log(allPassed ? 'ALL FULL ADDER TESTS PASSED!' : 'SOME TESTS FAILED');
console.log('====================================================');
