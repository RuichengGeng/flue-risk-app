import argparse
import json

from quant import bs_price


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    price = bs_price(
        spot=float(payload["spot"]),
        strike=float(payload["strike"]),
        rate=float(payload["rate"]),
        vol=float(payload["vol"]),
        maturity=float(payload["maturity"]),
        option_type=payload.get("option_type", "call"),
    )
    print(json.dumps({"price": price}))


if __name__ == "__main__":
    main()
