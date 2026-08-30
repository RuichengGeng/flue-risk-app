import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';
import { runResearchSandbox } from './research-sandbox-runner.ts';

const rowSchema = v.record(v.string(), v.unknown());

function safeWorkbookName(name: string | undefined): string {
  const base = (name || `risk-export-${Date.now()}`).replace(/[^A-Za-z0-9._-]/g, '-');
  return base.endsWith('.xlsx') ? base : `${base}.xlsx`;
}

export const createExcelWorkbook = defineTool({
  name: 'create_excel_workbook',
  description:
    'Use the Excel Worker capability in the Python sandbox to turn the current structured result into a downloadable XLSX workbook.',
  harness: true,
  input: v.object({
    rows: v.array(rowSchema),
    sheet_name: v.optional(v.string(), 'Results'),
    filename: v.optional(v.string()),
  }),
  async run({ data, harness }) {
    const filename = safeWorkbookName(data.filename);
    const outputPath = `artifacts/${filename}`;
    const parsed = (await runResearchSandbox(harness.sandbox, 'excel_export', data, {
      outputPath,
    })) as { path: string; row_count: number };
    return {
      output: {
        ...parsed,
        filename,
        download_url: `/artifacts/${filename}`,
      } as JsonValue,
    };
  },
});
