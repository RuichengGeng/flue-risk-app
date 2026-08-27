export interface UploadedPortfolioRow {
  trader?: string;
  contract: string;
  asset_class?: string;
  product?: string;
  sector?: string;
  position: number;
  component_var?: number;
  price?: number;
  vol?: number;
}

export interface UploadedComponentRiskRow {
  trader: string;
  contract: string;
  asset_class: string;
  product: string;
  sector: string;
  position: number;
  component_var: number;
}

export interface UploadedVarResult {
  source: 'uploaded_portfolio';
  method: string;
  total_var: number;
  currency: 'USD';
  row_count: number;
  rows: UploadedComponentRiskRow[];
  warnings: string[];
}

function riskFactor(row: UploadedPortfolioRow): number {
  const assetClass = row.asset_class?.toLowerCase() ?? '';
  if (assetClass.includes('option')) return 0.28;
  if (assetClass.includes('commodity')) return 0.18;
  if (assetClass.includes('equity')) return 0.12;
  return 0.1;
}

function componentVar(row: UploadedPortfolioRow): number {
  if (typeof row.component_var === 'number' && Number.isFinite(row.component_var)) {
    return Math.abs(row.component_var);
  }
  const price = typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : 100;
  const vol = typeof row.vol === 'number' && Number.isFinite(row.vol) ? row.vol : riskFactor(row);
  return Math.round(Math.abs(row.position) * price * vol * 10);
}

export function calculateUploadedPortfolioVar(
  rows: UploadedPortfolioRow[],
  confidenceNote?: string,
): UploadedVarResult {
  const componentRows = rows.map((row) => ({
    trader: row.trader ?? 'Uploaded',
    contract: row.contract,
    asset_class: row.asset_class ?? 'Unknown',
    product: row.product ?? row.contract,
    sector: row.sector ?? 'Unknown',
    position: row.position,
    component_var: componentVar(row),
  }));

  return {
    source: 'uploaded_portfolio',
    method: 'uploaded_component_var_or_mock_abs_position_price_vol_x10',
    total_var: componentRows.reduce((total, row) => total + row.component_var, 0),
    currency: 'USD',
    row_count: componentRows.length,
    rows: componentRows,
    warnings: confidenceNote ? [confidenceNote] : [],
  };
}
