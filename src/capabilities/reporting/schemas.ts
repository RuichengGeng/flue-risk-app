import * as v from 'valibot';

export const reportRequestSchema = v.object({
  objective: v.string(),
  audience: v.optional(v.picklist(['trader', 'risk_manager', 'executive', 'client'])),
  sections: v.optional(v.array(v.string())),
  source_results: v.optional(v.array(v.record(v.string(), v.unknown()))),
  output_format: v.optional(v.picklist(['summary', 'excel', 'pdf', 'deck']), 'summary'),
});

export type ReportRequest = v.InferInput<typeof reportRequestSchema>;

export interface ReportResult {
  status: 'not_implemented' | 'ok';
  summary: string;
  sections?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
}
