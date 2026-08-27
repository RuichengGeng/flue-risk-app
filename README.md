# Flue VaR Demo

This demo validates Flue as the agent harness above deterministic risk data services and Python quant/analysis workers.

## Architecture

- `RiskAgent` owns reasoning, session continuity, skill instructions, sandbox access, and MCP tool mounting.
- The hosted VaR MCP server at `https://var.hpapacvarserver.com/mcp` provides real position VaR through `calc_var_for_positions`.
- CSV-backed risk services own positions, total VaR, and component-risk retrieval.
- Python owns deterministic numerical work:
  - `python/quant.py` prices Black-Scholes options.
  - `python/data_analysis.py` powers the Data Analysis capability.
  - `python/excel_worker.py` powers the Excel Worker capability.
- The agent uses broad capabilities rather than one-off aggregation/export tools.

## Setup

```bash
npm install
```

Create `.env` with your DeepSeek key:

```bash
DEEPSEEK_API_KEY="your-key"
MODEL="deepseek/deepseek-v4-flash"
```

## Run

CLI agent:

```bash
npm run agent -- --id alice-demo --message "What is Alice's VaR and component risk?"
npm run agent -- --id alice-demo --message "Aggregate all Brent contracts together, put all equities together, and leave WTI separate."
npm run agent -- --id alice-demo --message "Export the latest result to Excel."
```

Local server:

```bash
npm run dev
```

Then send messages to:

```bash
curl -X POST http://localhost:5173/agents/risk/alice-demo \
  -H 'content-type: application/json' \
  -d '{"kind":"user","body":"What is Alice'\''s VaR and component risk?"}'
```

Read history:

```bash
curl "http://localhost:5173/agents/risk/alice-demo?view=history"
```

Excel files are written under `artifacts/` and exposed by the dev server at `/artifacts/<filename>`.

## Demo Prompts

- `What is Alice's VaR and component risk?`
- `Use the real VaR server for HO September 2026 delta 100 and BRN October 2026 delta 50 on valuation date 2026-07-31.`
- `Aggregate all Brent contracts together, put all equities together, and leave WTI separate.`
- `Now split equities by sector and show the top contributors.`
- `Export the latest result to Excel.`
- `Price a one-year call with spot 100, strike 105, rate 0.04, and vol 0.2.`

## Portfolio Upload

The browser page includes a Portfolio Intake panel for user-provided portfolio data.

Supported in this version:

- CSV upload
- client-side column normalization
- parsed-row preview
- parser warnings
- deterministic demo VaR through `calculate_uploaded_var`
- CSV template download at `/templates/portfolio.csv`

Expected local-demo columns:

```csv
trader,contract,asset_class,product,sector,position,component_var,price,vol
```

`component_var` is optional. When it is missing, the demo uses a deterministic mock rule based on absolute position, price, and volatility. Screenshot/image intake is intentionally marked as a next step because this local text route does not yet include a vision/OCR worker.

Expected real-MCP columns:

```csv
curve_alias,contract_month,delta
```

The browser parser also accepts common aliases like `Px_Location`, `Contract Month`, `nondisc_DeltaPosition`, and `delta_units`. Rows with these fields are routed to the hosted Real VaR Server. If the server cannot map a curve alias, the agent reports the unmatched rows instead of substituting mock VaR.

## Test

```bash
npm test
npm run check
```
