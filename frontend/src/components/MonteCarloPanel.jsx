import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  LoaderCircle,
  ChartNoAxesCombined,
  CircleAlert,
} from "lucide-react";
import { runSimulation } from "../services/stockApi";
import { priceDomain, probabilities } from "../utils/simulation";
import SimulationChart from "./SimulationChart";
import { number } from "./StockHeader";

const DEFAULTS = {
  simulations: 10000,
  horizon_days: 30,
  history_period: "1y",
  seed: "42",
};
const percent = (value) => `${(value * 100).toFixed(2)}%`;

export default function MonteCarloPanel({ ticker, history }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [targetText, setTargetText] = useState("");
  const [result, setResult] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const controller = useRef(null);
  const elapsed = useRef(0);
  const done = useRef(false);
  const target =
    targetText.trim() &&
    Number.isFinite(Number(targetText)) &&
    Number(targetText) > 0
      ? Number(targetText)
      : null;
  const targetInvalid = targetText !== "" && target == null;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!result || paused || done.current) return;
    let frame,
      previous = performance.now(),
      lastPaint = 0;
    function tick(now) {
      elapsed.current += now - previous;
      previous = now;
      const value = Math.min(1, elapsed.current / 6500);
      if (now - lastPaint > 60 || value === 1) {
        setProgress(value);
        lastPaint = now;
      }
      if (value < 1) frame = requestAnimationFrame(tick);
      else done.current = true;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result, paused, replay]);

  function clearResult() {
    controller.current?.abort();
    setResult(null);
    setSnapshot(null);
    setLoading(false);
    setError("");
    setProgress(0);
    setPaused(false);
    elapsed.current = 0;
    done.current = false;
  }
  function changeSetting(key, value) {
    clearResult();
    setSettings((old) => ({ ...old, [key]: value }));
  }
  function reset() {
    clearResult();
    setSettings(DEFAULTS);
    setTargetText("");
  }
  function replayResult() {
    elapsed.current = 0;
    done.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setProgress(done.current ? 1 : 0);
    setPaused(false);
    setReplay((n) => n + 1);
  }
  async function run(event) {
    event.preventDefault();
    if (targetInvalid) return;
    clearResult();
    setLoading(true);
    const current = new AbortController();
    controller.current = current;
    try {
      const response = await runSimulation(
        {
          ticker,
          simulations: settings.simulations,
          horizon_days: settings.horizon_days,
          history_period: settings.history_period,
          seed: settings.seed === "" ? null : Number(settings.seed),
          target_price: target,
        },
        current.signal,
      );
      if (current.signal.aborted) return;
      done.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setProgress(done.current ? 1 : 0);
      setSnapshot(history);
      setResult(response);
    } catch (err) {
      if (!current.signal.aborted) setError(err.message);
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }
  const revealed = result
    ? Math.min(result.simulations, Math.floor(progress * result.simulations))
    : 0;
  const ends = useMemo(
    () => result?.ending_prices.slice(0, revealed) || [],
    [result, revealed],
  );
  const odds = useMemo(
    () => (result ? probabilities(ends, result.starting_price) : null),
    [result, ends],
  );
  const targetOdds = useMemo(
    () => (target == null ? null : probabilities(ends, target)),
    [ends, target],
  );
  const domain = useMemo(() => (result ? priceDomain(result) : null), [result]);
  const complete = progress === 1;

  return (
    <section className="mc-panel" aria-labelledby="mc-title">
      <div className="mc-heading">
        <div>
          <p className="eyebrow">
            <span /> EXPLORE WHAT COULD HAPPEN
          </p>
          <h2 id="mc-title">One stock. Thousands of possible futures.</h2>
          <p>
            Run a Monte Carlo simulation for <strong>{ticker}</strong> and
            explore the range of modelled outcomes.
          </p>
        </div>
        <span className="mc-model-tag">GBM MODEL</span>
      </div>
      <form className="mc-controls" onSubmit={run}>
        <label>
          Simulations
          <select
            value={settings.simulations}
            onChange={(e) =>
              changeSetting("simulations", Number(e.target.value))
            }
          >
            {[100, 1000, 5000, 10000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()} trials
              </option>
            ))}
          </select>
        </label>
        <label>
          Forecast horizon
          <select
            value={settings.horizon_days}
            onChange={(e) =>
              changeSetting("horizon_days", Number(e.target.value))
            }
          >
            {[7, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} trading days
              </option>
            ))}
          </select>
        </label>
        <label>
          Historical window
          <select
            value={settings.history_period}
            onChange={(e) => changeSetting("history_period", e.target.value)}
          >
            <option value="6mo">6 months</option>
            <option value="1y">1 year</option>
            <option value="3y">3 years</option>
            <option value="5y">5 years</option>
          </select>
        </label>
        <label>
          Seed <span className="optional">optional</span>
          <input
            type="number"
            min="0"
            max="4294967295"
            step="1"
            placeholder="Random"
            value={settings.seed}
            onChange={(e) => changeSetting("seed", e.target.value)}
          />
        </label>
        <label>
          Target price <span className="optional">optional</span>
          <input
            type="number"
            min="0.000001"
            step="any"
            placeholder="e.g. 250"
            value={targetText}
            aria-invalid={targetInvalid}
            onChange={(e) => setTargetText(e.target.value)}
          />
        </label>
        <button
          className="mc-run"
          type="submit"
          disabled={loading || targetInvalid}
        >
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={16} />
          )}{" "}
          {loading ? "Computing…" : "Run Monte Carlo"}
        </button>
        <button className="mc-reset" type="button" onClick={reset}>
          <RotateCcw size={14} /> Reset
        </button>
      </form>
      {targetInvalid && (
        <p className="mc-error" role="alert">
          Enter a positive target price or leave it blank.
        </p>
      )}
      {error && (
        <div className="mc-error" role="alert">
          <CircleAlert size={18} />
          <div>
            <strong>Simulation could not run</strong>
            <p>{error} Check your settings and use Run Monte Carlo to retry.</p>
          </div>
        </div>
      )}
      {!result && !error && (
        <div
          className={`mc-empty ${loading ? "is-loading" : ""}`}
          role="status"
        >
          {loading ? (
            <LoaderCircle size={30} className="spin" />
          ) : (
            <ChartNoAxesCombined size={34} />
          )}
          <h3>
            {loading
              ? `Computing ${settings.simulations.toLocaleString()} scenarios for ${ticker}`
              : "See the possibilities take shape."}
          </h3>
          <p>
            {loading
              ? "Fetching historical returns and calculating the model. Visualization begins when the results are ready."
              : "The fan opens into possible price paths. The sideways histogram shows where their ending prices cluster."}
          </p>
          {!loading && (
            <div className="mc-empty-legend">
              <span className="positive">↗ Above the starting close</span>
              <span className="negative">↘ Below the starting close</span>
            </div>
          )}
        </div>
      )}
      {result && (
        <>
          <div className="mc-playback">
            <div className="mc-progress-description">
              <strong>
                {complete
                  ? "Visualization complete"
                  : paused
                    ? "Visualization paused"
                    : "Visualization progress"}
              </strong>
              <span>
                {revealed.toLocaleString()} /{" "}
                {result.simulations.toLocaleString()} endings revealed ·
                computation complete
              </span>
            </div>
            <div className="mc-playback-buttons">
              {!complete ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPaused((value) => !value)}
                  >
                    {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      done.current = true;
                      setProgress(1);
                      setPaused(true);
                    }}
                  >
                    <FastForward size={14} /> Show all
                  </button>
                </>
              ) : (
                <button type="button" onClick={replayResult}>
                  <RotateCcw size={14} /> Replay
                </button>
              )}
            </div>
          </div>
          <div
            className="mc-progress"
            role="progressbar"
            aria-label="Visualization progress"
            aria-valuemin={0}
            aria-valuemax={result.simulations}
            aria-valuenow={revealed}
          >
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mc-odds">
            <div>
              <span>ENDING ABOVE START</span>
              <strong className="positive">
                {revealed ? percent(odds.above) : "—"}
              </strong>
            </div>
            <div>
              <span>
                STARTING ADJUSTED CLOSE ·{" "}
                {result.currency || "CURRENCY UNKNOWN"}
              </span>
              <strong>
                {number(result.starting_price)}{" "}
                <small>as of {result.as_of}</small>
              </strong>
            </div>
            <div>
              <span>ENDING BELOW START</span>
              <strong className="negative">
                {revealed ? percent(odds.below) : "—"}
              </strong>
            </div>
          </div>
          {odds?.equal > 0 && (
            <p className="mc-equal">
              {percent(odds.equal)} finish exactly at the starting price.
            </p>
          )}
          <SimulationChart
            result={result}
            history={snapshot}
            revealed={revealed}
            target={target}
            onTarget={setTargetText}
          />
          <div className="mc-target">
            <div>
              <h3>Explore a target price</h3>
              <p>
                Move the slider, enter a target above, or click the
                distribution. No rerun needed.
              </p>
            </div>
            <label className="mc-slider-label">
              <span className="sr-only">Target price slider</span>
              <input
                type="range"
                aria-label="Target price slider"
                min={Math.max(0.000001, domain[0])}
                max={domain[1]}
                step="any"
                value={Math.min(
                  domain[1],
                  Math.max(domain[0], target ?? result.starting_price),
                )}
                onChange={(e) =>
                  setTargetText(Number(e.target.value).toFixed(2))
                }
              />
            </label>
            <div className="mc-target-result">
              {target != null && revealed ? (
                <>
                  <strong>{percent(targetOdds.above)}</strong>
                  <span>
                    ending above {number(target)} {result.currency}
                  </span>
                  <small>
                    {percent(targetOdds.below)} below
                    {targetOdds.equal > 0
                      ? ` · ${percent(targetOdds.equal)} equal`
                      : ""}
                  </small>
                </>
              ) : (
                <span>Choose a target to see its probability</span>
              )}
            </div>
          </div>
          {complete && (
            <div className="mc-summary" aria-label="Simulation results">
              {[
                [
                  "Median ending price",
                  number(result.summary.median_ending_price),
                ],
                ["Mean ending price", number(result.summary.mean_ending_price)],
                ["5th percentile", number(result.summary.p05_ending_price)],
                ["95th percentile", number(result.summary.p95_ending_price)],
                [
                  "Annualized volatility",
                  percent(result.estimates.annualized_volatility),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          <div className="mc-provenance">
            {result.history_start} — {result.history_end} ·{" "}
            {result.estimates.return_observations} historical returns · seed{" "}
            {result.seed} · {result.currency || "currency unavailable"}.{" "}
            {complete
              ? "Probabilities use all trials."
              : "Probabilities use revealed endings; bands show the completed model."}
          </div>
        </>
      )}
      <details className="mc-explainer">
        <summary>How to read this simulation</summary>
        <p>
          Green means above the starting close; red means below. Stronger
          shading marks the middle 50% of outcomes within the lighter 5th–95th
          percentile band. The gold line is the median, and the dashed lines
          mark the 25th and 75th percentiles—not two “most likely” individual
          futures. Bands are pointwise percentiles, not guaranteed boundaries
          for an entire path.
        </p>
        <p>
          The sideways histogram uses the same vertical price scale. Wider,
          brighter bars contain more simulated endings; its outline follows the
          actual bins rather than assuming a symmetric bell curve. Paths are a
          display sample, while the histogram and probabilities use every
          revealed trial. Below/above a target refers to the ending price, not
          whether a path touches it.
        </p>
        <p>
          The model assumes independent daily returns with constant drift and
          volatility estimated from historical adjusted prices. These are
          model-based estimates, not investment recommendations or guaranteed
          predictions. Trading days are steps, not calendar dates.
        </p>
      </details>
    </section>
  );
}
