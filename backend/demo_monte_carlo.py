"""Exercise the real API contract with Yahoo data and save a reproducible snapshot.

Run from the repository root: .venv/bin/python -m backend.demo_monte_carlo
The output is a research artifact, never test fixture or fallback market data.
"""
import json
from pathlib import Path
from time import perf_counter

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.market_data import get_history
from backend.services.monte_carlo import simulate_prices
from backend.schemas import MonteCarloRequest


def main():
    payload = {
        "ticker": "NVDA", "simulations": 10000, "horizon_days": 30,
        "history_period": "1y", "target_price": 250, "seed": 42,
    }
    start = perf_counter()
    response = TestClient(app).post('/api/simulations/monte-carlo', json=payload)
    total_seconds = perf_counter() - start
    response.raise_for_status()
    result = response.json()
    # Save the actual estimation input too: seed alone cannot freeze Yahoo data.
    history = get_history(payload['ticker'], payload['history_period'])
    start = perf_counter()
    simulate_prices([p['close'] for p in history['prices']], MonteCarloRequest(**payload))
    engine_seconds = perf_counter() - start
    directory = Path('artifacts/monte-carlo')
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'nvda-request.json').write_text(json.dumps(payload, indent=2) + '\n')
    (directory / 'nvda-result.json').write_text(json.dumps(result, allow_nan=False) + '\n')
    (directory / 'nvda-history.json').write_text(json.dumps(history, allow_nan=False) + '\n')
    summary = {
        'ticker': result['ticker'], 'as_of': result['as_of'], 'currency': result['currency'],
        'history_start': result['history_start'], 'history_end': result['history_end'],
        'starting_price': result['starting_price'], 'simulations': result['simulations'],
        'horizon_days': result['horizon_days'], 'seed': result['seed'],
        'estimates': result['estimates'], 'summary': result['summary'],
        'engine_seconds': engine_seconds, 'api_with_provider_seconds': total_seconds,
        'response_bytes': len(response.content),
    }
    (directory / 'nvda-summary.json').write_text(json.dumps(summary, indent=2, allow_nan=False) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
