import type { Sandbox } from '@flue/runtime';
import { Agent, type AgentMessage, type AgentTool } from '@earendil-works/pi-agent-core';
import { createModels, Type } from '@earendil-works/pi-ai';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';
import type { PiCodingSessionInput, PiCodingSessionResult } from './schemas.ts';

function resolveDeepSeekModelId() {
  const configured = process.env.PI_CODING_MODEL ?? process.env.MODEL ?? 'deepseek/deepseek-v4-flash';
  return configured.startsWith('deepseek/') ? configured.slice('deepseek/'.length) : configured;
}

function assistantText(messages: AgentMessage[]) {
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const latest = assistantMessages.at(-1);
  if (!latest || latest.role !== 'assistant') return '';
  return latest.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function extractArtifactReferences(text: string) {
  const matches = text.match(/artifacts\/[A-Za-z0-9._-]+/g) ?? [];
  return [...new Set(matches)].map((path) => {
    const filename = path.split('/').at(-1) ?? path;
    const extension = filename.split('.').at(-1) ?? 'file';
    return {
      kind: extension,
      path,
      download_url: `/artifacts/${filename}`,
    };
  });
}

function createRunPythonTool(sandbox: Sandbox): AgentTool {
  return {
    name: 'run_python',
    label: 'Run Python',
    description:
      'Run short Python code for last-mile dataframe-style transformations and artifact generation. Input tables are available in input.json. Write artifacts under artifacts/.',
    parameters: Type.Object({
      code: Type.String({ description: 'Python code to execute.' }),
      timeout_ms: Type.Optional(Type.Number({ description: 'Execution timeout in milliseconds.' })),
    }),
    executionMode: 'sequential',
    async execute(_toolCallId, params) {
      const typedParams = params as { code: string; timeout_ms?: number };
      const timestamp = Date.now();
      const scriptPath = `.flue-workspace/pi-coding-${timestamp}.py`;
      await sandbox.writeFile(scriptPath, typedParams.code);
      const result = await sandbox.exec(`python3 ${scriptPath}`, {
        timeoutMs: typedParams.timeout_ms ?? 10_000,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
            }),
          },
        ],
        details: {
          script_path: scriptPath,
          exit_code: result.exitCode,
        },
      };
    },
  };
}

export async function runPiCodingSession(
  input: PiCodingSessionInput,
  sandbox: Sandbox,
): Promise<PiCodingSessionResult> {
  const sessionId = input.session_id ?? `pi-coding-${Date.now()}`;
  const modelId = resolveDeepSeekModelId();
  const inputPath = `.flue-workspace/${sessionId}-input.json`;
  await sandbox.writeFile(inputPath, JSON.stringify(input, null, 2));

  if (process.env.PI_CODING_SESSION_MOCK === '1') {
    return {
      status: 'ok',
      summary: 'Pi coding session mock completed.',
      session_id: sessionId,
      model: `deepseek/${modelId}`,
      artifacts: [],
      diagnostics: ['mock=true', `input_path=${inputPath}`],
    };
  }

  const models = createModels();
  models.setProvider(deepseekProvider());
  const model = models.getModel('deepseek', modelId);
  if (!model) {
    throw new Error(`Pi coding model not found: deepseek/${modelId}`);
  }

  const agent = new Agent({
    sessionId,
    streamFn: models.streamSimple.bind(models),
    getApiKey: (provider) => (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : undefined),
    initialState: {
      model,
      thinkingLevel: 'low',
      tools: [createRunPythonTool(sandbox)],
      systemPrompt: `
You are a Pi coding worker embedded inside a Flue financial analysis system.

Your job:
- Solve flexible last-mile analysis tasks by writing and running Python with the run_python tool.
- Use only the explicit data written to ${inputPath}; do not invent business facts.
- Business calculations such as official VaR, pricing, and official performance metrics must come from upstream tools, not from you.
- You may transform, filter, aggregate, reshape, summarize, and create artifacts.
- Write any user-facing files under artifacts/ and mention their paths in the final answer.
- Keep the final answer concise and include the exact files created, if any.
`,
    },
    toolExecution: 'sequential',
  });

  await agent.prompt(`
Task:
${input.task}

Input JSON path:
${inputPath}

Context:
${input.context ?? 'None'}

Constraints:
${(input.constraints ?? []).map((item) => `- ${item}`).join('\n') || '- Use only provided input data.'}

Expected outputs:
${(input.expected_outputs ?? []).map((item) => `- ${item}`).join('\n') || '- summary'}

Use run_python to inspect/process the input JSON and create requested artifacts when needed.
`);

  const summary = assistantText(agent.state.messages);
  return {
    status: 'ok',
    summary,
    session_id: sessionId,
    model: `deepseek/${modelId}`,
    artifacts: extractArtifactReferences(summary),
    diagnostics: [`input_path=${inputPath}`, `messages=${agent.state.messages.length}`],
  };
}
