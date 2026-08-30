import json
import argparse
from research_sandbox import run_excel_export


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    print(json.dumps(run_excel_export(payload, args.output)))


if __name__ == "__main__":
    main()
