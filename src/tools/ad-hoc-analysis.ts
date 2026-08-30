import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { runResearchSandbox } from './research-sandbox-runner.ts';

const rowSchema = v.record(v.string(), v.unknown());

const artifactRequestSchema = v.object({
  kind: v.picklist(['table', 'chart', 'excel', 'summary']),
  name: v.optional(v.string()),
});

const adHocAnalysisInputSchema = v.object({
  task: v.string(),
  tables: v.record(v.string(), v.array(rowSchema)),
  context: v.optional(v.string()),
  constraints: v.optional(v.array(v.string())),
  expected_outputs: v.optional(v.array(artifactRequestSchema)),
});

export type AdHocAnalysisInput = v.InferInput<typeof adHocAnalysisInputSchema>;

export interface AdHocAnalysisResult {
  status: 'not_implemented' | 'ok';
  summary: string;
  tables?: Record<string, Array<Record<string, unknown>>>;
  artifacts?: Array<{
    kind: 'chart' | 'excel' | 'csv' | 'json';
    path: string;
    download_url?: string;
  }>;
  diagnostics?: string[];
}

export const runAdHocAnalysis = defineTool({
  name: 'run_ad_hoc_analysis',
  description:
    'Use the Research Sandbox for ad-hoc analysis tasks that require custom Python logic over explicitly provided tables. This scaffold currently returns not_implemented until the Python worker is completed.',
  harness: true,
  input: adHocAnalysisInputSchema,
  async run({ data, harness }) {
    return { output: (await runResearchSandbox(harness.sandbox, 'ad_hoc_analysis', data)) as JsonValue };
  },
});
