"""Daily-step GBM, calibrated to adjusted historical log returns.

r[t] = log(close[t]) - log(close[t-1])
m = mean(r); sigma = std(r, ddof=1)
S[t+1] = S[t] * exp(m + sigma * Z[t]), Z ~ N(0, 1)

The corresponding daily GBM price drift is mu = m + sigma**2 / 2.
Thus (mu - sigma**2 / 2) = m: do not subtract sigma**2 / 2 again.
No annual-to-daily conversion is needed because each step is one trading day.
"""
import secrets

import numpy as np

from backend.schemas import MonteCarloRequest
from backend.services.market_data import get_history

MIN_RETURNS = 60
TRADING_DAYS_PER_YEAR = 252
MAX_SAMPLE_PATHS = 200
MODEL_VERSION = "gbm-daily-log-returns-v1"


class SimulationError(Exception):
    """Historical data cannot support a numerically valid simulation."""


def simulate_prices(closes, request: MonteCarloRequest):
    """Pure calculation: input closes must be chronological and positive.

    Return JSON-safe values. Path dimension is [trial][day]; day zero is the
    starting close. All statistics use every trial, never just sampled paths.
    """
    try:
        prices = np.asarray(closes, dtype=np.float64)
    except (ValueError, TypeError) as exc:
        raise SimulationError("Historical closing prices must be numeric.") from exc
    if prices.ndim != 1 or prices.size < MIN_RETURNS + 1:
        raise SimulationError(
            f"At least {MIN_RETURNS + 1} completed closing prices "
            f"({MIN_RETURNS} daily returns) are required. Try a longer history window."
        )
    if not np.all(np.isfinite(prices)) or np.any(prices <= 0):
        raise SimulationError("Historical closing prices must be finite and positive.")

    log_returns = np.diff(np.log(prices))
    mean_log_return = float(np.mean(log_returns))
    daily_volatility = float(np.std(log_returns, ddof=1))
    daily_gbm_drift = mean_log_return + daily_volatility**2 / 2
    annualized_volatility = daily_volatility * np.sqrt(TRADING_DAYS_PER_YEAR)
    starting_price = float(prices[-1])
    seed = request.seed if request.seed is not None else secrets.randbits(32)
    rng = np.random.Generator(np.random.PCG64(seed))

    # One bounded matrix: at most 10,000 x 91 float64 values (~7.3 MB).
    paths = np.empty((request.simulations, request.horizon_days + 1))
    paths[:, 0] = starting_price
    increments = rng.normal(
        mean_log_return, daily_volatility,
        size=(request.simulations, request.horizon_days),
    )
    # Calculate in log space, and fail rather than clip invalid outcomes.
    with np.errstate(over="ignore", under="ignore", invalid="ignore"):
        paths[:, 1:] = starting_price * np.exp(np.cumsum(increments, axis=1))
    if not np.all(np.isfinite(paths)) or np.any(paths <= 0):
        raise SimulationError(
            "This history produces numerically unstable simulated prices. "
            "Try a shorter horizon or a different history window."
        )

    ending_prices = paths[:, -1]
    # Scaling before summing avoids overflow when finite prices are very large.
    mean_ending = float(np.sum(ending_prices / request.simulations))
    percentile_values = np.percentile(paths, [5, 25, 50, 75, 95], axis=0)
    if not np.isfinite(mean_ending) or not np.all(np.isfinite(percentile_values)):
        raise SimulationError("Simulation summary exceeds supported numerical limits.")
    percentile_paths = dict(zip(
        ("p05", "p25", "p50", "p75", "p95"), percentile_values.tolist(),
    ))
    sample_count = min(MAX_SAMPLE_PATHS, request.simulations)
    return {
        "model": MODEL_VERSION,
        "label": "Model-based estimates, not guaranteed predictions or investment advice.",
        "simulations": request.simulations,
        "horizon_days": request.horizon_days,
        "seed": seed,
        "rng": "PCG64",
        "numpy_version": np.__version__,
        "starting_price": starting_price,
        "estimates": {
            "return_observations": len(log_returns),
            "mean_daily_log_return": mean_log_return,
            "daily_volatility": daily_volatility,
            "daily_gbm_drift": daily_gbm_drift,
            "annualized_volatility": float(annualized_volatility),
            "trading_days_per_year": TRADING_DAYS_PER_YEAR,
        },
        "summary": {
            "mean_ending_price": mean_ending,
            "median_ending_price": percentile_paths["p50"][-1],
            "p05_ending_price": percentile_paths["p05"][-1],
            "p95_ending_price": percentile_paths["p95"][-1],
            "probability_above_start": float(np.mean(ending_prices > starting_price)),
            "probability_below_start": float(np.mean(ending_prices < starting_price)),
            "probability_equal_start": float(np.mean(ending_prices == starting_price)),
            "target_price": request.target_price,
            "probability_above_target": (
                float(np.mean(ending_prices > request.target_price))
                if request.target_price is not None else None
            ),
        },
        "days": list(range(request.horizon_days + 1)),
        "ending_prices": ending_prices.tolist(),
        "percentile_paths": percentile_paths,
        # The first 200 independently generated trials, not selected by outcome.
        # IDs map samples to ending_prices; later animation can reveal all ends.
        "sample_path_ids": list(range(sample_count)),
        "sample_paths": paths[:sample_count].tolist(),
    }


def run_monte_carlo(request: MonteCarloRequest):
    """Fetch once through the existing cache, then run the numerical engine."""
    history = get_history(request.ticker, request.history_period)
    rows = history["prices"]
    result = simulate_prices([row["close"] for row in rows], request)
    return {
        "ticker": history["ticker"],
        "currency": history.get("currency"),
        "as_of": rows[-1]["time"],
        "history_period": request.history_period,
        "history_start": rows[0]["time"],
        "history_end": rows[-1]["time"],
        "historical_observations": len(rows),
        "adjusted": history["adjusted"],
        **result,
    }
