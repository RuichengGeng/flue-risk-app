import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { riskDataService } from '../services/csv-risk-data-service.ts';

export const getComponentRisk = defineTool({
  name: 'get_component_risk',
  description: 'Retrieve deterministic contract-level component VaR rows for one trader.',
  input: v.object({
    trader: v.string(),
  }),
  async run({ data }) {
    return { output: { rows: await riskDataService.getComponentRisk(data.trader) } as unknown as JsonValue };
  },
});
