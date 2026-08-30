import argparse
import json
from research_sandbox import run_data_analysis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    print(json.dumps(run_data_analysis(payload)))


if __name__ == "__main__":
    main()
