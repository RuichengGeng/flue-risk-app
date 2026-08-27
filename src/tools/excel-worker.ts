import { defineTool, type JsonValue } from '@flue/runtime';
import * as v from 'valibot';

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
    const inputPath = `.flue-workspace/excel-worker-${Date.now()}.json`;
    const outputPath = `artifacts/${filename}`;
    await harness.sandbox.writeFile(inputPath, JSON.stringify(data));
    const result = await harness.sandbox.exec(`python3 python/excel_worker.py --input ${inputPath} --output ${outputPath}`, {
      timeoutMs: 10_000,
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Python Excel export failed');
    }

    const parsed = JSON.parse(result.stdout) as { path: string; row_count: number };
    return {
      output: {
        ...parsed,
        filename,
        download_url: `/artifacts/${filename}`,
      } as JsonValue,
    };
  },
});
