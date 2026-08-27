import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { riskDataService } from '../services/csv-risk-data-service.ts';

export const getTraderVar = defineTool({
  name: 'get_trader_var',
  description: 'Retrieve deterministic total VaR for one trader from the risk data service.',
  input: v.object({
    trader: v.string(),
  }),
  async run({ data }) {
    return { output: (await riskDataService.getTraderVar(data.trader)) as unknown as JsonValue };
  },
});
