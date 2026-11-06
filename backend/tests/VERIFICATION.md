# Phase 1 verification

Verified locally on 2026-10-27 using Python 3.13 and Node 25.

- Backend: 16 tests pass without external network access.
- Frontend: Vite production build passes.
- Real Yahoo requests: company/ticker search, AAPL history, NVDA history, metadata in history response.
- Browser: real price chart renders; company-name Enter search; arrow-key selection; Escape dismissal; 5Y and MAX changes; invalid symbol error; recovery by selecting a valid symbol; crosshair readout.
- Mobile: inspected at 390 × 844; MAX history includes all 11,561 AAPL sessions across the chart after the resize fix.
- Session timing: verified Pandas Timestamp conversion and today's completed AAPL session after market close. Unit tests also cover intraday exclusion and absent timing metadata.

Provider calls remain subject to Yahoo availability and limits. Tests emit an upstream Starlette/httpx deprecation warning; live calls may emit yfinance/Pandas deprecation warnings. Neither prevented these checks. Manual zoom/scroll gestures and exhaustive assistive-technology testing were not performed.

## Monte Carlo backend milestone — 2026-10-27

- Entire backend suite: 83 tests pass, including existing historical-data tests.
- Real-data API exercise: NVDA, 10,000 trials, 30 trading days, 1-year history,
  seed 42, target USD 250; starting close USD 217.94 on 2026-10-27.
- Engine timing: ~16 ms; in-process API including provider access and serialization:
  ~434 ms, response 307,320 bytes. These are observed local timings, not SLAs.
- Maximum-size API benchmark with mocked history: 10,000 trials × 90 days,
  ~105 ms and 527,082 response bytes; only 200 full paths transferred.
- Real three-year history through the new endpoint: 751 completed closes,
  2023-10-30 through 2026-10-27.
- Exact demo inputs/results saved locally in git-ignored `artifacts/monte-carlo/`.
- Existing upstream deprecation warnings remain; no new dependencies, frontend
  changes, animations, or public deployment were introduced.

## Interactive simulation dashboard — 2026-11-06

- Backend suite: 83 tests pass; frontend calculation suite: 5 tests pass.
- Vite production build passes; no new runtime dependencies.
- Browser-verified real AAPL simulations at 10,000 trials for 30 and 90 trading days.
- Verified pause freezes revealed trial count during target edits, resume reaches
  completion, show-all reveals results, and replay reuses the same results.
- Target-price edits update empirical probabilities without starting a new run.
- Checked 390px mobile layout and horizontal access to the sideways histogram;
  restored the normal viewport afterward.
- Reduced-motion skipping and request cancellation are implemented; no automated
  browser emulation test for reduced-motion or deliberate provider outage was run.
