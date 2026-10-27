import { ArrowUpRight, ArrowDownRight } from "lucide-react";
export const number = (value, digits = 2) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
export default function StockHeader({ data, fallbackName }) {
  const positive = data.change == null || data.change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="stock-header">
      <div className="stock-identity">
        <div className="ticker-icon">{data.ticker.slice(0, 1)}</div>
        <div>
          <div className="stock-name">
            <h2>
              {data.name === data.ticker
                ? fallbackName || data.ticker
                : data.name}
            </h2>
            <span className="symbol">{data.ticker}</span>
          </div>
          <p>
            {data.exchange || "Exchange unavailable"}
            <span className="dot-separator">·</span>
            {data.currency || "Currency unavailable"}
          </p>
        </div>
      </div>
      <div className="quote">
        <div className="quote-label">
          LATEST ADJUSTED CLOSE <span>{data.as_of}</span>
        </div>
        <div className="quote-values">
          <strong>{number(data.latest_close)}</strong>
          <span className={positive ? "positive" : "negative"}>
            <Icon size={17} />
            {data.change == null
              ? "—"
              : `${positive ? "+" : ""}${number(data.change)} (${positive ? "+" : ""}${number(data.change_percent)}%)`}
          </span>
        </div>
        <small>
          vs. previous trading session · {data.currency || "currency unknown"}
        </small>
      </div>
    </div>
  );
}
