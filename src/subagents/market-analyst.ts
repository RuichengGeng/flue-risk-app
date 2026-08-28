import { defineSubagent, useTool } from '@flue/runtime';
import { runMarketAnalysis } from '../capabilities/market-analysis/tool.ts';

function MarketAnalyst() {
  useTool(runMarketAnalysis);

  return `
You are a market analyst subagent.

Use run_market_analysis for market moves, price action, curve changes, volatility, and market-driver questions.
If the capability returns not_implemented, explain that the Market Analysis interface is scaffolded and needs the service implementation.
Return a concise final answer to the supervisor.
`;
}

export const marketAnalyst = defineSubagent({
  name: 'market_analyst',
  description: 'Analyzes market moves, price action, volatility, curve changes, and market drivers.',
  agent: MarketAnalyst,
});
