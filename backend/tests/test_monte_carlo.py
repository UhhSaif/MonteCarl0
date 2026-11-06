"""Deterministic math checks and HTTP contracts; Yahoo is mocked here."""
from datetime import date, timedelta
from math import erf, exp, sqrt
from time import perf_counter
from unittest.mock import Mock

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas import MonteCarloRequest
from backend.services import monte_carlo as mc
from backend.services.market_data import MarketDataError

client = TestClient(app)


@pytest.fixture
def closes():
    returns = np.random.default_rng(10).normal(0.0004, 0.018, 252)
    return 100 * np.exp(np.r_[0, np.cumsum(returns)])


@pytest.fixture
def parameters():
    return MonteCarloRequest(ticker="NVDA", seed=42, target_price=120)


@pytest.fixture
def history_provider(monkeypatch, closes):
    history = {
        "ticker": "NVDA", "currency": "USD", "adjusted": True,
        "prices": [
            {"time": (date(2024, 1, 1) + timedelta(days=i)).isoformat(), "close": float(close)}
            for i, close in enumerate(closes)
        ],
    }
    fetch = Mock(return_value=history)
    monkeypatch.setattr(mc, "get_history", fetch)
    return fetch


def test_dimensions_positive_prices_and_sample_mapping(closes, parameters):
    result = mc.simulate_prices(closes, parameters)
    paths = np.array(result['sample_paths'])
    assert paths.shape == (200, 31)
    assert len(result['ending_prices']) == 10000
    assert result['days'] == list(range(31))
    assert np.all(paths > 0) and np.all(np.isfinite(paths))
    assert np.all(np.array(result['ending_prices']) > 0)
    assert np.all(paths[:, 0] == closes[-1])
    for i, trial in enumerate(result['sample_path_ids']):
        assert paths[i, -1] == result['ending_prices'][trial]


def test_reproducible_and_independent_rng(closes, parameters):
    first = mc.simulate_prices(closes, parameters)
    np.random.seed(999)  # Global RNG must not alter a parameters-local generator.
    assert first == mc.simulate_prices(closes, parameters)
    other = parameters.model_copy(update={"seed": 43})
    assert first['ending_prices'] != mc.simulate_prices(closes, other)['ending_prices']


def test_generated_seed_is_returned_and_replayable(closes):
    parameters = MonteCarloRequest(ticker='NVDA', simulations=100)
    result = mc.simulate_prices(closes, parameters)
    replay = parameters.model_copy(update={'seed': result['seed']})
    assert mc.simulate_prices(closes, replay) == result


def test_probabilities_and_percentiles_use_all_outcomes(closes, parameters):
    result = mc.simulate_prices(closes, parameters)
    ends = np.array(result['ending_prices'])
    summary = result['summary']
    assert summary['probability_above_start'] == np.mean(ends > closes[-1])
    assert summary['probability_below_start'] == np.mean(ends < closes[-1])
    assert summary['probability_above_target'] == np.mean(ends > parameters.target_price)
    for key in ('probability_above_start', 'probability_below_start', 'probability_equal_start', 'probability_above_target'):
        assert 0 <= summary[key] <= 1
    assert sum(summary[k] for k in ('probability_above_start', 'probability_below_start', 'probability_equal_start')) == pytest.approx(1)
    percentiles = np.array(list(result['percentile_paths'].values()))
    assert percentiles.shape == (5, 31)
    assert np.all(np.diff(percentiles, axis=0) >= 0)
    assert np.all(percentiles[:, 0] == closes[-1])
    assert percentiles[:, -1] == pytest.approx(np.percentile(ends, [5, 25, 50, 75, 95]))
    assert summary['mean_ending_price'] == pytest.approx(np.mean(ends))


def test_parameter_estimates_and_analytic_gbm_benchmark(closes, parameters):
    result = mc.simulate_prices(closes, parameters)
    returns = np.diff(np.log(closes))
    m, sigma = np.mean(returns), np.std(returns, ddof=1)
    estimates = result['estimates']
    assert estimates['mean_daily_log_return'] == pytest.approx(m)
    assert estimates['daily_volatility'] == pytest.approx(sigma)
    assert estimates['annualized_volatility'] == pytest.approx(sigma * sqrt(252))
    assert estimates['daily_gbm_drift'] == pytest.approx(m + sigma**2 / 2)
    horizon, n = parameters.horizon_days, parameters.simulations
    expected_mean = closes[-1] * exp((m + sigma**2 / 2) * horizon)
    variance = expected_mean**2 * (exp(sigma**2 * horizon) - 1)
    assert abs(result['summary']['mean_ending_price'] - expected_mean) < 5 * sqrt(variance / n)
    expected_up = (1 + erf(m * sqrt(horizon) / sigma / sqrt(2))) / 2
    assert abs(result['summary']['probability_above_start'] - expected_up) < 5 * sqrt(expected_up * (1 - expected_up) / n)


