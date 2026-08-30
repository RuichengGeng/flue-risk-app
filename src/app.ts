import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { RiskAgent } from './agents/risk-agent.ts';
import { SupervisorAgent } from './agents/supervisor-agent.ts';

const app = new Hono();

const portfolioTemplate = `trader,contract,asset_class,product,sector,position,component_var,price,vol,curve_alias,contract_month,delta
Alice,BZV6,Commodity,Brent,Oil,100,450000,,
Alice,BZX6,Commodity,Brent,Oil,80,310000,,
Alice,CLZ6,Commodity,WTI,Oil,120,280000,,
Alice,AAPL,Equity,AAPL,Technology,500,160000,,
Alice,NVDA,Equity,NVDA,Technology,300,240000,,
Uploaded,OPT_CALL_105,Option,AAPL,Technology,10,,100,0.2
Uploaded,HO_202609,Commodity,Heating Oil,Oil,,,,,HO,202609,100
Uploaded,BRN_202610,Commodity,Brent,Oil,,,,,BRN,202610,50
`;

const demoPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flue VaR Demo</title>
    <style>
      :root {
        color-scheme: light;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #17202a;
        background: #f7f8fb;
      }

      body {
        margin: 0;
      }

      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 28px 20px 36px;
      }

      header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 20px;
      }

      h1 {
        margin: 0 0 6px;
        font-size: 28px;
        line-height: 1.15;
      }

      p {
        margin: 0;
      }

      .muted {
        color: #667085;
      }

      .status {
        min-width: 128px;
        text-align: right;
        color: #2f6f4e;
        font-size: 14px;
      }

      .top-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #667085;
        font-size: 13px;
        user-select: none;
      }

      .toggle input {
        width: 16px;
        height: 16px;
      }

      .prompts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 18px 0;
      }

      .intake {
        background: #fff;
        border: 1px solid #d9e0ea;
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 14px;
      }

      .intake-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }

      .intake-title {
        font-weight: 700;
      }

      .upload-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      input[type="file"] {
        max-width: 360px;
      }

      .preview {
        display: none;
        margin-top: 12px;
        overflow-x: auto;
      }

      .preview.visible {
        display: block;
      }

      .warnings {
        display: none;
        margin-top: 10px;
        color: #8a5a00;
        background: #fff8e6;
        border: 1px solid #f0d58a;
        border-radius: 6px;
        padding: 9px 11px;
        font-size: 14px;
      }

      .warnings.visible {
        display: block;
      }

      button {
        border: 1px solid #c9d2df;
        background: #fff;
        color: #17202a;
        border-radius: 6px;
        padding: 9px 12px;
        cursor: pointer;
        font: inherit;
      }

      button.primary {
        background: #235b6f;
        border-color: #235b6f;
        color: #fff;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .chat {
        background: #fff;
        border: 1px solid #d9e0ea;
        border-radius: 8px;
        min-height: 420px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .message {
        max-width: 850px;
        border-radius: 8px;
        padding: 12px 14px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .user {
        align-self: flex-end;
        background: #e9f1f5;
      }

      .assistant {
        align-self: flex-start;
        background: #f3f5f8;
      }

      .tool {
        align-self: flex-start;
        color: #667085;
        background: #fafafa;
        border: 1px dashed #d3d8e0;
        font-size: 13px;
      }

      .message p {
        margin: 0 0 10px;
      }

      .message p:last-child {
        margin-bottom: 0;
      }

      .message h2,
      .message h3 {
        margin: 12px 0 8px;
        line-height: 1.25;
      }

      .message h2 {
        font-size: 18px;
      }

      .message h3 {
        font-size: 16px;
      }

      .message ul {
        margin: 6px 0 10px;
        padding-left: 22px;
      }

      .message li {
        margin: 4px 0;
      }

      table {
        border-collapse: collapse;
        width: 100%;
        margin: 8px 0;
        background: #fff;
      }

      th,
      td {
        border: 1px solid #d9e0ea;
        padding: 8px 10px;
        text-align: left;
        vertical-align: middle;
      }

      th {
        background: #eef3f6;
        font-weight: 650;
      }

      .download {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: #235b6f;
        color: #fff;
        padding: 8px 11px;
        text-decoration: none;
        margin-top: 6px;
      }

      form {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }

      textarea {
        flex: 1;
        min-height: 54px;
        resize: vertical;
        border: 1px solid #c9d2df;
        border-radius: 8px;
        padding: 12px;
        font: inherit;
      }

      a {
        color: #235b6f;
      }

      .error {
        color: #9b1c1c;
        background: #fff1f1;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Flue VaR Demo</h1>
          <p class="muted">Supervisor routing, Real VaR server, Python analysis, specialist agents, and Excel export.</p>
        </div>
        <div class="top-actions">
          <div id="status" class="status">Ready</div>
          <label class="toggle"><input id="developerMode" type="checkbox" /> Developer mode</label>
        </div>
      </header>

      <div class="prompts">
        <button data-prompt="What is Alice VaR and component risk?">Alice VaR</button>
        <button data-prompt="Use the real VaR server for positions [{&quot;curve_alias&quot;:&quot;HO&quot;,&quot;contract_month&quot;:&quot;202609&quot;,&quot;delta&quot;:100},{&quot;curve_alias&quot;:&quot;BRN&quot;,&quot;contract_month&quot;:&quot;202610&quot;,&quot;delta&quot;:50}] on valuation date 2026-07-31 at 95% confidence. If rows are unmatched, explain the unmatched mappings.">Real VaR Server</button>
        <button data-prompt="Aggregate all Brent contracts together, put all equities together, and leave WTI separate.">Aggregate Risk</button>
        <button data-prompt="Run an ad-hoc research sandbox task over Alice's component risk table: calculate any extra custom diagnostic you think is useful, but use the Research Sandbox capability rather than mental math.">Ad-Hoc Sandbox</button>
        <button data-prompt="Use Pi coding session on Alice's component risk table: exclude WTI, aggregate component VaR by asset class, and export the result.">Pi Coding</button>
        <button data-prompt="Ask the market analyst to explain what market drivers would be needed to explain a VaR increase in an oil portfolio.">Market Analyst</button>
        <button data-prompt="Ask the performance analyst to calculate returns, Sharpe, drawdown, and PnL attribution for portfolio Alice.">Performance Analyst</button>
        <button data-prompt="Export the latest result to Excel as alice-risk.xlsx.">Export Excel</button>
        <button data-prompt="Price a one-year call with spot 100, strike 105, rate 0.04, and vol 0.2.">Price Option</button>
      </div>

      <section class="intake">
        <div class="intake-header">
          <div>
            <div class="intake-title">Portfolio Intake</div>
            <p class="muted">Upload a CSV portfolio, preview parsed rows, then ask the agent to calculate VaR.</p>
          </div>
          <a href="/templates/portfolio.csv">Download CSV template</a>
        </div>
        <div class="upload-row">
          <input id="portfolioFile" type="file" accept=".csv,text/csv,image/*" />
          <button id="calculateUpload" type="button" disabled>Calculate Uploaded VaR</button>
          <span id="uploadStatus" class="muted"></span>
        </div>
        <div id="uploadWarnings" class="warnings"></div>
        <div id="portfolioPreview" class="preview"></div>
      </section>

      <section id="chat" class="chat" aria-live="polite"></section>

      <form id="form">
        <textarea id="input" placeholder="Ask the risk agent..."></textarea>
        <button id="send" class="primary" type="submit">Send</button>
      </form>
    </main>

    <script>
      const agentId = "demo-" + Math.random().toString(36).slice(2, 8);
      const agentRoute = "/agents/supervisor";
      const chat = document.querySelector("#chat");
      const form = document.querySelector("#form");
      const input = document.querySelector("#input");
      const status = document.querySelector("#status");
      const send = document.querySelector("#send");
      const developerMode = document.querySelector("#developerMode");
      const portfolioFile = document.querySelector("#portfolioFile");
      const calculateUpload = document.querySelector("#calculateUpload");
      const uploadStatus = document.querySelector("#uploadStatus");
      const uploadWarnings = document.querySelector("#uploadWarnings");
      const portfolioPreview = document.querySelector("#portfolioPreview");
      let lastHistory;
      let uploadedRows = [];
      let uploadWarningList = [];

      function textFromPart(part) {
        if (part.type === "text") return part.text;
        if (part.type === "dynamic-tool") {
          const state = part.state === "output-error" ? "failed" : "called";
          return "[" + part.toolName + " " + state + "]";
        }
        return "";
      }

      function linkArtifacts(text) {
        return text.replace(/\/artifacts\/[A-Za-z0-9._-]+/g, (path) => {
          const filename = path.split("/").pop();
          return '<a class="download" href="' + path + '">Download ' + filename + '</a>';
        });
      }

      function escapeHtml(value) {
        return value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function inlineMarkdown(text) {
        return linkArtifacts(escapeHtml(text))
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(new RegExp(String.fromCharCode(96) + "([^" + String.fromCharCode(96) + "]+)" + String.fromCharCode(96), "g"), "<code>$1</code>")
          .replace(/\n/g, "<br>");
      }

      function isTableBlock(lines, start) {
        return (
          lines[start]?.trim().startsWith("|") &&
          lines[start + 1]?.trim().startsWith("|") &&
          /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[start + 1].trim())
        );
      }

      function splitTableRow(line) {
        return line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      }

      function markdownToHtml(text) {
        const lines = text.split(/\r?\n/);
        const chunks = [];
        let paragraph = [];

        function flushParagraph() {
          if (!paragraph.length) return;
          chunks.push("<p>" + inlineMarkdown(paragraph.join(String.fromCharCode(10))) + "</p>");
          paragraph = [];
        }

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (isTableBlock(lines, i)) {
            flushParagraph();
            const headers = splitTableRow(lines[i]);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
              rows.push(splitTableRow(lines[i]));
              i += 1;
            }
            i -= 1;
            chunks.push(
              "<table><thead><tr>" +
                headers.map((cell) => "<th>" + inlineMarkdown(cell) + "</th>").join("") +
                "</tr></thead><tbody>" +
                rows
                  .map(
                    (row) =>
                      "<tr>" + row.map((cell) => "<td>" + inlineMarkdown(cell) + "</td>").join("") + "</tr>",
                  )
                  .join("") +
                "</tbody></table>",
            );
          } else if (/^#{2,3}\s+/.test(line.trim())) {
            flushParagraph();
            const trimmed = line.trim();
            const level = trimmed.startsWith("###") ? "h3" : "h2";
            chunks.push("<" + level + ">" + inlineMarkdown(trimmed.replace(/^#{2,3}\s+/, "")) + "</" + level + ">");
          } else if (/^-\s+/.test(line.trim())) {
            flushParagraph();
            const items = [];
            while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
              items.push(lines[i].trim().replace(/^-\s+/, ""));
              i += 1;
            }
            i -= 1;
            chunks.push("<ul>" + items.map((item) => "<li>" + inlineMarkdown(item) + "</li>").join("") + "</ul>");
          } else if (!line.trim()) {
            flushParagraph();
          } else {
            paragraph.push(line);
          }
        }
        flushParagraph();
        return chunks.join("");
      }

      function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let inQuotes = false;
        for (let i = 0; i < text.length; i += 1) {
          const char = text[i];
          const next = text[i + 1];
          if (char === '"' && next === '"') {
            cell += '"';
            i += 1;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            row.push(cell);
            cell = "";
          } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") i += 1;
            row.push(cell);
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
            cell = "";
          } else {
            cell += char;
          }
        }
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        if (!rows.length) return [];
        const headers = rows[0].map((header) => normalizeHeader(header));
        return rows.slice(1).map((values) =>
          Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()])),
        );
      }

      function normalizeHeader(header) {
        return header
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
          .replace(/[^a-z0-9_]/g, "");
      }

      function parseNumber(value) {
        if (value === undefined || value === null || value === "") return undefined;
        const parsed = Number(String(value).replace(/[$,%\s]/g, ""));
        return Number.isFinite(parsed) ? parsed : undefined;
      }

      function normalizePortfolioRows(records) {
        const warnings = [];
        const rows = [];
        const aliases = {
          trader: ["trader", "book", "owner"],
          contract: ["contract", "symbol", "ticker", "instrument"],
          asset_class: ["asset_class", "assetclass", "class"],
          product: ["product", "underlying", "name"],
          sector: ["sector", "industry"],
          position: ["position", "qty", "quantity", "units"],
          component_var: ["component_var", "componentvar", "var", "component_risk"],
          price: ["price", "spot", "market_price"],
          vol: ["vol", "volatility"],
          curve_alias: ["curve_alias", "px_location", "curve", "risk_factor"],
          contract_month: ["contract_month", "contractmonth", "month", "forward_month", "contract"],
          delta: ["delta", "delta_units", "nondisc_deltaposition"],
        };

        function get(record, key) {
          for (const alias of aliases[key]) {
            if (record[alias] !== undefined && record[alias] !== "") return record[alias];
          }
          return undefined;
        }

        records.forEach((record, index) => {
          const curveAlias = get(record, "curve_alias");
          const contractMonth = get(record, "contract_month");
          const delta = parseNumber(get(record, "delta"));
          const contract = get(record, "contract") || (curveAlias && contractMonth ? String(curveAlias) + "_" + String(contractMonth) : undefined);
          const position = parseNumber(get(record, "position"));
          if (!contract) {
            warnings.push("Row " + (index + 2) + " skipped: missing contract/symbol.");
            return;
          }
          if (position === undefined && delta === undefined) {
            warnings.push("Row " + (index + 2) + " skipped: missing numeric position or delta.");
            return;
          }

          const row = {
            trader: get(record, "trader") || "Uploaded",
            contract: String(contract),
            asset_class: get(record, "asset_class") || "Unknown",
            product: get(record, "product") || String(contract),
            sector: get(record, "sector") || "Unknown",
            position: position ?? delta,
          };
          const componentVar = parseNumber(get(record, "component_var"));
          const price = parseNumber(get(record, "price"));
          const vol = parseNumber(get(record, "vol"));
          if (componentVar !== undefined) row.component_var = componentVar;
          if (price !== undefined) row.price = price;
          if (vol !== undefined) row.vol = vol;
          if (curveAlias !== undefined) row.curve_alias = String(curveAlias);
          if (contractMonth !== undefined) row.contract_month = String(contractMonth).replace(/[^0-9]/g, "");
          if (delta !== undefined) row.delta = delta;
          rows.push(row);
        });

        if (rows.some((row) => row.component_var === undefined)) {
          warnings.push("Rows without component_var will use the demo mock VaR rule.");
        }
        if (rows.some((row) => row.curve_alias && row.contract_month && row.delta !== undefined)) {
          warnings.push("Rows with curve_alias, contract_month, and delta can use the real VaR server.");
        }
        return { rows, warnings };
      }

      function renderPortfolioPreview(rows, warnings) {
        calculateUpload.disabled = rows.length === 0;
        uploadStatus.textContent = rows.length ? rows.length + " row(s) parsed" : "";
        uploadWarnings.className = warnings.length ? "warnings visible" : "warnings";
        uploadWarnings.textContent = warnings.join(" ");
        portfolioPreview.className = rows.length ? "preview visible" : "preview";
        if (!rows.length) {
          portfolioPreview.innerHTML = "";
          return;
        }
        const columns = [
          "trader",
          "contract",
          "asset_class",
          "product",
          "sector",
          "position",
          "component_var",
          "price",
          "vol",
          "curve_alias",
          "contract_month",
          "delta",
        ];
        portfolioPreview.innerHTML =
          "<table><thead><tr>" +
          columns.map((column) => "<th>" + column + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows
            .map(
              (row) =>
                "<tr>" +
                columns.map((column) => "<td>" + escapeHtml(String(row[column] ?? "")) + "</td>").join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table>";
      }

      function finalAssistantText(message) {
        const textParts = (message.parts || []).filter((part) => part.type === "text" && part.state !== "running");
        return textParts.at(-1)?.text || "";
      }

      function developerText(message) {
        return (message.parts || []).map(textFromPart).filter(Boolean).join("\\n");
      }

      function friendlyUserText(text) {
        if (text.startsWith("Calculate demo VaR for this uploaded portfolio.")) {
          const match = text.match(/Uploaded rows JSON: (\[.*?\])(?: Warnings from parser:|$)/);
          if (match) {
            try {
              const rows = JSON.parse(match[1]);
              const label = rows.length === 1 ? "row" : "rows";
              return "Calculate VaR for uploaded portfolio (" + rows.length + " " + label + ")";
            } catch {
              return "Calculate VaR for uploaded portfolio";
            }
          }
          return "Calculate VaR for uploaded portfolio";
        }
        return text;
      }

      function friendlyStatus(history, submissionId) {
        const targetMessages = (history?.messages || []).filter((message) => message.submissionId === submissionId);
        const toolParts = targetMessages.flatMap((message) =>
          (message.parts || []).filter((part) => part.type === "dynamic-tool"),
        );
        const latestTool = toolParts.at(-1)?.toolName;
        if (!latestTool) return "Thinking...";
        if (latestTool.includes("component") || latestTool.includes("var") || latestTool.includes("positions")) {
          return "Retrieving risk data...";
        }
        if (latestTool.includes("analysis")) return "Analyzing data...";
        if (latestTool.includes("pi_coding")) return "Running Pi coding session...";
        if (latestTool.includes("ad_hoc")) return "Running research sandbox...";
        if (latestTool.includes("excel")) return "Preparing workbook...";
        if (latestTool.includes("price")) return "Running pricing...";
        return "Working...";
      }

      function render(history) {
        lastHistory = history;
        chat.innerHTML = "";
        const showDeveloper = developerMode.checked;
        for (const message of history.messages || []) {
          const rawContent =
            showDeveloper || message.role === "user" ? developerText(message) : finalAssistantText(message);
          const content = !showDeveloper && message.role === "user" ? friendlyUserText(rawContent) : rawContent;
          if (!content) continue;
          const div = document.createElement("div");
          div.className = "message " + (message.role === "user" ? "user" : "assistant");
          div.innerHTML = markdownToHtml(content);
          chat.appendChild(div);
        }
        for (const settlement of history.settlements || []) {
          if (settlement.outcome === "failed") {
            const div = document.createElement("div");
            div.className = "message assistant error";
            div.textContent = settlement.error?.details || settlement.error?.message || "The agent run failed.";
            chat.appendChild(div);
          }
        }
        chat.scrollTop = chat.scrollHeight;
      }

      async function refresh() {
        const response = await fetch(agentRoute + "/" + agentId + "?view=history");
        if (response.ok) {
          const history = await response.json();
          render(history);
          return history;
        }
        return undefined;
      }

      function settlementFor(history, submissionId) {
        return (history?.settlements || []).find((item) => item.submissionId === submissionId);
      }

      async function sendMessage(body) {
        send.disabled = true;
        status.textContent = "Running...";
        const response = await fetch(agentRoute + "/" + agentId, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "user", body }),
        });
        const receipt = await response.json();
        for (let i = 0; i < 90; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const history = await refresh();
          const settlement = settlementFor(history, receipt.submissionId);
          if (settlement?.outcome === "completed") break;
          if (settlement?.outcome === "failed") {
            status.textContent = "Failed";
            send.disabled = false;
            return;
          }
          status.textContent = friendlyStatus(history, receipt.submissionId);
        }
        status.textContent = "Ready";
        send.disabled = false;
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = input.value.trim();
        if (!body) return;
        input.value = "";
        await sendMessage(body);
      });

      document.querySelectorAll("[data-prompt]").forEach((button) => {
        button.addEventListener("click", () => {
          input.value = button.dataset.prompt;
          input.focus();
        });
      });

      developerMode.addEventListener("change", () => {
        if (lastHistory) render(lastHistory);
      });

      portfolioFile.addEventListener("change", async () => {
        const file = portfolioFile.files?.[0];
        uploadedRows = [];
        uploadWarningList = [];
        calculateUpload.disabled = true;
        portfolioPreview.innerHTML = "";
        portfolioPreview.className = "preview";
        uploadWarnings.className = "warnings";
        uploadWarnings.textContent = "";
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".csv")) {
          uploadStatus.textContent = "Screenshot/image intake is planned next; please use CSV for this version.";
          uploadWarningList = ["This local demo route currently supports CSV parsing. Screenshot OCR needs a vision intake worker."];
          renderPortfolioPreview([], uploadWarningList);
          return;
        }

        uploadStatus.textContent = "Parsing...";
        const text = await file.text();
        const parsed = parseCsv(text);
        const normalized = normalizePortfolioRows(parsed);
        uploadedRows = normalized.rows;
        uploadWarningList = normalized.warnings;
        renderPortfolioPreview(uploadedRows, uploadWarningList);
      });

      calculateUpload.addEventListener("click", async () => {
        if (!uploadedRows.length) return;
        const body =
          "Calculate VaR for this uploaded portfolio. If rows include curve_alias, contract_month, and delta, use the Real VaR Server first with valuation_date 2026-07-31 and confidence 0.95. Otherwise use calculate_uploaded_var. Show total VaR, component risk, and unmatched rows if any. Uploaded rows JSON: " +
          JSON.stringify(uploadedRows) +
          (uploadWarningList.length ? " Warnings from parser: " + uploadWarningList.join(" ") : "");
        await sendMessage(body);
      });

      chat.innerHTML = '<div class="message assistant">Open the first prompt or type your own question.</div>';
    </script>
  </body>
</html>`;

app.get('/', (context) => context.html(demoPage));

app.route('/agents/risk', createAgentRouter(RiskAgent));
app.route('/agents/supervisor', createAgentRouter(SupervisorAgent));

app.get('/templates/portfolio.csv', () => {
  return new Response(portfolioTemplate, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="portfolio-template.csv"',
    },
  });
});

app.get('/artifacts/:filename', async (context) => {
  const filename = context.req.param('filename').replace(/[^A-Za-z0-9._-]/g, '');
  const path = resolve(process.cwd(), 'artifacts', filename);
  const body = await readFile(path);
  const contentType = filename.endsWith('.png')
    ? 'image/png'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});

export default app;
