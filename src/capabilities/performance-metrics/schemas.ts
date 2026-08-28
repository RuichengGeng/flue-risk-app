import * as v from 'valibot';

export const performanceMetricsInputSchema = v.object({
  question: v.string(),
  portfolio_id: v.optional(v.string()),
  benchmark: v.optional(v.string()),
  start_date: v.optional(v.string()),
  end_date: v.optional(v.string()),
  metrics: v.optional(v.array(v.picklist(['return', 'pnl', 'sharpe', 'drawdown', 'attribution', 'hit_rate']))),
});

export type PerformanceMetricsInput = v.InferInput<typeof performanceMetricsInputSchema>;

export interface PerformanceMetricsResult {
  status: 'not_implemented' | 'ok';
  summary: string;
  metrics?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
}
