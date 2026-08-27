import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { calculateUploadedPortfolioVar } from '../services/uploaded-var-service.ts';

const uploadedRowSchema = v.object({
  trader: v.optional(v.string()),
  contract: v.string(),
  asset_class: v.optional(v.string()),
  product: v.optional(v.string()),
  sector: v.optional(v.string()),
  position: v.number(),
  component_var: v.optional(v.number()),
  price: v.optional(v.number()),
  vol: v.optional(v.number()),
});

export const calculateUploadedVar = defineTool({
  name: 'calculate_uploaded_var',
  description:
    'Calculate demo portfolio VaR and component VaR from normalized user-uploaded portfolio rows. Uses supplied component_var when present; otherwise applies a deterministic mock rule.',
  input: v.object({
    rows: v.array(uploadedRowSchema),
    confidence_note: v.optional(v.string()),
  }),
  async run({ data }) {
    const output = calculateUploadedPortfolioVar(data.rows, data.confidence_note);
    return { output: output as unknown as JsonValue };
  },
});
