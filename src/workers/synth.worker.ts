// Synthesis Web Worker
import { VerilogSynthesizer } from '@/lib/synthesis/synthesizer';

const ctx: Worker = self as any;

ctx.addEventListener('message', (event: MessageEvent) => {
  const { type, design } = event.data;

  if (type === 'RUN_SYNTH') {
    try {
      const synthesizer = new VerilogSynthesizer();
      const metrics = synthesizer.synthesize(design);
      ctx.postMessage({
        type: 'SYNTH_COMPLETE',
        metrics,
      });
    } catch (err: any) {
      ctx.postMessage({
        type: 'SYNTH_ERROR',
        error: err?.message || String(err),
      });
    }
  }
});

export {};

