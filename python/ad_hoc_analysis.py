import argparse
import json
from dataclasses import dataclass, field
from typing import Any, Literal


ArtifactKind = Literal["table", "chart", "excel", "summary"]
ResultStatus = Literal["not_implemented", "ok"]


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


class AdHocAnalysisWorker:
    """Interface for user-provided ad-hoc Python analysis implementation."""

    def execute(self, request: AdHocAnalysisRequest) -> AdHocAnalysisResult:
        raise NotImplementedError(
            "AdHocAnalysisWorker.execute is a scaffold. Provide the custom Python analysis implementation here."
        )


class NotImplementedAdHocAnalysisWorker(AdHocAnalysisWorker):
    def execute(self, request: AdHocAnalysisRequest) -> AdHocAnalysisResult:
        table_summary = ", ".join(f"{name}: {len(rows)} rows" for name, rows in request.tables.items()) or "no tables"
        expected = ", ".join(item.kind for item in request.expected_outputs) or "not specified"
        return AdHocAnalysisResult(
            status="not_implemented",
            summary="Ad-hoc analysis worker interface is ready, but the execution implementation has not been provided yet.",
            diagnostics=[
                f"task={request.task}",
                f"tables={table_summary}",
                f"expected_outputs={expected}",
            ],
        )


def parse_request(payload: dict[str, Any]) -> AdHocAnalysisRequest:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    request = parse_request(payload)
    worker = NotImplementedAdHocAnalysisWorker()
    result = worker.execute(request)
    print(json.dumps(result.to_dict()))


if __name__ == "__main__":
    main()
