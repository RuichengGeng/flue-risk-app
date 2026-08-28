import { defineSubagent, useTool } from '@flue/runtime';
import { createReport } from '../capabilities/reporting/tool.ts';

function ReportAnalyst() {
  useTool(createReport);

  return `
You are a reporting subagent.

Use create_report for report planning and report generation that combines risk, market, and performance results.
If the capability returns not_implemented, explain that the Reporting interface is scaffolded and needs the service implementation.
Return a concise final answer to the supervisor.
`;
}

export const reportAnalyst = defineSubagent({
  name: 'report_analyst',
  description: 'Creates user-facing risk, market, and performance reports from structured analysis results.',
  agent: ReportAnalyst,
});
