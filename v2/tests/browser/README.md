# Closing Checks Without a Browser

Current verification uses Vitest + jsdom (dev dependency), React act/createRoot,
mocked fetch and fake timers. It does not start a server or open a browser:

```sh
NODE_OPTIONS='--max-old-space-size=512' timeout --kill-after=5s 60s \
	node_modules/.bin/vitest run \
	src/__tests__/closing-accruals-ui-safety.test.tsx \
	src/__tests__/closing-summary-ui-safety.test.tsx \
	src/__tests__/closing-wizard-ui-safety.test.tsx \
	--maxWorkers=1 --testTimeout=5000 --hookTimeout=5000
```

The 25 DOM tests cover period isolation, delayed responses, load errors/retry,
reset/save exclusion, year-end conflict confirmation and loading deadlines.
Related server checks: closing-state-api-safety, year-end-status and year-end.
Mocks must return a fresh Response for every fetch; reusing a consumed body can
produce an incidental error and hide the intended failure. No production API
requests, real waits, visual assertions or authenticated Next E2E are involved.

## Historical Soliq Component Harness

The following browser procedure is archived. Its Vite process was stopped on
2026-09-10 after the user requested no further browser checks. Do not restart
or open it under that requirement. Earlier visual results are historical only.

This isolated Vite page renders the real Step4/Step5/Step6 and CashFlowClient components with project CSS.
It is not an authenticated Next.js end-to-end test and is not run by npm test.

From v2, with the existing dependencies installed:

```sh
NODE_OPTIONS='--max-old-space-size=512' node_modules/.bin/vite --config tests/browser/vite.config.mts
```

Open http://127.0.0.1:4177/tests/browser/soliq.html. The port is strict: do not
stop an unrelated listener if occupied. Vite currently comes through Vitest;
the harness has no separately installed browser runner.

No application API proxy is configured. Intercept /v2/api/** with synthetic
responses in the browser test tool; unmatched requests return 503. The config
uses a harness-local envDir and disables filesystem watching to avoid host
watcher exhaustion. Enter r in the Vite terminal after source edits, then reload.

Verified scenarios: restore READY; manual matching by rowId; exact batch/decision
request; error/retry; empty batch; cancellation reason; list error/retry;
POSTED reentry without writes; archive links; long names at mobile widths;
period switch while an old completion response is delayed. Server contracts,
actual export bytes and PostgreSQL transactions have separate Vitest coverage.
Native download completion in the integrated browser remains unverified.

The Test step selector also covers accrual/FX input: invalid precision is refused
before POST, valid decimal strings are sent unchanged, and the no-foreign-bank branch
persists zero FX rather than retaining a previous difference. An API failure
must keep the current step; retry succeeds only after a successful response.

FX checks also covered EUR-only and mixed USD/EUR refusal, malformed bank data,
API failure/retry, delayed GET/POST during period changes and 320/375/1280 px.
This is a current-bank guard, not verification of foreign-currency debts or
historical rates. These browser checks predate the request to stop opening the
browser; subsequent automated checks must run without a browser.

Cashflow scenarios: 409/404 show an alert without report tables; retry with 200
restores the report; changing banks removes old totals while loading; a delayed
bank-A response cannot overwrite bank B. Error layout checked at 320/375/1280 px.
The select opens on focus: blur it before reopening after choosing an option.
Transient Recharts size warnings occur on mount; this is not a full chart audit.

Cashflow calendar: with browser timezone America/Los_Angeles and time fixed at
2025-12-31T20:00:00Z, YEAR/QUARTER/MONTH request 2026-01-01 through respectively
2026-12-31, 2026-03-31 and 2026-01-31. Custom defaults use 2026 too. At
2024-02-28T20:00:00Z the current month ends 2024-02-29. Restore the browser clock
and timezone after this scenario. The integrated tool has no global URL in its
Node sandbox; parse URLs through page.evaluate or capture request URL strings.