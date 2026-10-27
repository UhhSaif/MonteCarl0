"""Yahoo Finance access and JSON-safe transformations, independent of HTTP routes."""
from collections import OrderedDict
from datetime import datetime, timezone
import math
import re
from threading import RLock
from time import monotonic
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf
from yfinance.exceptions import YFPricesMissingError, YFRateLimitError, YFTzMissingError

PERIODS = {"1mo", "3mo", "6mo", "1y", "5y", "max"}


class MarketDataError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def normalize_ticker(value):
    ticker = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9^][A-Z0-9.^=\-]{0,19}", ticker):
        raise MarketDataError("Enter a valid ticker symbol, such as AAPL or BRK-B.", 400)
    return ticker


# Small process-local TTL cache: reduces Yahoo requests, not a persistence layer.
_cache = OrderedDict()
_lock = RLock()


def cached(key, ttl, fetch):
    with _lock:
        entry = _cache.get(key)
        if entry and monotonic() - entry[0] < ttl:
            _cache.move_to_end(key)
            return entry[1]
    value = fetch()  # Network calls must not hold the cache lock.
    with _lock:
        _cache[key] = (monotonic(), value)
        _cache.move_to_end(key)
        while len(_cache) > 128:
            _cache.popitem(last=False)
    return value


def provider_call(fetch):
    try:
        return fetch()
    except MarketDataError:
        raise
    except YFRateLimitError as exc:
        raise MarketDataError("Yahoo Finance is rate-limiting requests. Please try again shortly.", 503) from exc
    except (YFPricesMissingError, YFTzMissingError) as exc:
        raise MarketDataError("No historical data found for this symbol. Check the ticker or try another stock.", 404) from exc
    except Exception as exc:
        raise MarketDataError("Market data is temporarily unavailable. Please try again.", 502) from exc


def search_stocks(query):
    query = query.strip()
    if not query:
        return []
    if len(query) > 80:
        raise MarketDataError("Search must be 80 characters or fewer.", 400)

    def fetch():
        quotes = yf.Search(query, max_results=8, news_count=0, lists_count=0, timeout=10).quotes
        return [
            {"symbol": q["symbol"], "name": q.get("longname") or q.get("shortname") or q["symbol"],
             "exchange": q.get("exchDisp") or q.get("exchange")}
            for q in quotes if q.get("symbol") and q.get("quoteType") in {"EQUITY", "ETF"}
        ]
    return cached(("search", query.casefold()), 300, lambda: provider_call(fetch))


def clean_prices(frame, metadata, now=None):
    """Drop nonfinite bars and the current daily bar unless its session has closed.

    If session timing is unavailable, conservatively omit today's bar in the
    exchange timezone. A 15-minute grace period accounts for delayed daily data.
    """
    now = now or datetime.now(timezone.utc)
    try:
        tz = ZoneInfo(metadata.get("exchangeTimezoneName") or "UTC")
    except (KeyError, ValueError):
        tz = timezone.utc
    today = now.astimezone(tz).date()
    regular = (metadata.get("currentTradingPeriod") or {}).get("regular") or {}
    end = regular.get("end")
    # get_history_metadata converts Yahoo epoch seconds to pandas Timestamps.
    if isinstance(end, datetime) and end.tzinfo is not None:
        end = end.timestamp()
    session_closed = False
    if isinstance(end, (int, float)) and math.isfinite(end):
        close_date = datetime.fromtimestamp(end, tz).date()
        session_closed = close_date == today and now.timestamp() >= end + 900
    rows = {}
    for stamp, row in frame.sort_index().iterrows():
        day = pd.Timestamp(stamp).date()
        if day > today or (day == today and not session_closed):
            continue
        values = [row.get(c) for c in ("Open", "High", "Low", "Close")]
        if any(v is None or not math.isfinite(float(v)) or float(v) <= 0 for v in values):
            continue
        volume = row.get("Volume")
        rows[day.isoformat()] = {
            "time": day.isoformat(),
            **dict(zip(("open", "high", "low", "close"), map(float, values))),
            "volume": int(volume) if volume is not None and math.isfinite(float(volume)) and volume >= 0 else None,
        }
    return list(rows.values())


def get_history(ticker, period="1y"):
    ticker = normalize_ticker(ticker)
    if period not in PERIODS:
        raise MarketDataError("Unsupported period. Use 1mo, 3mo, 6mo, 1y, 5y, or max.", 400)

    def fetch():
        stock = yf.Ticker(ticker)
        frame = stock.history(period=period, interval="1d", auto_adjust=True, actions=False,
                              timeout=15, raise_errors=True)
        if frame.empty:
            raise MarketDataError("No historical data found for this symbol and period.", 404)
        metadata = stock.get_history_metadata() or {}
        prices = clean_prices(frame, metadata)
        if not prices:
            raise MarketDataError("No completed trading sessions are available for this symbol and period.", 404)
        latest = prices[-1]
        previous = prices[-2]["close"] if len(prices) > 1 else None
        change = latest["close"] - previous if previous is not None else None
        return {
            "ticker": ticker, "period": period, "adjusted": True,
            "name": metadata.get("longName") or metadata.get("shortName") or ticker,
            "exchange": metadata.get("fullExchangeName") or metadata.get("exchangeName"),
            "currency": metadata.get("currency"), "prices": prices,
            "latest_close": latest["close"], "as_of": latest["time"],
            "change": change, "change_percent": change / previous * 100 if previous else None,
        }
    return cached(("history", ticker, period), 300, lambda: provider_call(fetch))


def get_stock(ticker):
    # Reuse history metadata instead of requesting the expensive .info payload.
    data = get_history(ticker, "1mo")
    return {"symbol": data["ticker"], **{k: data[k] for k in ("name", "exchange", "currency")}}
