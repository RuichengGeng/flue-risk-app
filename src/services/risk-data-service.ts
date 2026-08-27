export interface Position {
  trader: string;
  contract: string;
  asset_class: string;
  product: string;
  sector: string;
  position: number;
}

export interface ComponentRiskRow extends Position {
  component_var: number;
}

export interface VarSummary {
  trader: string;
  total_var: number;
  method: string;
  currency: string;
  as_of: string;
}

export interface RiskDataService {
  getTraderPositions(trader: string): Promise<Position[]>;
  getTraderVar(trader: string): Promise<VarSummary>;
  getComponentRisk(trader: string): Promise<ComponentRiskRow[]>;
}
