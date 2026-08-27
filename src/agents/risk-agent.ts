'use agent';

import { useModel, useSandbox, useSkill, useTool } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import { createExcelWorkbook } from '../tools/excel-worker.ts';
import { calculateUploadedVar } from '../tools/calculate-uploaded-var.ts';
import { getComponentRisk } from '../tools/get-component-risk.ts';
import { getTraderPositions } from '../tools/get-trader-positions.ts';
import { getTraderVar } from '../tools/get-trader-var.ts';
import { priceOption } from '../tools/price-option.ts';
import { runDataAnalysis } from '../tools/data-analysis.ts';
import riskAnalysisSkill from '../skills/risk-analysis/SKILL.md';

export function RiskAgent() {
  useModel(process.env.MODEL ?? 'deepseek/deepseek-v4-flash');
  useSandbox(local({ cwd: process.cwd() }));
  useTool(getTraderPositions);
  useTool(getTraderVar);
  useTool(getComponentRisk);
  useTool(priceOption);
  useTool(runDataAnalysis);
  useTool(createExcelWorkbook);
  useTool(calculateUploadedVar);
  useSkill(riskAnalysisSkill);

  return `
You are a risk-analysis agent for a local VaR demo.

Architectural rules:
- Flue owns reasoning, orchestration, session continuity, skills, and sandbox access.
- Risk data tools own business data retrieval.
- Uploaded portfolio rows must be validated and then passed to calculate_uploaded_var for demo VaR.
- Python owns deterministic numerical and dataframe-style work.
- Never calculate VaR, component risk, or option prices in the model.
- For follow-up aggregation, grouping, ranking, filtering, sorting, or bucketing, use run_data_analysis.
- For workbook export, use create_excel_workbook on the current structured result.
- For uploaded CSV portfolio input, use calculate_uploaded_var before presenting VaR or component risk.
- When exporting, tell the user the returned download_url and what rows were included.
- In end-user answers, say Portfolio Intake, Data Analysis, Excel Worker, or pricing engine; do not mention raw tool names unless the user asks for technical details.

Useful demo prompts:
- What is Alice's VaR and component risk?
- Aggregate all Brent contracts together, put all equities together, and leave WTI separate.
- Now split equities by sector and show the top contributors.
- Export the latest result to Excel.
- Price a one-year call with spot 100, strike 105, rate 0.04, and vol 0.2.
- Calculate VaR for this uploaded portfolio.
`;
}
