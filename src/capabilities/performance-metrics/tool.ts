import { defineTool, type JsonValue } from '@flue/runtime';
import { notImplementedResult, NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import { performanceMetricsInputSchema } from './schemas.ts';
import { performanceMetricsService } from './service.ts';

export const calculatePerformanceMetrics = defineTool({
  name: 'calculate_performance_metrics',
  description:
    'Calculate portfolio performance metrics such as returns, PnL attribution, Sharpe, drawdown, and benchmark-relative performance. This capability is scaffolded and returns not_implemented until the service is completed.',
  input: performanceMetricsInputSchema,
  async run({ data }) {
    try {
      return { output: (await performanceMetricsService.calculate(data)) as unknown as JsonValue };
    } catch (error) {
      if (error instanceof NotImplementedCapabilityError) {
        return {
          output: notImplementedResult('Performance Metrics', {
            question: data.question,
            portfolio_id: data.portfolio_id ?? null,
            metrics: data.metrics ?? [],
          }) as JsonValue,
        };
      }
      throw error;
    }
  },
});
