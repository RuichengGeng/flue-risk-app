import { defineTool, type JsonValue } from '@flue/runtime';
import { runPiCodingSession } from './pi-coding-session.ts';
import { piCodingSessionInputSchema } from './schemas.ts';

export const runPiCodingSessionTool = defineTool({
  name: 'run_pi_coding_session',
  description:
    'Start a Pi coding-agent session for flexible last-mile work over explicitly provided tables. Use this after official data has been retrieved, for dynamic aggregation, filtering, chart/report/artifact creation, and custom Python workflows.',
  harness: true,
  input: piCodingSessionInputSchema,
  async run({ data, harness }) {
    return {
      output: (await runPiCodingSession(data, harness.sandbox)) as unknown as JsonValue,
    };
  },
});
