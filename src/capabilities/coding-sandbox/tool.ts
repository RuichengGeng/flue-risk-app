import { defineTool, type JsonValue } from '@flue/runtime';
import { codingSandboxInputSchema } from './schemas.ts';

export const runCodingSandbox = defineTool({
  name: 'run_coding_sandbox',
  description:
    'Run generated Python code in the sandbox for flexible last-mile analysis over explicitly provided tables. Use this for dynamic filtering, grouping, custom calculations, and artifact creation after authoritative business data has already been retrieved.',
  harness: true,
  input: codingSandboxInputSchema,
  async run({ data, harness }) {
    const inputPath = `.flue-workspace/coding-sandbox-${Date.now()}.json`;
    await harness.sandbox.writeFile(inputPath, JSON.stringify(data));
    const result = await harness.sandbox.exec(`python3 python/coding_sandbox.py --input ${inputPath}`, {
      timeoutMs: 15_000,
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Coding Sandbox failed');
    }

    return { output: JSON.parse(result.stdout) as JsonValue };
  },
});
