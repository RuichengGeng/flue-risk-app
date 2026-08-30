import argparse
import ast
import csv
import json
import math
import statistics
import itertools
from collections import defaultdict
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
from typing import Any

from research_sandbox import run_excel_export


ALLOWED_IMPORTS = {
    "collections",
    "datetime",
    "itertools",
    "json",
    "math",
    "statistics",
}

BANNED_NAMES = {
    "__import__",
    "compile",
    "dir",
    "eval",
    "exec",
    "getattr",
    "globals",
    "input",
    "locals",
    "open",
    "setattr",
    "vars",
}

SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "print": print,
    "range": range,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


class SandboxValidationError(ValueError):
    pass


def safe_filename(name: str, suffix: str) -> str:
    stem = "".join(char if char.isalnum() or char in "._-" else "-" for char in name).strip(".-")
    if not stem:
        stem = f"artifact-{int(datetime.now().timestamp())}"
    return stem if stem.endswith(suffix) else f"{stem}{suffix}"


def validate_code(source: str) -> ast.AST:
    tree = ast.parse(source, mode="exec")
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in ALLOWED_IMPORTS:
                    raise SandboxValidationError(f"Import is not allowed: {alias.name}")
        if isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            raise SandboxValidationError(f"Name is not allowed: {node.id}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise SandboxValidationError(f"Dunder attribute access is not allowed: {node.attr}")
    return tree


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if level != 0 or root not in ALLOWED_IMPORTS:
        raise ImportError(f"Import is not allowed: {name}")
    return __import__(name, globals, locals, fromlist, level)


def build_artifact_helpers(artifacts: list[dict[str, Any]]):
    artifact_dir = Path("artifacts")
    artifact_dir.mkdir(parents=True, exist_ok=True)

    def write_json(name: str, data: Any) -> dict[str, Any]:
        filename = safe_filename(name, ".json")
        path = artifact_dir / filename
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        artifact = {"kind": "json", "path": str(path), "download_url": f"/artifacts/{filename}"}
        artifacts.append(artifact)
        return artifact

    def write_csv(name: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
        filename = safe_filename(name, ".csv")
        path = artifact_dir / filename
        headers = list(rows[0].keys()) if rows else ["message"]
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows or [{"message": "No rows"}])
        artifact = {"kind": "csv", "path": str(path), "download_url": f"/artifacts/{filename}"}
        artifacts.append(artifact)
        return artifact

    def write_excel(name: str, rows: list[dict[str, Any]], sheet_name: str = "Results") -> dict[str, Any]:
        filename = safe_filename(name, ".xlsx")
        path = artifact_dir / filename
        run_excel_export({"rows": rows, "sheet_name": sheet_name}, str(path))
        artifact = {"kind": "excel", "path": str(path), "download_url": f"/artifacts/{filename}"}
        artifacts.append(artifact)
        return artifact

    return write_json, write_csv, write_excel


def normalize_result(raw_result: Any, artifacts: list[dict[str, Any]], diagnostics: list[str]) -> dict[str, Any]:
    if not isinstance(raw_result, dict):
        raw_result = {"summary": str(raw_result)}
    return {
        "status": "ok",
        "summary": str(raw_result.get("summary", "Coding Sandbox completed.")),
        "tables": raw_result.get("tables", {}),
        "artifacts": raw_result.get("artifacts", []) + artifacts,
        "diagnostics": raw_result.get("diagnostics", []) + diagnostics,
    }


def run_generated_code(payload: dict[str, Any]) -> dict[str, Any]:
    artifacts: list[dict[str, Any]] = []
    diagnostics = [
        f"task={payload['task']}",
        "execution=generated_python",
        "allowed_imports=" + ",".join(sorted(ALLOWED_IMPORTS)),
    ]
    write_json, write_csv, write_excel = build_artifact_helpers(artifacts)
    tree = validate_code(payload["python_code"])

    env: dict[str, Any] = {
        "__builtins__": {**SAFE_BUILTINS, "__import__": safe_import},
        "date": date,
        "datetime": datetime,
        "defaultdict": defaultdict,
        "deepcopy": deepcopy,
        "json": json,
        "itertools": itertools,
        "math": math,
        "statistics": statistics,
        "tables": deepcopy(payload.get("tables", {})),
        "task": payload["task"],
        "context": payload.get("context"),
        "constraints": payload.get("constraints", []),
        "expected_outputs": payload.get("expected_outputs", []),
        "write_json": write_json,
        "write_csv": write_csv,
        "write_excel": write_excel,
        "result": None,
    }

    exec(compile(tree, "<coding_sandbox>", "exec"), env, env)
    if env.get("result") is None:
        raise ValueError("Generated code must assign a JSON-serializable value to `result`.")
    return normalize_result(env["result"], artifacts, diagnostics)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    print(json.dumps(run_generated_code(payload)))


if __name__ == "__main__":
    main()
