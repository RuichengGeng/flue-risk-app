import { defineSubagent, useTool } from '@flue/runtime';
import { calculatePerformanceMetrics } from '../capabilities/performance-metrics/tool.ts';

function PerformanceAnalyst() {
  useTool(calculatePerformanceMetrics);

  return `
You are a performance analyst subagent.

Use calculate_performance_metrics for returns, PnL attribution, Sharpe, drawdown, hit-rate, benchmark, and portfolio performance questions.
If the capability returns not_implemented, explain that the Performance Metrics interface is scaffolded and needs the service implementation.
Return a concise final answer to the supervisor.
`;
}

export const performanceAnalyst = defineSubagent({
  name: 'performance_analyst',
  description: 'Calculates and explains portfolio performance, returns, PnL attribution, Sharpe, drawdown, and benchmark-relative results.',
  agent: PerformanceAnalyst,
});
