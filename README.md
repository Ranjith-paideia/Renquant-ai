# Aegis Alpha

A secure, local-first research and paper-trading MVP for Indian retail users. It covers equities, crypto, forex, futures and options as research universes while keeping live execution absent and paper trading visibly enforced.

## What works

- ₹10–₹100 contributions with unused funds carried forward.
- Deposits tracked separately from genuine trading profit.
- Balance-aware trade frequency, risk, leverage and instrument eligibility.
- Pre-session ₹1,000 aspiration feasibility calculation including modeled brokerage, taxes/fees, spread and slippage.
- Multi-asset opportunity ranking by expected value, confidence, liquidity, probability and risk–reward.
- Backtest, walk-forward, out-of-sample, Monte Carlo, regime and paper-validation views.
- Paper order ticket, positions, pending orders, emergency halt and explicit resume review.
- Local journal and audit log persisted in browser storage.
- Passphrase-encrypted SQLite-in-WebAssembly vault persisted as ciphertext in IndexedDB.
- Real Binance public quote and one-year kline adapters for crypto research.
- Server-side Alpha Vantage adapter scaffolding for equities, FX, commodities and options; unavailable until a key is configured.
- Event-driven next-bar backtesting worker with position sizing, stop execution, slippage, fees, rejected orders and Monte Carlo sequencing.
- Curated primary/peer-reviewed evidence with reliability scores and rejected-claim notes.

The included figures are deterministic demo data, not recommendations or performance promises. ₹1,000/day is aspirational and usually mathematically infeasible for a small balance.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the printed local URL. Data stays in that browser profile under the `aegis-alpha-v1` local-storage key.

Create or unlock the Data vault in the sidebar to migrate the demo state into encrypted SQLite. Once migrated, the legacy local-storage record is removed. The passphrase is held in memory only and cannot be recovered.

Binance public crypto data works without credentials. To enable the optional Alpha Vantage adapters, copy `.env.example` to `.env.local`, set `ALPHA_VANTAGE_API_KEY`, and restart the local server. The key remains server-side and is never exposed to the browser.

## Verify

```bash
npm test
npm run build
```

## Docker

```bash
docker build -t aegis-alpha .
docker run --rm -p 3000:3000 aegis-alpha
```

## Security boundaries

- There is no live-order API in this MVP.
- No broker credential is requested, stored or transmitted.
- Future credentials must be trade-only, least privilege, withdrawal-disabled and stored through an OS-backed encrypted vault, never browser storage.
- Live execution must be a separately reviewed module with explicit per-session approval, broker-side limits and an independently tested kill switch.
- The emergency halt blocks new paper orders, models cancellation of pending orders and flattening of simulated exposure, and records the event locally.

## Architecture

- `app/page.tsx` — local-first product shell and research surfaces.
- `app/api/market-data/route.ts` — allowlisted, timeout-limited market-data gateway.
- `lib/trading-engine.ts` — pure balance policy, cost, feasibility, ranking and risk-halt rules.
- `lib/encrypted-vault.ts` — SQLite WASM plus PBKDF2/AES-GCM encrypted IndexedDB persistence.
- `lib/backtest-engine.ts` — event-driven execution and Monte Carlo engine.
- `lib/backtest.worker.ts` — isolated background worker for research runs.
- `lib/market-data.ts` — provider schemas and strict response normalizers.
- `lib/trading-engine.test.ts` — unit tests for key safety invariants.

## Limits of this MVP

Demo strategy scores and probabilities remain illustrative. Binance data availability depends on geography and provider uptime. Equity, FX, futures and options feeds require an Alpha Vantage key or another licensed adapter. There is no broker connection, tax advice or production-grade tamper-proof audit database. Rates, regulations, contract sizes, minimum orders and broker schedules must be refreshed from primary sources before any real-money design review.
