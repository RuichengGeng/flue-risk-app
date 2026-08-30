import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { riskDataService } from '../src/services/csv-risk-data-service.ts';
import { calculateUploadedPortfolioVar } from '../src/services/uploaded-var-service.ts';

const execFileAsync = promisify(execFile);

test('retrieves deterministic Alice VaR from the CSV-backed service', async () => {
  const summary = await riskDataService.getTraderVar('Alice');
  assert.equal(summary.total_var, 1_440_000);
  assert.equal(summary.method, 'demo_sum_of_component_var');
});

test('runs Black-Scholes pricing in Python', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flue-var-demo-'));
  const input = join(dir, 'price.json');
  await writeFile(
    input,
    JSON.stringify({
      spot: 100,
      strike: 105,
      rate: 0.04,
      vol: 0.2,
      maturity: 1,
      option_type: 'call',
    }),
  );

  const { stdout } = await execFileAsync('python3', ['python/bridge.py', '--input', input]);
  const result = JSON.parse(stdout) as { price: number };
  assert.ok(result.price > 7);
  assert.ok(result.price < 9);
});

test('aggregates Brent and equities through the Python Data Analysis capability', async () => {
  const rows = await riskDataService.getComponentRisk('Alice');
  const dir = await mkdtemp(join(tmpdir(), 'flue-var-demo-'));
  const input = join(dir, 'analysis.json');
  await writeFile(
    input,
    JSON.stringify({
      rows,
      spec: {
        bucket: {
          column: 'risk_bucket',
          rules: [
            { label: 'Brent', when: [{ column: 'product', operator: 'eq', value: 'Brent' }] },
            { label: 'Equity', when: [{ column: 'asset_class', operator: 'eq', value: 'Equity' }] },
          ],
          default_column: 'product',
        },
        group_by: ['risk_bucket'],
        aggregations: [
          { column: 'component_var', function: 'sum', as: 'total_component_var' },
          { column: 'risk_bucket', function: 'count', as: 'contracts' },
        ],
        sort: { column: 'total_component_var', direction: 'desc' },
      },
    }),
  );

  const { stdout } = await execFileAsync('python3', ['python/data_analysis.py', '--input', input]);
  const result = JSON.parse(stdout) as { rows: Array<{ risk_bucket: string; total_component_var: number }> };
  assert.deepEqual(result.rows, [
    { risk_bucket: 'Brent', total_component_var: 760_000, contracts: 2 },
    { risk_bucket: 'Equity', total_component_var: 400_000, contracts: 2 },
    { risk_bucket: 'WTI', total_component_var: 280_000, contracts: 1 },
  ]);
});

test('creates a valid XLSX package through the Python Excel Worker capability', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flue-var-demo-'));
  const input = join(dir, 'excel.json');
  const output = join(dir, 'result.xlsx');
  await writeFile(
    input,
    JSON.stringify({
      rows: [
        { risk_bucket: 'Brent', total_component_var: 760_000 },
        { risk_bucket: 'Equity', total_component_var: 400_000 },
      ],
      sheet_name: 'Aggregated Risk',
    }),
  );

  const { stdout } = await execFileAsync('python3', ['python/excel_worker.py', '--input', input, '--output', output]);
  const result = JSON.parse(stdout) as { path: string; row_count: number };
  assert.equal(result.row_count, 2);

  const bytes = await readFile(result.path);
  assert.equal(bytes.subarray(0, 2).toString('utf8'), 'PK');
});

test('calculates demo VaR from uploaded normalized portfolio rows', () => {
  const result = calculateUploadedPortfolioVar([
    {
      trader: 'Uploaded',
      contract: 'AAPL',
      asset_class: 'Equity',
      product: 'AAPL',
      sector: 'Technology',
      position: 10,
      component_var: 1200,
    },
    {
      trader: 'Uploaded',
      contract: 'CLZ6',
      asset_class: 'Commodity',
      product: 'WTI',
      sector: 'Oil',
      position: -5,
      price: 80,
      vol: 0.25,
    },
  ]);

  assert.equal(result.total_var, 2_200);
  assert.deepEqual(
    result.rows.map((row) => row.component_var),
    [1_200, 1_000],
  );
});

test('returns not implemented from the ad-hoc analysis worker scaffold', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flue-var-demo-'));
  const input = join(dir, 'ad-hoc.json');
  await writeFile(
    input,
    JSON.stringify({
      task: 'Calculate a custom risk diagnostic.',
      tables: {
        component_risk: [
          { product: 'Brent', component_var: 760_000 },
          { product: 'WTI', component_var: 280_000 },
        ],
      },
      expected_outputs: [{ kind: 'summary' }],
    }),
  );

  const { stdout } = await execFileAsync('python3', ['python/ad_hoc_analysis.py', '--input', input]);
  const result = JSON.parse(stdout) as { status: string; diagnostics: string[] };
  assert.equal(result.status, 'not_implemented');
  assert.ok(result.diagnostics.some((item) => item.includes('component_risk: 2 rows')));
});
