import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const priceOption = defineTool({
  name: 'price_option',
  description: 'Price one European option by calling the Python Black-Scholes implementation in the sandbox.',
  harness: true,
  input: v.object({
    spot: v.number(),
    strike: v.number(),
    rate: v.number(),
    vol: v.number(),
    maturity: v.number(),
    option_type: v.optional(v.picklist(['call', 'put']), 'call'),
  }),
  async run({ data, harness }) {
    const inputPath = `.flue-workspace/price-option-${Date.now()}.json`;
    await harness.sandbox.writeFile(inputPath, JSON.stringify(data));
    const result = await harness.sandbox.exec(`python3 python/bridge.py --input ${inputPath}`, {
      timeoutMs: 10_000,
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Python option pricing failed');
    }

    return { output: JSON.parse(result.stdout) as { price: number } };
  },
});
