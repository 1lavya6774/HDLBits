// Simulation Web Worker
import { VerilogSimulator, SimOptions } from '@/lib/simulation/simulator';

const ctx: Worker = self as any;

ctx.addEventListener('message', (event: MessageEvent) => {
  const { type, design, testbench, options } = event.data;

  if (type === 'RUN_SIM') {
    try {
      const simulator = new VerilogSimulator();
      const result = simulator.run(design, testbench, options);
      ctx.postMessage({
        type: 'SIM_COMPLETE',
        result,
      });
    } catch (err: any) {
      ctx.postMessage({
        type: 'SIM_ERROR',
        error: err?.message || String(err),
      });
    }
  }
});

export {};
