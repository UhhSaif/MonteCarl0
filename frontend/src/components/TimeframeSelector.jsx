const periods = [
  ["1mo", "1M"],
  ["3mo", "3M"],
  ["6mo", "6M"],
  ["1y", "1Y"],
  ["5y", "5Y"],
  ["max", "MAX"],
];
export default function TimeframeSelector({ value, onChange }) {
  return (
    <div className="timeframes" aria-label="Historical timeframe">
      {periods.map(([key, label]) => (
        <button
          key={key}
          aria-pressed={value === key}
          className={value === key ? "selected" : ""}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
