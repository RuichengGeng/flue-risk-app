import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ComponentRiskRow, Position, RiskDataService, VarSummary } from './risk-data-service.ts';

const DATA_PATH = resolve(process.cwd(), 'data/portfolio_risk.csv');

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toNumber(value: string, column: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${column}: ${value}`);
  }
  return parsed;
}

export class CsvRiskDataService implements RiskDataService {
  constructor(private readonly path = DATA_PATH) {}

  async getComponentRisk(trader: string): Promise<ComponentRiskRow[]> {
    const content = await readFile(this.path, 'utf8');
    const [headerLine, ...lines] = content.trim().split(/\r?\n/);
    const headers = parseCsvLine(headerLine);

    return lines
      .map((line) => {
        const values = parseCsvLine(line);
        const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
        return {
          trader: record.trader,
          contract: record.contract,
          asset_class: record.asset_class,
          product: record.product,
          sector: record.sector,
          position: toNumber(record.position, 'position'),
          component_var: toNumber(record.component_var, 'component_var'),
        };
      })
      .filter((row) => row.trader.toLowerCase() === trader.toLowerCase());
  }

  async getTraderPositions(trader: string): Promise<Position[]> {
    return (await this.getComponentRisk(trader)).map(({ component_var: _componentVar, ...position }) => position);
  }

  async getTraderVar(trader: string): Promise<VarSummary> {
    const rows = await this.getComponentRisk(trader);
    return {
      trader,
      total_var: rows.reduce((total, row) => total + row.component_var, 0),
      method: 'demo_sum_of_component_var',
      currency: 'USD',
      as_of: '2026-08-22',
    };
  }
}

export const riskDataService = new CsvRiskDataService();
