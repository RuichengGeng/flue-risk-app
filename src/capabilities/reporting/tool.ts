import { defineTool, type JsonValue } from '@flue/runtime';
import { notImplementedResult, NotImplementedCapabilityError } from '../shared/not-implemented.ts';
import { reportRequestSchema } from './schemas.ts';
import { reportingService } from './service.ts';

export const createReport = defineTool({
  name: 'create_report',
  description:
    'Create user-facing risk, market, and performance reports. This capability is scaffolded and returns not_implemented until the reporting service is completed.',
  input: reportRequestSchema,
  async run({ data }) {
    try {
      return { output: (await reportingService.create(data)) as unknown as JsonValue };
    } catch (error) {
      if (error instanceof NotImplementedCapabilityError) {
        return {
          output: notImplementedResult('Reporting', {
            objective: data.objective,
            output_format: data.output_format,
            sections: data.sections ?? [],
          }) as JsonValue,
        };
      }
      throw error;
    }
  },
});
