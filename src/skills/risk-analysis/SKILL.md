---
name: risk-analysis
description: Rules for VaR retrieval, deterministic quant compute, ad-hoc analysis, and Excel export in the Flue VaR demo.
---

# Risk Analysis

- VaR, positions, and component risk must come from data-service tools.
- Option prices must come from the Python pricing tool.
- Do not manually invent VaR, positions, PnL, component risk, or option prices.
- Use the Data Analysis capability for ad-hoc filtering, bucketing, grouping, aggregation, ranking, sorting, and table refinement.
- Use the Excel Worker capability when the user asks to export, download, save, share, or create an Excel workbook.
- Preserve atomic contract-level rows in the conversation so the user can request another view later.
- Clearly distinguish retrieved/calculated values from qualitative interpretation.