def test_flat_history_equality_and_target_semantics():
    parameters = MonteCarloRequest(ticker='FLAT', simulations=100, target_price=100, seed=0)
    result = mc.simulate_prices([100.] * 61, parameters)
    assert result['ending_prices'] == [100.] * 100
    assert result['summary']['probability_equal_start'] == 1
    assert result['summary']['probability_above_start'] == 0
    assert result['summary']['probability_below_start'] == 0
    assert result['summary']['probability_above_target'] == 0
    assert result['estimates']['daily_volatility'] == 0
    no_target = mc.simulate_prices([100.] * 61, parameters.model_copy(update={'target_price': None}))
    assert no_target['summary']['probability_above_target'] is None


@pytest.mark.parametrize('closes', [[], [100.] * 60, [[100.] * 61], [100.] * 60 + [0], [100.] * 60 + [-1], [100.] * 60 + [float('nan')], [100.] * 60 + [float('inf')]])
def test_bad_history_is_rejected(closes, parameters):
    with pytest.raises(mc.SimulationError):
        mc.simulate_prices(closes, parameters)


def test_numeric_overflow_is_reported(parameters):
    with pytest.raises(mc.SimulationError, match='numerically unstable'):
        mc.simulate_prices([1e-300, 1e300] * 31, parameters)


@pytest.mark.parametrize('simulations', [100, 1000, 5000, 10000])
@pytest.mark.parametrize('horizon', [7, 30, 60, 90])
def test_supported_sizes(simulations, horizon, closes):
    result = mc.simulate_prices(closes, MonteCarloRequest(ticker='NVDA', simulations=simulations, horizon_days=horizon, seed=42))
    assert len(result['ending_prices']) == simulations
    assert np.shape(result['sample_paths']) == (min(simulations, 200), horizon + 1)


@pytest.mark.parametrize('period', ['6mo', '1y', '3y', '5y'])
def test_api_metadata_defaults_and_periods(history_provider, period):
    response = client.post('/api/simulations/monte-carlo', json={'ticker': ' nvda ', 'history_period': period, 'seed': 42})
    assert response.status_code == 200
    body = response.json()
    assert body['ticker'] == 'NVDA'
    assert body['as_of'] == history_provider.return_value['prices'][-1]['time']
    assert body['starting_price'] == history_provider.return_value['prices'][-1]['close']
    assert body['adjusted'] is True
    assert body['simulations'] == 10000 and body['horizon_days'] == 30
    assert body['historical_observations'] == 253
    assert body['history_period'] == period
    history_provider.assert_called_once_with('NVDA', period)


@pytest.mark.parametrize('bad', [
    {'simulations': 10001}, {'simulations': 0}, {'simulations': -100},
    {'simulations': '100'}, {'simulations': 100.0}, {'simulations': True},
    {'horizon_days': 365}, {'horizon_days': 0}, {'horizon_days': False},
    {'history_period': 'max'}, {'history_period': '3mo'},
    {'seed': -1}, {'seed': 2**32}, {'seed': 1.5}, {'seed': True},
    {'target_price': -1}, {'target_price': 0}, {'target_price': 'NaN'}, {'target_price': True},
    {'ticker': ''}, {'ticker': 'bad ticker'}, {'ticker': 'A' * 21},
    {'unrecognized': 123},
])
def test_invalid_requests_never_fetch_history(bad, history_provider):
    response = client.post('/api/simulations/monte-carlo', json={'ticker': 'NVDA', **bad})
    assert response.status_code == 422
    assert response.json()['errors']
    history_provider.assert_not_called()


@pytest.mark.parametrize('literal', ['NaN', 'Infinity', '-Infinity'])
def test_nonfinite_json_target_rejected(literal, history_provider):
    response = client.post('/api/simulations/monte-carlo', content='{"ticker":"NVDA","target_price":' + literal + '}', headers={'Content-Type': 'application/json'})
    assert response.status_code == 422
    history_provider.assert_not_called()


@pytest.mark.parametrize('status', [404, 502, 503])
def test_provider_errors_propagate(history_provider, status):
    history_provider.side_effect = MarketDataError('Provider could not supply data.', status)
    response = client.post('/api/simulations/monte-carlo', json={'ticker': 'NVDA'})
    assert response.status_code == status
    assert response.json()['detail'] == 'Provider could not supply data.'


def test_insufficient_history_endpoint(history_provider):
    history_provider.return_value['prices'] = []
    response = client.post('/api/simulations/monte-carlo', json={'ticker': 'NVDA'})
    assert response.status_code == 422
    assert '61' in response.json()['detail']


def test_post_cors_preflight():
    response = client.options('/api/simulations/monte-carlo', headers={
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.status_code == 200
    assert 'POST' in response.headers['access-control-allow-methods']


def test_maximum_payload_is_bounded(history_provider):
    start = perf_counter()
    response = client.post('/api/simulations/monte-carlo', json={'ticker': 'NVDA', 'horizon_days': 90, 'seed': 42})
    elapsed = perf_counter() - start
    assert response.status_code == 200
    assert len(response.content) < 1_000_000
    assert len(response.json()['sample_paths']) == 200
    # No timing assertion: speed depends on hardware. Captured with pytest -s.
    print(f'10,000 x 90 API run (mocked history): {elapsed:.3f}s, {len(response.content):,} bytes')
