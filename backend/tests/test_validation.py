import numpy as np
import pytest
from backend.validate_model import rolling_coverage


def test_future_changes_do_not_change_first_forecast():
    prices = 100 * np.exp(np.r_[0, np.cumsum(np.random.default_rng(3).normal(0, .02, 350))])
    original = rolling_coverage(prices)
    changed = prices.copy()
    changed[253:] *= 2
    altered = rolling_coverage(changed)
    assert original[0]['low'] == altered[0]['low']
    assert original[0]['high'] == altered[0]['high']
    assert altered[0]['actual'] == original[0]['actual'] * 2
    assert all(b['origin'] == a['end'] for a, b in zip(original, original[1:]))


def test_coverage_requires_holdout():
    with pytest.raises(ValueError, match='Not enough'):
        rolling_coverage([100.] * 260)
