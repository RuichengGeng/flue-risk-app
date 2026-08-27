import argparse
import json
from collections import defaultdict


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

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

    print(json.dumps({"rows": rows, "row_count": len(rows)}))


if __name__ == "__main__":
    main()
