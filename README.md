# Flue VaR Demo

This demo validates Flue as the agent harness above deterministic risk data services and Python quant/analysis workers.

## Architecture

- `SupervisorAgent` owns user-facing routing across risk, market, performance, and reporting domains.
- Specialist subagents under `src/subagents/` scaffold market, performance, and reporting workflows.
- Capability modules under `src/capabilities/` define typed interfaces, service classes, and Flue tool wrappers.
- `src/capabilities/pi-coding/` wraps Pi SDK as the coding-agent capability for flexible last-mile work.
- `RiskAgent` remains available as the direct risk-analysis agent for focused VaR workflows.
- The hosted VaR MCP server at `https://var.hpapacvarserver.com/mcp` provides real position VaR through `calc_var_for_positions`.
- CSV-backed risk services own positions, total VaR, and component-risk retrieval.
- Python owns deterministic numerical work:
  - `python/quant.py` prices Black-Scholes options.
  - `python/research_sandbox.py` is the shared last-mile engine for structured analysis, standard Excel export, and future ad-hoc code execution.
  - `python/data_analysis.py`, `python/ad_hoc_analysis.py`, and `python/excel_worker.py` remain compatibility wrappers around the shared Research Sandbox engine.
- The agents use broad capabilities rather than one-off aggregation/export tools.

Current scalable layout:

```text
src/agents/supervisor-agent.ts
src/agents/risk-agent.ts
src/subagents/market-analyst.ts
src/subagents/performance-analyst.ts
src/subagents/report-analyst.ts
src/capabilities/risk-analysis/use-risk-capabilities.ts
src/capabilities/pi-coding/
src/capabilities/market-analysis/
src/capabilities/performance-metrics/
src/capabilities/reporting/
```

The market, performance, and reporting services intentionally return `not_implemented` until their business implementations are provided.

Last-mile dataframe and artifact work keeps stable TypeScript tool surfaces backed by one Python engine:

```text
run_pi_coding_session   -> Pi SDK coding agent with Flue sandbox execution tool
run_data_analysis       -> python/research_sandbox.py mode=data_analysis
create_excel_workbook   -> python/research_sandbox.py mode=excel_export
run_ad_hoc_analysis     -> python/research_sandbox.py mode=ad_hoc_analysis
```

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

The browser uses the supervisor route. You can also send messages directly:

```bash
curl -X POST http://localhost:5173/agents/supervisor/alice-demo \
  -H 'content-type: application/json' \
  -d '{"kind":"user","body":"What is Alice'\''s VaR and component risk?"}'
```

Read history:

```bash
curl "http://localhost:5173/agents/supervisor/alice-demo?view=history"
```

Excel files are written under `artifacts/` and exposed by the dev server at `/artifacts/<filename>`.

## Demo Prompts

- `What is Alice's VaR and component risk?`
- `Use the real VaR server for HO September 2026 delta 100 and BRN October 2026 delta 50 on valuation date 2026-07-31.`
- `Aggregate all Brent contracts together, put all equities together, and leave WTI separate.`
- `Now split equities by sector and show the top contributors.`
- `Run an ad-hoc research sandbox task over Alice's component risk table.`
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
