import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';

const rowSchema = v.record(v.string(), v.unknown());

const filterSchema = v.object({
  column: v.string(),
  operator: v.optional(v.picklist(['eq', 'ne', 'contains', 'gt', 'gte', 'lt', 'lte']), 'eq'),
  value: v.unknown(),
});

const bucketRuleSchema = v.object({
  label: v.string(),
  when: v.array(filterSchema),
});

const aggregationSchema = v.object({
  column: v.string(),
  function: v.optional(v.picklist(['sum', 'count', 'avg', 'min', 'max']), 'sum'),
  as: v.optional(v.string()),
});

const analysisSpecSchema = v.object({
  filters: v.optional(v.array(filterSchema)),
  bucket: v.optional(
    v.object({
      column: v.string(),
      rules: v.array(bucketRuleSchema),
      default_column: v.optional(v.string()),
      default_value: v.optional(v.string()),
    }),
  ),
  group_by: v.optional(v.array(v.string())),
  aggregations: v.optional(v.array(aggregationSchema)),
  sort: v.optional(
    v.object({
      column: v.string(),
      direction: v.optional(v.picklist(['asc', 'desc']), 'desc'),
    }),
  ),
  top_n: v.optional(v.number()),
  select: v.optional(v.array(v.string())),
});

export const runDataAnalysis = defineTool({
  name: 'run_data_analysis',
  description:
    'Use the Data Analysis capability in the Python sandbox to filter, bucket, group, aggregate, rank, sort, and select structured rows.',
  harness: true,
  input: v.object({
    rows: v.array(rowSchema),
    spec: analysisSpecSchema,
    note: v.optional(v.string()),
  }),
  async run({ data, harness }) {
    const inputPath = `.flue-workspace/data-analysis-${Date.now()}.json`;
    await harness.sandbox.writeFile(inputPath, JSON.stringify(data));
    const result = await harness.sandbox.exec(`python3 python/data_analysis.py --input ${inputPath}`, {
      timeoutMs: 10_000,
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Python data analysis failed');
    }

    return { output: JSON.parse(result.stdout) as JsonValue };
  },
});
