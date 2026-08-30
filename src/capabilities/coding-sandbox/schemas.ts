import * as v from 'valibot';

const rowSchema = v.record(v.string(), v.unknown());

export const codingSandboxInputSchema = v.object({
  task: v.string(),
  tables: v.record(v.string(), v.array(rowSchema)),
  python_code: v.string(),
  context: v.optional(v.string()),
  constraints: v.optional(v.array(v.string())),
  expected_outputs: v.optional(v.array(v.picklist(['summary', 'table', 'chart', 'excel', 'json', 'csv']))),
});

export type CodingSandboxInput = v.InferInput<typeof codingSandboxInputSchema>;

export interface CodingSandboxResult {
  status: 'ok';
  summary: string;
  tables: Record<string, Array<Record<string, unknown>>>;
  artifacts: Array<{
    kind: 'csv' | 'excel' | 'json';
    path: string;
    download_url: string;
  }>;
  diagnostics: string[];
}
