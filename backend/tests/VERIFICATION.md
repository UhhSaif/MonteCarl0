# Phase 1 verification

Verified locally on 2026-10-27 using Python 3.13 and Node 25.

- Backend: 16 tests pass without external network access.
- Frontend: Vite production build passes.
- Real Yahoo requests: company/ticker search, AAPL history, NVDA history, metadata in history response.
- Browser: real price chart renders; company-name Enter search; arrow-key selection; Escape dismissal; 5Y and MAX changes; invalid symbol error; recovery by selecting a valid symbol; crosshair readout.
- Mobile: inspected at 390 × 844; MAX history includes all 11,561 AAPL sessions across the chart after the resize fix.
- Session timing: verified Pandas Timestamp conversion and today's completed AAPL session after market close. Unit tests also cover intraday exclusion and absent timing metadata.

Provider calls remain subject to Yahoo availability and limits. Tests emit an upstream Starlette/httpx deprecation warning; live calls may emit yfinance/Pandas deprecation warnings. Neither prevented these checks. Manual zoom/scroll gestures and exhaustive assistive-technology testing were not performed.
