import argparse
import json
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from html import escape
from pathlib import Path
from typing import Any, Literal


CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

WORKBOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


ArtifactKind = Literal["table", "chart", "excel", "summary"]
ResultStatus = Literal["not_implemented", "ok"]


def compare(left, operator, right):
    if operator == "eq":
        return left == right
    if operator == "ne":
        return left != right
    if operator == "contains":
        return str(right).lower() in str(left).lower()
    if operator == "gt":
        return float(left) > float(right)
    if operator == "gte":
        return float(left) >= float(right)
    if operator == "lt":
        return float(left) < float(right)
    if operator == "lte":
        return float(left) <= float(right)
    raise ValueError(f"Unsupported filter operator: {operator}")


def apply_filters(rows, filters):
    for item in filters:
        rows = [
            row
            for row in rows
            if compare(row.get(item["column"]), item.get("operator", "eq"), item.get("value"))
        ]
    return rows


def apply_bucket(row, rules, default_column=None, default_value=None):
    for rule in rules:
        if all(compare(row.get(cond["column"]), cond.get("operator", "eq"), cond.get("value")) for cond in rule["when"]):
            return rule["label"]
    if default_value is not None:
        return default_value
    if default_column:
        return row.get(default_column)
    return "Other"


def aggregate(rows, group_by, aggregations):
    grouped = defaultdict(list)
    for row in rows:
        key = tuple(row.get(column) for column in group_by)
        grouped[key].append(row)

    output = []
    for key, records in grouped.items():
        result = {column: key[index] for index, column in enumerate(group_by)}
        for spec in aggregations:
            fn = spec.get("function", "sum")
            if fn == "count":
                value = len(records)
            else:
                values = [float(record.get(spec["column"], 0) or 0) for record in records]
                if fn == "sum":
                    value = sum(values)
                elif fn == "avg":
                    value = sum(values) / len(values) if values else 0
                elif fn == "min":
                    value = min(values) if values else 0
                elif fn == "max":
                    value = max(values) if values else 0
                else:
                    raise ValueError(f"Unsupported aggregation function: {fn}")
            result[spec.get("as") or f"{fn}_{spec['column']}"] = value
        output.append(result)
    return output


def run_data_analysis(payload):
    rows = payload["rows"]
    spec = payload["spec"]
    rows = apply_filters(rows, spec.get("filters", []))

    bucket = spec.get("bucket")
    if bucket:
        rows = [
            {**row, bucket["column"]: apply_bucket(row, bucket["rules"], bucket.get("default_column"), bucket.get("default_value"))}
            for row in rows
        ]

    if spec.get("group_by"):
        rows = aggregate(rows, spec["group_by"], spec.get("aggregations", []))

    sort = spec.get("sort")
    if sort:
        rows = sorted(rows, key=lambda row: row.get(sort["column"], 0), reverse=sort.get("direction", "desc") == "desc")

    top_n = spec.get("top_n")
    if top_n:
        rows = rows[: int(top_n)]

    select = spec.get("select")
    if select:
        rows = [{column: row.get(column) for column in select} for row in rows]

    return {"rows": rows, "row_count": len(rows)}


def column_name(index):
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def cell_xml(row_index, col_index, value, style=0):
    ref = f"{column_name(col_index)}{row_index}"
    style_attr = f' s="{style}"' if style else ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t>{escape(str(value))}</t></is></c>'


def worksheet_xml(rows):
    headers = list(rows[0].keys()) if rows else ["message"]
    values = rows if rows else [{"message": "No rows"}]
    sheet_rows = []
    sheet_rows.append(
        '<row r="1">' + "".join(cell_xml(1, index + 1, header, 1) for index, header in enumerate(headers)) + "</row>"
    )
    for row_index, row in enumerate(values, start=2):
        sheet_rows.append(
            f'<row r="{row_index}">'
            + "".join(cell_xml(row_index, col_index + 1, row.get(header, "")) for col_index, header in enumerate(headers))
            + "</row>"
        )
    widths = "".join(f'<col min="{i}" max="{i}" width="18" customWidth="1"/>' for i in range(1, len(headers) + 1))
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>{widths}</cols>
  <sheetData>{''.join(sheet_rows)}</sheetData>
  <autoFilter ref="A1:{column_name(len(headers))}{len(values) + 1}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
