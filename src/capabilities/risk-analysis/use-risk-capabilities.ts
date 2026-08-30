import { useMcpConnection, useSkill, useTool } from '@flue/runtime';
import { runPiCodingSessionTool } from '../pi-coding/tool.ts';
import { positionVarMcp } from '../../connections/position-var-mcp.ts';
import riskAnalysisSkill from '../../skills/risk-analysis/SKILL.md';
import { runAdHocAnalysis } from '../../tools/ad-hoc-analysis.ts';
import { calculateUploadedVar } from '../../tools/calculate-uploaded-var.ts';
import { runDataAnalysis } from '../../tools/data-analysis.ts';
import { createExcelWorkbook } from '../../tools/excel-worker.ts';
import { getComponentRisk } from '../../tools/get-component-risk.ts';
import { getTraderPositions } from '../../tools/get-trader-positions.ts';
import { getTraderVar } from '../../tools/get-trader-var.ts';
import { priceOption } from '../../tools/price-option.ts';

export function useRiskCapabilities() {
  useMcpConnection(positionVarMcp);
  useTool(getTraderPositions);
  useTool(getTraderVar);
  useTool(getComponentRisk);
  useTool(priceOption);
  useTool(runDataAnalysis);
  useTool(runAdHocAnalysis);
  useTool(runPiCodingSessionTool);
  useTool(createExcelWorkbook);
  useTool(calculateUploadedVar);
  useSkill(riskAnalysisSkill);
}
