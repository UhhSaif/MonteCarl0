from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services import market_data as market

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_cache():
    market._cache.clear()


def bars():
    return pd.DataFrame({"Open": [100., 105.], "High": [103., 109.], "Low": [99., 104.],
                         "Close": [102., 108.], "Volume": [1000, 2000]},
                        index=pd.to_datetime(["2025-01-06", "2025-01-07"]))


@pytest.fixture
def provider(monkeypatch):
    stock = Mock()
    stock.history.return_value = bars()
    stock.get_history_metadata.return_value = {"longName": "Apple Inc.", "currency": "USD", "exchangeName": "NMS"}
    factory = Mock(return_value=stock)
    monkeypatch.setattr(market.yf, "Ticker", factory)
    return stock


def test_history_and_change(provider):
    response = client.get('/api/stocks/aapl/history?period=1y')
    assert response.status_code == 200
    data = response.json()
    assert data['ticker'] == 'AAPL'
    assert data['latest_close'] == 108
    assert data['as_of'] == '2025-01-07'
    assert data['change'] == 6
    assert data['change_percent'] == pytest.approx(6 / 102 * 100)
    assert data['adjusted'] is True
    assert provider.history.call_args.kwargs['auto_adjust'] is True


@pytest.mark.parametrize('period', ['1mo', '3mo', '6mo', '1y', '5y', 'max'])
def test_supported_periods(period, provider):
    assert client.get(f'/api/stocks/AAPL/history?period={period}').status_code == 200


def test_invalid_input_does_not_call_provider(provider):
    assert client.get('/api/stocks/AAPL/history?period=2y').status_code == 400
    assert client.get('/api/stocks/bad%20ticker/history').status_code == 400
    assert client.get('/api/search', params={'q': 'x' * 81}).status_code == 422
    provider.history.assert_not_called()


def test_empty_and_upstream_errors(provider):
    provider.history.return_value = pd.DataFrame()
    assert client.get('/api/stocks/BAD/history').status_code == 404
    provider.history.side_effect = RuntimeError('private upstream details')
    response = client.get('/api/stocks/AAPL/history')
    assert response.status_code == 502
    assert 'private' not in response.text
    provider.history.side_effect = market.YFRateLimitError()
    assert client.get('/api/stocks/AAPL/history').status_code == 503


def test_search_provider_and_empty(monkeypatch):
    search = Mock(return_value=SimpleNamespace(quotes=[
        {'symbol': 'NVDA', 'longname': 'NVIDIA Corporation', 'quoteType': 'EQUITY', 'exchDisp': 'NASDAQ'},
        {'symbol': 'FOO', 'quoteType': 'OPTION'},
    ]))
    monkeypatch.setattr(market.yf, 'Search', search)
    assert client.get('/api/search?q=%20').json() == []
    search.assert_not_called()
    assert client.get('/api/search?q=NVD').json() == [{'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'exchange': 'NASDAQ'}]
    assert search.call_args.args == ('NVD',)


def test_metadata_and_cache(provider):
    assert client.get('/api/stocks/AAPL').json() == {'symbol': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NMS', 'currency': 'USD'}
    client.get('/api/stocks/AAPL/history?period=1mo')
    assert provider.history.call_count == 1


def test_clean_sort_deduplicate_and_nonfinite():
    frame = pd.concat([bars().iloc[::-1], bars().iloc[[0]]])
    frame.loc[pd.Timestamp('2025-01-08')] = [1, 2, 1, float('nan'), 10]
    frame.loc[pd.Timestamp('2025-01-09')] = [1, float('inf'), 1, 2, 10]
    frame.loc[pd.Timestamp('2025-01-07'), 'Volume'] = float('nan')
    result = market.clean_prices(frame, {})
    assert [p['time'] for p in result] == ['2025-01-06', '2025-01-07']
    assert result[-1]['volume'] is None


@pytest.mark.parametrize('formatted', [False, True])
def test_unfinished_session_excluded_and_closed_session_included(formatted):
    now = datetime(2025, 1, 7, 17, tzinfo=timezone.utc)
    metadata = {'exchangeTimezoneName': 'America/New_York', 'currentTradingPeriod': {'regular': {'end': datetime(2025, 1, 7, 21, tzinfo=timezone.utc).timestamp()}}}
    if formatted:
        metadata['currentTradingPeriod']['regular']['end'] = pd.Timestamp('2025-01-07 16:00', tz='America/New_York')
    assert len(market.clean_prices(bars(), metadata, now)) == 1
    after_close = datetime(2025, 1, 7, 21, 16, tzinfo=timezone.utc)
    assert len(market.clean_prices(bars(), metadata, after_close)) == 2
    assert len(market.clean_prices(bars(), {}, after_close)) == 1


def test_single_bar_has_no_invented_change(provider):
    provider.history.return_value = bars().iloc[[0]]
    response = client.get('/api/stocks/AAPL/history').json()
    assert response['change'] is None and response['change_percent'] is None


def test_health():
    assert client.get('/api/health').json() == {'status': 'ok'}
