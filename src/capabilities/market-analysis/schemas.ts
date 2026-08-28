import * as v from 'valibot';

export const marketAnalysisInputSchema = v.object({
  question: v.string(),
  symbols: v.optional(v.array(v.string())),
  asset_classes: v.optional(v.array(v.string())),
  horizon: v.optional(v.string()),
  required_outputs: v.optional(v.array(v.picklist(['summary', 'drivers', 'chart', 'table']))),
});

export type MarketAnalysisInput = v.InferInput<typeof marketAnalysisInputSchema>;

export interface MarketAnalysisResult {
  status: 'not_implemented' | 'ok';
  summary: string;
  drivers?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
}
