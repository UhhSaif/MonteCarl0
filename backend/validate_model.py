"""Reproducible analytic checks, rolling held-out evaluation, and timing report.

Offline synthetic data by default. --ticker fetches real history explicitly.
"""
import argparse
import json
import platform
from datetime import datetime, timezone
from math import exp, sqrt
from pathlib import Path
from statistics import median
from time import perf_counter

import numpy as np
from backend.schemas import MonteCarloRequest
from backend.services.monte_carlo import simulate_prices


def rolling_coverage(closes, window=252, horizon=30):
    prices = np.asarray(closes, dtype=float)
    if window < 60 or horizon not in {7, 30, 60, 90}:
        raise ValueError("Need at least 60 training returns and a supported horizon.")
    records = []
    for origin in range(window, len(prices) - horizon, horizon):
        training = prices[origin - window:origin + 1]
        result = simulate_prices(training, MonteCarloRequest(
            ticker="VALIDATION", simulations=10000, horizon_days=horizon, seed=42 + origin))
        low = result['summary']['p05_ending_price']
        high = result['summary']['p95_ending_price']
        actual = float(prices[origin + horizon])
        records.append(dict(origin=origin, end=origin+horizon, low=low, high=high,
                            actual=actual, covered=bool(low <= actual <= high)))
    if not records:
        raise ValueError("Not enough prices for one training window and held-out horizon.")
    return records


def report(prices, source):
    request = MonteCarloRequest(ticker="VALIDATION", seed=42)
    training = prices[:253]
    result = simulate_prices(training, request)
    r = np.diff(np.log(training))
    m, sigma = float(np.mean(r)), float(np.std(r, ddof=1))
    expected = float(training[-1]) * exp((m + sigma*sigma/2) * 30)
    se = sqrt(expected**2 * (exp(sigma*sigma*30)-1) / 10000)
    observed = result['summary']['mean_ending_price']
    error_se = abs(observed-expected)/se if se else 0.0
    if abs(observed-expected) > max(5*se, 1e-10):
        raise AssertionError("Monte Carlo mean outside five standard errors of analytic GBM mean")
    records = rolling_coverage(prices)
    hits = sum(row['covered'] for row in records)
    lines = ["# Model validation and benchmark", "",
             f"Generated (UTC): {datetime.now(timezone.utc).isoformat()}",
             f"Source: {source}",
             f"Environment: Python {platform.python_version()}, NumPy {np.__version__}, {platform.system()} {platform.machine()}.", "",
             "## Analytic correctness", "",
             "30-day, 10,000-trial run; first 253 closes; seed 42. Expected mean is S₀ exp((m + σ²/2)T).",
             f"Analytic mean: {expected:.6f}; simulated mean: {observed:.6f}; error: {error_se:.3f} Monte Carlo standard errors (limit: 5).", "",
             "## Held-out terminal interval coverage", "",
             "252 training returns, 30-session horizon, origins spaced 30 sessions apart. Each fit uses only closes through its origin; future closes are used only for scoring.",
             f"Middle 90% interval covered {hits}/{len(records)} held-out endpoints ({hits/len(records):.1%}).", "",
             "This is descriptive coverage, not trading profitability. Small samples and shared training windows limit inference. Adjusted history retrieved today is not a point-in-time archive; retrospective corporate-action adjustments may affect evaluation. No tuning is performed against these outcomes.", "",
             "## Engine performance", "",
             "Five measured runs after one warm-up per configuration. Fixed seed, synthetic or supplied training history. Timings exclude Yahoo, HTTP, and JSON encoding. Payload is compact uncompressed engine-result JSON; HTTP metadata adds bytes. Results depend on hardware.", "",
             "| Trials | Days | Median ms | Engine JSON bytes |",
             "| ---: | ---: | ---: | ---: |"]
    for n in [100, 1000, 5000, 10000]:
        for horizon in [30, 90]:
            req = MonteCarloRequest(ticker="VALIDATION", simulations=n, horizon_days=horizon, seed=42)
            simulate_prices(training, req)
            times = []
            for _ in range(5):
                start = perf_counter()
                output = simulate_prices(training, req)
                times.append((perf_counter()-start)*1000)
            size = len(json.dumps(output, separators=(',', ':'), allow_nan=False).encode())
            lines.append(f"| {n:,} | {horizon} | {median(times):.2f} | {size:,} |")
    lines += ["", "## Reproduce", "", "```bash", "python -m backend.validate_model --output docs/validation-report.md", "# Optional current Yahoo history (requires internet):", "python -m backend.validate_model --ticker AAPL --output docs/validation-market-report.md", "```", "", "Synthetic coverage checks behavior under a known model; it does not establish real-market calibration."]
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ticker')
    parser.add_argument('--output', default='docs/validation-report.md')
    args = parser.parse_args()
    if args.ticker:
        from backend.services.market_data import get_history
        history = get_history(args.ticker, '5y')
        prices = np.array([p['close'] for p in history['prices']])
        source = f"Yahoo adjusted {history['ticker']}, {history['prices'][0]['time']} to {history['as_of']}; {len(prices)} closes."
    else:
        prices = 100 * np.exp(np.r_[0, np.cumsum(np.random.default_rng(2026).normal(.0003, .018, 2520))])
        source = 'Synthetic GBM, 2,520 daily returns; data seed 2026, mean log return 0.0003, daily volatility 0.018. Not real stock data.'
    Path(args.output).write_text(report(prices, source))
    print(f'Wrote {args.output}')
