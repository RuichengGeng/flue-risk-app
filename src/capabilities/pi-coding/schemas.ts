import * as v from 'valibot';

const rowSchema = v.record(v.string(), v.unknown());

export const piCodingSessionInputSchema = v.object({
  task: v.string(),
  tables: v.record(v.string(), v.array(rowSchema)),
  context: v.optional(v.string()),
  constraints: v.optional(v.array(v.string())),
  expected_outputs: v.optional(v.array(v.picklist(['summary', 'table', 'chart', 'excel', 'json', 'csv']))),
  session_id: v.optional(v.string()),
});

export type PiCodingSessionInput = v.InferInput<typeof piCodingSessionInputSchema>;

export interface PiCodingSessionResult {
  status: 'ok';
  summary: string;
  session_id: string;
  model: string;
  artifacts: Array<{
    kind: string;
    path: string;
    download_url?: string;
  }>;
  diagnostics: string[];
}
