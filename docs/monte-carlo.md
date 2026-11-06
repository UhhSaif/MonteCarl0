# Monte Carlo engine and API

The Python engine and `POST /api/simulations/monte-carlo` power the dashboard’s
Monte Carlo controls, animated forecast fan, and sideways histogram. No streaming,
Markov chains, or machine learning have been added.

## Run a simulation

Start the existing API from the repository root:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload
```

Then send:

```bash
curl -sS http://127.0.0.1:8000/api/simulations/monte-carlo \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"NVDA","simulations":10000,"horizon_days":30,"history_period":"1y","target_price":250,"seed":42}'
```

You can also use the interactive API at http://127.0.0.1:8000/docs.
No additional dependencies are needed.

| Parameter | Accepted values | Default |
| --- | --- | --- |
| `ticker` | Existing Yahoo ticker syntax | Required |
| `simulations` | 100, 1000, 5000, 10000 | 10000 |
| `horizon_days` | 7, 30, 60, 90 trading steps | 30 |
| `history_period` | `6mo`, `1y`, `3y`, `5y` | `1y` |
| `target_price` | Finite positive number, in the returned currency | null |
| `seed` | Integer from 0 through 4294967295 | Generated and returned |

Unknown fields, strings masquerading as numbers, booleans in numeric fields,
nonfinite target values, and unsupported values are rejected with 422. Errors
include a readable detail and, for request validation, field-specific messages.
At least 61 valid completed-session closes (60 returns) are required; this is a
minimum data-quality policy, not a claim that 60 returns guarantee a good model.
Provider 404/502/503 errors retain their existing status and message.

## The calculation

For chronological adjusted closing prices `S[0] ... S[n]`:

```text
r[t] = log(S[t]) - log(S[t-1])
m = mean(r)
sigma = sample_standard_deviation(r)        # ddof=1
annualized_volatility = sigma * sqrt(252)

