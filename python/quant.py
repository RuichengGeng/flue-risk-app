from math import exp, log, sqrt
from statistics import NormalDist


def bs_price(spot, strike, rate, vol, maturity, option_type="call"):
    if spot <= 0 or strike <= 0 or vol <= 0 or maturity <= 0:
        raise ValueError("spot, strike, vol, and maturity must be positive")

    n = NormalDist()
    d1 = (log(spot / strike) + (rate + 0.5 * vol**2) * maturity) / (vol * sqrt(maturity))
    d2 = d1 - vol * sqrt(maturity)

    if option_type == "call":
        return spot * n.cdf(d1) - strike * exp(-rate * maturity) * n.cdf(d2)
    if option_type == "put":
        return strike * exp(-rate * maturity) * n.cdf(-d2) - spot * n.cdf(-d1)
    raise ValueError("option_type must be 'call' or 'put'")
