import type { Sandbox } from '@flue/runtime';

export async function runResearchSandbox(
  sandbox: Sandbox,
  mode: 'data_analysis' | 'excel_export' | 'ad_hoc_analysis',
  payload: unknown,
  options?: {
    outputPath?: string;
    timeoutMs?: number;
  },
) {
  const inputPath = `.flue-workspace/research-sandbox-${mode}-${Date.now()}.json`;
  await sandbox.writeFile(inputPath, JSON.stringify({ mode, payload, output_path: options?.outputPath }));
  const result = await sandbox.exec(`python3 python/research_sandbox.py --input ${inputPath}`, {
    timeoutMs: options?.timeoutMs ?? 10_000,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Research Sandbox ${mode} failed`);
  }

  return JSON.parse(result.stdout);
}