S_future[t+1] = S_future[t] * exp(m + sigma * Z[t])
Z[t] ~ independent standard normal
```

Every step is one trading day. The continuous GBM price drift corresponding to
these estimates is `mu_daily = m + sigma² / 2`. The standard GBM expression
`(mu_daily - sigma² / 2) + sigma * Z` therefore reduces to `m + sigma * Z`.
Subtracting the volatility correction from the historical mean log return again
would incorrectly lower the drift. No risk-free rate or risk-neutral pricing
assumption is used: this is historical calibration for research.

Day zero is exactly the latest completed adjusted close supplied by the existing
market-data service. Volatilities and probabilities are fractions, not percents.
For example, volatility `0.40` means 40% annualized volatility.

## Response contract

- `ticker`, `currency`, `as_of`, `history_start`, `history_end`,
  `historical_observations`, `history_period`, `adjusted`: input provenance.
- `model`, `label`, `seed`, `rng`, `numpy_version`: interpretation and replay metadata.
- `estimates`: observed return count, mean daily log return, daily sample
  volatility, daily GBM drift, annualized volatility, and 252-day convention.
- `days`: integers `0 ... horizon_days`; these are trading-step offsets, not
  calendar dates. No exchange holiday calendar is assumed.
- `ending_prices`: one ending value per simulation, in original trial order.
  Use every value for a histogram or for probability queries at any target.
- `percentile_paths`: `p05`, `p25`, `p50`, `p75`, and `p95`, each containing
  `horizon_days + 1` prices. `p50` is the median path. Each day's percentiles are
  computed from all trials using NumPy's default linear interpolation. These
  are pointwise bands, not bounds containing an entire path with 90% probability.
- `sample_paths`: at most 200 paths, shaped `[trial][day]`, including day zero.
  These are the first independently generated trials, not handpicked outcomes.
- `sample_path_ids`: map those paths to indices in `ending_prices`.
- `summary`: mean/median ending price, 5th/95th ending percentiles,
  `probability_above_start`, `probability_below_start`,
  `probability_equal_start`, target price, and `probability_above_target`.

Every probability is an empirical fraction of **all** simulated ending values.
"Above" and "below" are strict comparisons. Equal outcomes are reported separately
so flat histories remain correct. Target probability is null when no target is
supplied. It means *ending above* the target, not *touching it along the way*.
The 5th/95th percentiles are not absolute minima/maxima.

## Reproducibility and performance

Each request uses its own NumPy PCG64 generator; it does not reset global random
state. An omitted seed is generated once and returned. Replaying requires the
same seed, historical closes, parameters, model version, and NumPy environment.
Historical adjusted prices can change when Yahoo revises data or applies a new
corporate action; a fixed seed alone does not freeze the input data.

The largest path matrix is 10,000 × 91 float64 values (~7.3 MB), with additional
temporary arrays for shocks, cumulative returns, and percentiles. Only up to
200 paths and all 10,000 endings are serialized. The synchronous FastAPI route
runs in its thread pool so provider calls and simulation work do not run directly
on the async event loop. Request sizes are bounded; this is still a local research
service, not a public multi-user load-tested deployment.

Numeric overflow/underflow is rejected with 422 rather than clipped or returned
as NaN, Infinity, or zero prices. Simulation results are not cached. Historical
data continues to use the existing five-minute cache.

To reproduce the live example and save the exact data inputs and output:

```bash
.venv/bin/python -m backend.demo_monte_carlo
```

This calls the API using FastAPI's in-process TestClient with real Yahoo data and
writes request, historical input, full response, and timing summary JSON under
`artifacts/monte-carlo/` (git-ignored). It does not require a running HTTP server.

## Tests and assumptions

```bash
.venv/bin/python -m pytest backend/tests -q -s
```

Tests cover dimensions, positive finite outputs, seed replay, independent random
state, exact probability counts, target semantics, percentile ordering, analytic
GBM benchmarks, flat histories, insufficient data, invalid input, provider
failures, numeric overflow, POST CORS, and maximum response size. The maximum-size
API test prints timing without an unreliable hardware-specific pass threshold.

GBM assumes independent normal log returns with constant drift and volatility.
It does not model jumps, volatility clustering, changes in market regimes, or
uncertainty in the estimated parameters. A short historical window can give an
unstable drift estimate. Each adjacent valid provider close is treated as one
trading observation; missing provider sessions are not reconstructed. Horizons
are trading steps, not guaranteed exchange dates. Results use adjusted prices
and should be interpreted on that adjusted-price basis.

**All outputs are model-based estimates, not guaranteed predictions or investment
recommendations.** The dashboard discloses visualization progress and derives evolving probabilities
from the revealed actual outcomes.

References: [NumPy Generator](https://numpy.org/doc/stable/reference/random/generator.html)
and [Pydantic strict validation](https://docs.pydantic.dev/latest/concepts/strict_mode/).


## Frontend visualization

`MonteCarloPanel.jsx` owns controls, request cancellation, playback, and result
summaries. `SimulationChart.jsx` uses SVG for the forecast and histogram so both
share one price scale; it displays at most 200 sample paths, with no new charting
dependency. The original TradingView historical chart is retained.

`utils/simulation.js` calculates histogram bins, chart bounds, and strict empirical
probabilities. Node's built-in test runner checks counts, equality handling,
partial reveals, and flat-data scale bounds (`cd frontend && npm test`).

The 6.5-second reveal is presentation only. The first ending values are revealed
in original trial order while sample paths appear progressively; the two are
separate display samples. Bands use all computed trials throughout, as the UI
states. Pause/resume, show-all, replay, reset, and ticker changes cancel the
appropriate animation/request work. Reduced-motion users see results immediately.
Changing model parameters clears previous results; changing the target only
recalculates probabilities from existing endings. The optional recent-history
segment is shown only when it aligns with the simulation's starting date/price.

The histogram is empirical, with an outline through bin centers; it does not fit
a normal density curve. The 25th/75th percentile lines are distribution summaries,
not two uniquely likely paths. A narrow screen keeps the chart readable through
horizontal scrolling, with the target also available through keyboard-accessible
numeric and range inputs.
