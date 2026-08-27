import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { RiskAgent } from './agents/risk-agent.ts';

const app = new Hono();

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
          <p class="muted">Risk data tools, Python analysis, Black-Scholes pricing, and Excel export.</p>
        </div>
        <div class="top-actions">
          <div id="status" class="status">Ready</div>
          <label class="toggle"><input id="developerMode" type="checkbox" /> Developer mode</label>
        </div>
      </header>

      <div class="prompts">
        <button data-prompt="What is Alice VaR and component risk?">Alice VaR</button>
        <button data-prompt="Aggregate all Brent contracts together, put all equities together, and leave WTI separate.">Aggregate Risk</button>
        <button data-prompt="Export the latest result to Excel as alice-risk.xlsx.">Export Excel</button>
        <button data-prompt="Price a one-year call with spot 100, strike 105, rate 0.04, and vol 0.2.">Price Option</button>
      </div>

      <section id="chat" class="chat" aria-live="polite"></section>

      <form id="form">
        <textarea id="input" placeholder="Ask the risk agent..."></textarea>
        <button id="send" class="primary" type="submit">Send</button>
      </form>
    </main>

    <script>
      const agentId = "demo-" + Math.random().toString(36).slice(2, 8);
      const chat = document.querySelector("#chat");
      const form = document.querySelector("#form");
      const input = document.querySelector("#input");
      const status = document.querySelector("#status");
      const send = document.querySelector("#send");
      const developerMode = document.querySelector("#developerMode");
      let lastHistory;

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

      function finalAssistantText(message) {
        const textParts = (message.parts || []).filter((part) => part.type === "text" && part.state !== "running");
        return textParts.at(-1)?.text || "";
      }

      function developerText(message) {
        return (message.parts || []).map(textFromPart).filter(Boolean).join("\\n");
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
        if (latestTool.includes("excel")) return "Preparing workbook...";
        if (latestTool.includes("price")) return "Running pricing...";
        return "Working...";
      }

      function render(history) {
        lastHistory = history;
        chat.innerHTML = "";
        const showDeveloper = developerMode.checked;
        for (const message of history.messages || []) {
          const content =
            showDeveloper || message.role === "user" ? developerText(message) : finalAssistantText(message);
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
        const response = await fetch("/agents/risk/" + agentId + "?view=history");
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
        const response = await fetch("/agents/risk/" + agentId, {
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

      chat.innerHTML = '<div class="message assistant">Open the first prompt or type your own question.</div>';
    </script>
  </body>
</html>`;

app.get('/', (context) => context.html(demoPage));

app.route('/agents/risk', createAgentRouter(RiskAgent));

app.get('/artifacts/:filename', async (context) => {
  const filename = context.req.param('filename').replace(/[^A-Za-z0-9._-]/g, '');
  const path = resolve(process.cwd(), 'artifacts', filename);
  const body = await readFile(path);
  return new Response(body, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});

export default app;
