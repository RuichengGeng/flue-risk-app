import { defineTool, type JsonValue } from '@flue/runtime';
import { notImplementedResult, NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import { marketAnalysisInputSchema } from './schemas.ts';
import { marketAnalysisService } from './service.ts';

export const runMarketAnalysis = defineTool({
  name: 'run_market_analysis',
  description:
    'Analyze market moves, price action, curve changes, volatility, and market drivers. This capability is scaffolded and returns not_implemented until the service is completed.',
  input: marketAnalysisInputSchema,
  async run({ data }) {
    try {
      return { output: (await marketAnalysisService.analyze(data)) as unknown as JsonValue };
    } catch (error) {
      if (error instanceof NotImplementedCapabilityError) {
        return {
          output: notImplementedResult('Market Analysis', {
            question: data.question,
            symbols: data.symbols ?? [],
            horizon: data.horizon ?? null,
          }) as JsonValue,
        };
      }
      throw error;
    }
  },
});
