# Flue VaR Demo

This demo validates Flue as the agent harness above deterministic risk data services and Python quant/analysis workers.

## Architecture

- `RiskAgent` owns reasoning, session continuity, skill instructions, and sandbox access.
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
- `Aggregate all Brent contracts together, put all equities together, and leave WTI separate.`
- `Now split equities by sector and show the top contributors.`
- `Export the latest result to Excel.`
- `Price a one-year call with spot 100, strike 105, rate 0.04, and vol 0.2.`

## Test

```bash
npm test
npm run check
```
