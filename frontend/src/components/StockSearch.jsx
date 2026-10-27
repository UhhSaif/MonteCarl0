import { useEffect, useRef, useState } from "react";
import { Search, ArrowRight, LoaderCircle } from "lucide-react";
import { searchStocks } from "../services/stockApi";

export default function StockSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const container = useRef(null);
  const latestQuery = useRef("");
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setActive(-1);
    setError("");
    if (!query.trim()) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const matches = await searchStocks(query.trim(), controller.signal);
        if (!controller.signal.aborted && latestQuery.current === query)
          setResults(matches);
      } catch (err) {
        if (!controller.signal.aborted && latestQuery.current === query)
          setError(err.message);
      } finally {
        if (!controller.signal.aborted && latestQuery.current === query)
          setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    const close = (e) => {
      if (!container.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function choose(stock) {
    onSelect(stock);
    setOpen(false);
    setQuery("");
    latestQuery.current = "";
    setResults([]);
  }
  async function submit(e) {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    if (open && active >= 0 && results[active]) return choose(results[active]);
    let matches = results;
    if (loading) {
      try {
        matches = await searchStocks(text);
      } catch {
        matches = [];
      }
      if (latestQuery.current.trim() !== text) return;
    }
    const exact = matches.find(
      (r) => r.symbol.toLowerCase() === text.toLowerCase(),
    );
    if (exact) return choose(exact);
    if (matches.length) return choose(matches[0]);
    if (/^[a-z0-9^][a-z0-9.^=\-]{0,19}$/i.test(text))
      return choose({ symbol: text.toUpperCase() });
    setOpen(true);
    setError(
      loading
        ? "Searching… choose a result when it appears."
        : "No matching company. Try its ticker symbol.",
    );
  }
  return (
    <div
      ref={container}
      className="search-wrapper"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <form className="search-field" onSubmit={submit}>
        <Search size={20} className="search-icon" />
        <input
          aria-label="Search stocks by ticker or company"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !!query.trim()}
          aria-controls="stock-results"
          aria-activedescendant={
            open && active >= 0 ? `stock-option-${active}` : undefined
          }
          placeholder="Search a company or ticker symbol"
          value={query}
          maxLength={80}
          autoComplete="off"
          spellCheck="false"
          onChange={(e) => {
            latestQuery.current = e.target.value;
            setQuery(e.target.value);
            setResults([]);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              if (results.length)
                setActive((i) =>
                  e.key === "ArrowDown"
                    ? (i + 1) % results.length
                    : i <= 0
                      ? results.length - 1
                      : i - 1,
                );
            }
          }}
        />
        <button type="submit" aria-label="Search">
          <ArrowRight size={19} />
        </button>
      </form>
      {open && query.trim() && (
        <div className="suggestions">
          <ul role="listbox" id="stock-results" aria-label="Matching stocks">
            {results.map((stock, i) => (
              <li
                key={stock.symbol}
                id={`stock-option-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(stock)}
                onPointerMove={() => setActive(i)}
              >
                <strong>{stock.symbol}</strong>
                <span>{stock.name}</span>
                <small>{stock.exchange}</small>
              </li>
            ))}
          </ul>
          <div className="search-status" role="status">
            {loading ? (
              <>
                <LoaderCircle size={14} className="spin" /> Searching markets…
              </>
            ) : (
              error ||
              (!results.length
                ? "No matches. You can still enter a ticker directly."
                : "↑ ↓ to navigate · Enter to select · Esc to close")
            )}
          </div>
        </div>
      )}
    </div>
  );
}
