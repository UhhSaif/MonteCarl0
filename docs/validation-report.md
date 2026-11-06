# Model validation and benchmark

Generated (UTC): 2026-11-06T21:35:12.280261+00:00
Source: Synthetic GBM, 2,520 daily returns; data seed 2026, mean log return 0.0003, daily volatility 0.018. Not real stock data.
Environment: Python 3.13.7, NumPy 2.5.4, Darwin arm64.

## Analytic correctness

30-day, 10,000-trial run; first 253 closes; seed 42. Expected mean is S₀ exp((m + σ²/2)T).
Analytic mean: 161.513117; simulated mean: 161.507993; error: 0.030 Monte Carlo standard errors (limit: 5).

## Held-out terminal interval coverage

252 training returns, 30-session horizon, origins spaced 30 sessions apart. Each fit uses only closes through its origin; future closes are used only for scoring.
Middle 90% interval covered 67/75 held-out endpoints (89.3%).

This is descriptive coverage, not trading profitability. Small samples and shared training windows limit inference. Adjusted history retrieved today is not a point-in-time archive; retrospective corporate-action adjustments may affect evaluation. No tuning is performed against these outcomes.

## Engine performance

Five measured runs after one warm-up per configuration. Fixed seed, synthetic or supplied training history. Timings exclude Yahoo, HTTP, and JSON encoding. Payload is compact uncompressed engine-result JSON; HTTP metadata adds bytes. Results depend on hardware.

| Trials | Days | Median ms | Engine JSON bytes |
| ---: | ---: | ---: | ---: |
| 100 | 30 | 0.16 | 63,891 |
| 100 | 90 | 0.33 | 181,738 |
| 1,000 | 30 | 1.06 | 138,948 |
| 1,000 | 90 | 2.64 | 368,937 |
| 5,000 | 30 | 4.43 | 213,636 |
| 5,000 | 90 | 15.09 | 443,626 |
| 10,000 | 30 | 9.44 | 307,095 |
| 10,000 | 90 | 28.58 | 537,025 |

## Reproduce

```bash
python -m backend.validate_model --output docs/validation-report.md
# Optional current Yahoo history (requires internet):
python -m backend.validate_model --ticker AAPL --output docs/validation-market-report.md
```

Synthetic coverage checks behavior under a known model; it does not establish real-market calibration.