</worksheet>"""


def workbook_xml(sheet_name):
    safe_name = escape(sheet_name[:31] or "Results")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="{safe_name}" sheetId="1" r:id="rId1"/></sheets>
</workbook>"""


def run_excel_export(payload, output_path):
    rows = payload.get("rows", [])
    sheet_name = payload.get("sheet_name", "Results")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as xlsx:
        xlsx.writestr("[Content_Types].xml", CONTENT_TYPES)
        xlsx.writestr("_rels/.rels", ROOT_RELS)
        xlsx.writestr("xl/workbook.xml", workbook_xml(sheet_name))
        xlsx.writestr("xl/_rels/workbook.xml.rels", WORKBOOK_RELS)
        xlsx.writestr("xl/styles.xml", STYLES)
        xlsx.writestr("xl/worksheets/sheet1.xml", worksheet_xml(rows))

    return {"path": str(output), "row_count": len(rows)}


@dataclass
class ArtifactRequest:
    kind: ArtifactKind
    name: str | None = None


@dataclass
class AdHocAnalysisRequest:
    task: str
    tables: dict[str, list[dict[str, Any]]]
    context: str | None = None
    constraints: list[str] = field(default_factory=list)
    expected_outputs: list[ArtifactRequest] = field(default_factory=list)


@dataclass
class AdHocAnalysisResult:
    status: ResultStatus
    summary: str
    tables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    artifacts: list[dict[str, Any]] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "summary": self.summary,
            "tables": self.tables,
            "artifacts": self.artifacts,
            "diagnostics": self.diagnostics,
        }


class ResearchSandboxWorker:
    """Interface for user-provided generated-code execution."""

    def execute_ad_hoc(self, request: AdHocAnalysisRequest) -> AdHocAnalysisResult:
        raise NotImplementedError(
            "ResearchSandboxWorker.execute_ad_hoc is a scaffold. Provide the generated-code execution implementation here."
        )


class NotImplementedResearchSandboxWorker(ResearchSandboxWorker):
    def execute_ad_hoc(self, request: AdHocAnalysisRequest) -> AdHocAnalysisResult:
        table_summary = ", ".join(f"{name}: {len(rows)} rows" for name, rows in request.tables.items()) or "no tables"
        expected = ", ".join(item.kind for item in request.expected_outputs) or "not specified"
        return AdHocAnalysisResult(
            status="not_implemented",
            summary="Research Sandbox ad-hoc code execution is ready as an interface, but the implementation has not been provided yet.",
            diagnostics=[
                f"task={request.task}",
                f"tables={table_summary}",
                f"expected_outputs={expected}",
            ],
        )


def parse_ad_hoc_request(payload):
    return AdHocAnalysisRequest(
        task=payload["task"],
        tables=payload.get("tables", {}),
        context=payload.get("context"),
        constraints=payload.get("constraints", []),
        expected_outputs=[
            ArtifactRequest(kind=item["kind"], name=item.get("name"))
            for item in payload.get("expected_outputs", [])
        ],
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        envelope = json.load(handle)

    mode = envelope["mode"]
    payload = envelope.get("payload", {})

    if mode == "data_analysis":
        result = run_data_analysis(payload)
    elif mode == "excel_export":
        result = run_excel_export(payload, envelope["output_path"])
    elif mode == "ad_hoc_analysis":
        worker = NotImplementedResearchSandboxWorker()
        result = worker.execute_ad_hoc(parse_ad_hoc_request(payload)).to_dict()
    else:
        raise ValueError(f"Unsupported Research Sandbox mode: {mode}")

    print(json.dumps(result))


if __name__ == "__main__":
    main()
