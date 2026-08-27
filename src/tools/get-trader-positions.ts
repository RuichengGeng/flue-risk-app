import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { riskDataService } from '../services/csv-risk-data-service.ts';

export const getTraderPositions = defineTool({
  name: 'get_trader_positions',
  description: 'Retrieve deterministic position rows for one trader from the risk data service.',
  input: v.object({
    trader: v.string(),
  }),
  async run({ data }) {
    return { output: { positions: await riskDataService.getTraderPositions(data.trader) } as unknown as JsonValue };
  },
});
