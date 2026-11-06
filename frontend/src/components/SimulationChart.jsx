import { useId, useMemo, useState } from "react";
import { histogram, priceDomain, probabilities } from "../utils/simulation";
import { number } from "./StockHeader";

// SVG keeps the forecast fan and sideways histogram on exactly the same price
// scale. Only the API's <=200 sampled paths become SVG elements.
export default function SimulationChart({
  result,
  history,
  revealed,
  target,
  onTarget,
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  const geometry = useMemo(() => {
    const recent = (history?.prices || [])
      .filter((p) => p.time <= result.as_of)
      .slice(-25);
    // A newer simulation snapshot must never be connected to an old chart close.
    const aligned =
      recent.at(-1)?.time === result.as_of &&
      Math.abs(recent.at(-1).close - result.starting_price) < 0.01;
    const actual = aligned ? recent : [];
    const [low, high] = priceDomain(result, actual);
    const y = (price) => 38 + ((high - price) / (high - low)) * 340;
    const x = (day) => 205 + (day / result.horizon_days) * 455;
    const line = (values) =>
      values
        .map(
          (value, i) =>
            `${i ? "L" : "M"}${x(i).toFixed(2)},${y(value).toFixed(2)}`,
        )
        .join(" ");
    const band = (bottom, top) =>
      line(top) +
      bottom
        .map((_, i) => {
          const j = bottom.length - 1 - i;
          return `L${x(j).toFixed(2)},${y(bottom[j]).toFixed(2)}`;
        })
        .join(" ") +
      "Z";
    const p = result.percentile_paths;
    const historyLine = actual
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${(28 + (i / Math.max(1, actual.length - 1)) * 177).toFixed(2)},${y(p.close).toFixed(2)}`,
      )
      .join(" ");
    return {
      low,
      high,
      y,
      x,
      historyLine,
      paths: result.sample_paths.map(line),
      outer: band(p.p05, p.p95),
      inner: band(p.p25, p.p75),
      median: line(p.p50),
      lower: line(p.p25),
      upper: line(p.p75),
      bins: histogram(result.ending_prices, low, high),
    };
  }, [result, history]);
  const { low, high, y } = geometry;
  const ends = useMemo(
    () => result.ending_prices.slice(0, revealed),
    [result, revealed],
  );
  const bins = useMemo(() => histogram(ends, low, high), [ends, low, high]);
  const maxBin = Math.max(1, ...geometry.bins.map((b) => b.count));
  const threshold = hover ?? target;
  const odds = threshold == null ? null : probabilities(ends, threshold);
  const startY = y(result.starting_price);
  const sampleCount = Math.ceil(
    (revealed / result.simulations) * geometry.paths.length,
  );
  const complete = revealed === result.simulations;
  const histogramOutline =
    `M744,${y(bins[0].low)} ` +
    bins
      .map(
        (b) => `L${744 + (b.count / maxBin) * 155},${y((b.low + b.high) / 2)}`,
      )
      .join(" ") +
    ` L744,${y(bins.at(-1).high)}`;
  function inspect(event) {
    const svg = event.currentTarget.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    setHover(
      Math.max(
        low,
        Math.min(high, high - ((local.y - 38) / 340) * (high - low)),
      ),
    );
  }
  return (
    <div className="simulation-visual">
      <div className="sim-chart-legend">
        <span>
          <i className="legend-history" />
          Recent history
        </span>
        <span>
          <i className="legend-fan" />
          Middle 90% / 50%
        </span>
        <span>
          <i className="legend-median" />
          Median
        </span>
        <span>{complete ? "All outcomes" : "Revealing outcomes"}</span>
      </div>
      <p className="mc-mobile-hint">
        Swipe the chart sideways to explore the ending distribution →
      </p>
      <div
        className="sim-chart-scroll"
        tabIndex="0"
        aria-label="Forecast chart, scroll horizontally on narrow screens"
      >
        <svg
          viewBox="0 0 940 435"
          className="sim-chart"
          role="img"
          aria-label={`Monte Carlo forecast for ${result.ticker}: ${revealed.toLocaleString()} of ${result.simulations.toLocaleString()} endings revealed. Green is above and red below the starting close. Sideways histogram shares the price axis.`}
        >
          <defs>
            <clipPath id={`${id}-up`}>
              <rect
                x="0"
                y="38"
                width="940"
                height={Math.max(0, startY - 38)}
              />
            </clipPath>
            <clipPath id={`${id}-down`}>
              <rect
                x="0"
                y={startY}
                width="940"
                height={Math.max(0, 378 - startY)}
              />
            </clipPath>
            <clipPath id={`${id}-reveal`}>
              <rect
                x="205"
                y="38"
                width={455 * Math.min(1, (revealed / result.simulations) * 3)}
                height="340"
              />
            </clipPath>
          </defs>
          <text x="28" y="19" className="axis-label">
            OBSERVED
          </text>
          <text x="225" y="19" className="axis-label">
            SIMULATED · {result.horizon_days} TRADING DAYS
          </text>
          <text x="744" y="19" className="axis-label">
            ENDING DISTRIBUTION
          </text>
          {[0, 1, 2, 3, 4].map((i) => {
            const value = low + ((high - low) * i) / 4;
            return (
              <g key={i}>
                <line
                  x1="28"
                  x2="910"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#273139"
                  strokeDasharray="3 5"
                />
                <text
                  x="728"
                  y={y(value) - 5}
                  textAnchor="end"
                  className="axis-price"
                >
                  {number(value)}
                </text>
              </g>
            );
          })}
          <line
            x1="205"
            x2="205"
            y1="30"
            y2="388"
            stroke="#526167"
            strokeDasharray="4 5"
          />
          {geometry.historyLine ? (
            <path
              d={geometry.historyLine}
              fill="none"
              stroke="#b5c1c7"
              strokeWidth="2"
            />
          ) : (
            <text x="35" y="350" className="axis-label">
              STARTING CLOSE
            </text>
          )}
          <g clipPath={`url(#${id}-reveal)`}>
            {["up", "down"].map((side) => (
              <g
                key={side}
                clipPath={`url(#${id}-${side})`}
                fill={side === "up" ? "#8ad5a3" : "#ed9295"}
              >
                <path d={geometry.outer} opacity="0.10" />
                <path d={geometry.inner} opacity="0.22" />
                {geometry.paths.slice(0, sampleCount).map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={side === "up" ? "#8ad5a3" : "#ed9295"}
                    strokeWidth="0.7"
                    opacity="0.15"
                  />
                ))}
              </g>
            ))}
            <path
              d={geometry.upper}
              fill="none"
              stroke="#aac4b8"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity=".6"
            />
            <path
              d={geometry.lower}
              fill="none"
              stroke="#aac4b8"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity=".6"
            />
            <path
              d={geometry.median}
              fill="none"
              stroke="#f1d69a"
              strokeWidth="2.5"
            />
          </g>
          {["up", "down"].map((side) => (
            <g key={side} clipPath={`url(#${id}-${side})`}>
              {bins.map((b, i) => (
                <rect
                  key={i}
                  x="744"
                  y={y(b.high)}
                  width={(b.count / maxBin) * 155}
                  height={Math.max(0.5, y(b.low) - y(b.high) - 1)}
                  rx="1"
                  fill={side === "up" ? "#8ad5a3" : "#ed9295"}
                  opacity={0.25 + (b.count / maxBin) * 0.55}
                />
              ))}
              <path
                d={histogramOutline}
                fill="none"
                stroke={side === "up" ? "#8ad5a3" : "#ed9295"}
                strokeWidth="1.6"
                opacity=".9"
              />
            </g>
          ))}
          <line
            x1="28"
            x2="910"
            y1={startY}
            y2={startY}
            stroke="#a9b8c0"
            strokeDasharray="5 5"
            opacity=".65"
          />
          <circle cx="205" cy={startY} r="4" fill="#e0e8e4" />
          <text x="32" y={startY - 8} className="axis-price">
            Start {number(result.starting_price)}
          </text>
          {threshold != null && threshold >= low && threshold <= high && (
            <g>
              <rect
                x="744"
                y="38"
                width="165"
                height={Math.max(0, y(threshold) - 38)}
                fill="#e6c992"
                opacity=".07"
              />
              <line
                x1="205"
                x2="910"
                y1={y(threshold)}
                y2={y(threshold)}
                stroke="#efce92"
                strokeDasharray="3 3"
              />
              <text
                x="655"
                y={y(threshold) - 6}
                textAnchor="end"
                fill="#efce92"
                fontSize="10"
              >
                {hover != null ? "Inspect" : "Target"} {number(threshold)}
              </text>
            </g>
          )}
          <rect
            x="738"
            y="38"
            width="180"
            height="340"
            fill="transparent"
            onPointerMove={inspect}
            onPointerLeave={() => setHover(null)}
            onClick={() => {
              if (hover != null) onTarget(hover.toFixed(2));
            }}
          >
            <title>
              Hover to inspect probabilities; click to set a target. A numeric
              target control is also available below.
            </title>
          </rect>
          <text x="205" y="407" textAnchor="middle" className="axis-label">
            DAY 0
          </text>
          {[0.5, 1].map((fraction) => (
            <text
              key={fraction}
              x={geometry.x(result.horizon_days * fraction)}
              y="407"
              textAnchor="middle"
              className="axis-label"
            >
              +{Math.round(result.horizon_days * fraction)} DAYS
            </text>
          ))}
          <text x="744" y="407" className="axis-label">
            ← FEWER · MORE →
          </text>
        </svg>
      </div>
      <div className="sim-chart-caption">
        <span>
          {geometry.paths.length} sample paths · bands use all{" "}
          {result.simulations.toLocaleString()} trials
        </span>
        <span>
          {hover != null && odds
            ? `At ${number(hover)}: ${(odds.above * 100).toFixed(2)}% above · ${(odds.below * 100).toFixed(2)}% below`
            : "Hover over the distribution to inspect a price"}
        </span>
      </div>
    </div>
  );
}
