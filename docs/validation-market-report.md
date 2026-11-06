# Model validation and benchmark

Generated (UTC): 2026-11-06T21:35:53.040001+00:00
Source: Yahoo adjusted AAPL, 2021-11-08 to 2026-11-06; 1255 closes.
Environment: Python 3.13.7, NumPy 2.5.4, Darwin arm64.

## Analytic correctness

30-day, 10,000-trial run; first 253 closes; seed 42. Expected mean is S₀ exp((m + σ²/2)T).
Analytic mean: 136.873374; simulated mean: 136.867603; error: 0.036 Monte Carlo standard errors (limit: 5).

## Held-out terminal interval coverage

252 training returns, 30-session horizon, origins spaced 30 sessions apart. Each fit uses only closes through its origin; future closes are used only for scoring.
Middle 90% interval covered 30/33 held-out endpoints (90.9%).

This is descriptive coverage, not trading profitability. Small samples and shared training windows limit inference. Adjusted history retrieved today is not a point-in-time archive; retrospective corporate-action adjustments may affect evaluation. No tuning is performed against these outcomes.

## Engine performance

Five measured runs after one warm-up per configuration. Fixed seed, synthetic or supplied training history. Timings exclude Yahoo, HTTP, and JSON encoding. Payload is compact uncompressed engine-result JSON; HTTP metadata adds bytes. Results depend on hardware.

| Trials | Days | Median ms | Engine JSON bytes |
| ---: | ---: | ---: | ---: |
| 100 | 30 | 0.44 | 64,309 |
| 100 | 90 | 0.34 | 182,152 |
| 1,000 | 30 | 0.81 | 139,804 |
| 1,000 | 90 | 2.66 | 369,726 |
| 5,000 | 30 | 4.44 | 214,708 |
| 5,000 | 90 | 15.27 | 444,456 |
| 10,000 | 30 | 9.65 | 308,341 |
| 10,000 | 90 | 28.13 | 537,885 |

## Reproduce

```bash
python -m backend.validate_model --output docs/validation-report.md
# Optional current Yahoo history (requires internet):
python -m backend.validate_model --ticker AAPL --output docs/validation-market-report.md
```

Synthetic coverage checks behavior under a known model; it does not establish real-market calibration.
