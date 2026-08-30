import json
import argparse
from research_sandbox import NotImplementedResearchSandboxWorker, parse_ad_hoc_request


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    request = parse_ad_hoc_request(payload)
    worker = NotImplementedResearchSandboxWorker()
    result = worker.execute_ad_hoc(request)
    print(json.dumps(result.to_dict()))


if __name__ == "__main__":
    main()
