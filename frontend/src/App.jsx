import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleAlert,
  Database,
  Info,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import Header from "./components/Header";
import StockSearch from "./components/StockSearch";
import StockHeader, { number } from "./components/StockHeader";
import StockChart from "./components/StockChart";
import TimeframeSelector from "./components/TimeframeSelector";
import { getHistory } from "./services/stockApi";

export default function App() {
  const [stock, setStock] = useState({ symbol: "AAPL" });
  const [period, setPeriod] = useState("1y");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    getHistory(stock.symbol, period, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [stock.symbol, period, retry]);
  // Clear the old quote in the same update as selection; never label stale data with a new ticker.
  function selectStock(next) {
    setData(null);
    setLoading(true);
    setError("");
    setStock(next);
    setRetry((n) => n + 1);
  }
  function selectPeriod(next) {
    if (next !== period) {
      setData(null);
      setLoading(true);
      setPeriod(next);
    }
  }
  const prices = data?.prices || [];
  return (
    <>
      <Header />
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              <span /> THE RESEARCH WORKSPACE
            </p>
            <h1>A clearer view of the market.</h1>
            <p className="intro">
              Explore historical prices. Build your understanding.
            </p>
          </div>
          <span className="workspace-label">
            <ChartNoAxesCombined size={16} /> Market explorer
          </span>
        </div>
        <section className="search-section" aria-label="Stock search">
          <StockSearch onSelect={selectStock} />
          <p>
            Search global equities & ETFs <ArrowUpRight size={13} />
          </p>
        </section>
        <section
          className="market-panel"
          aria-label="Market history"
          aria-busy={loading}
        >
          {data ? (
            <StockHeader data={data} fallbackName={stock.name} />
          ) : (
            <div className="stock-placeholder">
              <span className="symbol">{stock.symbol}</span>
              <span>
                {loading
                  ? "Retrieving historical market data…"
                  : "Market data unavailable"}
              </span>
            </div>
          )}
          <div className="chart-toolbar">
            <div>
              <h3>Price history</h3>
              <span className="daily-tag">DAILY</span>
            </div>
            <TimeframeSelector value={period} onChange={selectPeriod} />
          </div>
          {loading ? (
            <div className="chart-state" role="status">
              <LoaderCircle size={28} className="spin" />
              <h3>Loading {stock.symbol}</h3>
              <p>Retrieving historical trading sessions from Yahoo Finance.</p>
              <div className="loading-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : error ? (
            <div className="chart-state error" role="alert">
              <CircleAlert size={28} />
              <h3>We couldn’t load this stock</h3>
              <p>{error}</p>
              <button className="retry" onClick={() => setRetry((n) => n + 1)}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          ) : (
            data && <StockChart prices={prices} currency={data.currency} />
          )}
          <div className="chart-footer">
            <span>
              <Database size={13} /> Yahoo Finance via yfinance
            </span>
            <span>
              {data
                ? `${prices.length.toLocaleString()} sessions · ${prices[0].time} — ${prices.at(-1).time}`
                : "Historical daily prices"}
              <span className="dot-separator">·</span>Not a live quote
            </span>
          </div>
        </section>
        <section className="data-strip" aria-label="Selected period details">
          <div>
            <span>OBSERVATION WINDOW</span>
            <strong>
              {data ? `${prices[0].time} — ${prices.at(-1).time}` : "—"}
            </strong>
          </div>
          <div>
            <span>FIRST ADJUSTED CLOSE</span>
            <strong>
              {data ? number(prices[0].close) : "—"}{" "}
              <small>{data?.currency}</small>
            </strong>
          </div>
          <div>
            <span>LATEST SESSION VOLUME</span>
            <strong>
              {data ? number(prices.at(-1).volume, 0) : "—"}{" "}
              <small>shares</small>
            </strong>
          </div>
          <div>
            <span>PRICE BASIS</span>
            <strong>
              Adjusted daily close <Info size={13} />
            </strong>
          </div>
        </section>
        <aside className="research-note">
          <span className="note-icon">
            <Info size={18} />
          </span>
          <div>
            <h3>Start with the data.</h3>
            <p>
              Prices are adjusted for splits and dividends. This workspace is
              for research and education; historical performance does not
              guarantee future results.
            </p>
          </div>
          <span className="note-tag">RESEARCH ONLY</span>
        </aside>
        <footer className="page-footer">
          <span>
            MonteCarl0 <span className="dot-separator">/</span> Market research,
            one observation at a time.
          </span>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView Lightweight Charts™
            <br />
            <small>Copyright (с) 2025 TradingView, Inc.</small>
          </a>
        </footer>
      </main>
    </>
  );
}
