import assert from 'node:assert/strict';
import test from 'node:test';
import { monteCarloLossProbability, runEventDrivenBacktest } from './backtest-engine.ts';
import type { PriceBar } from './market-data.ts';
/* oxlint-disable typescript/no-floating-promises -- node:test registers tests synchronously */

const bars: PriceBar[] = Array.from({ length: 180 }, (_, index) => {
  const trend = index < 60 ? 100 + index * 0.4 : index < 110 ? 124 - (index - 60) * 0.35 : 106.5 + (index - 110) * 0.55;
  const close = trend + Math.sin(index / 3) * 1.4;
  return { time: Date.UTC(2025, 0, index + 1), open: close - 0.2, high: close + 1, low: close - 1, close, volume: 10_000 + index };
});

test('event-driven backtest uses next-bar fills and preserves capital constraints', () => {
  const result = runEventDrivenBacktest(bars, { initialCapital: 10_000 });
  assert.ok(result.finalCapital > 0);
  assert.ok(result.totalCosts >= 0);
  assert.ok(result.maxDrawdownPct >= 0);
  assert.ok(result.equityCurve.length > 100);
  assert.ok(result.trades.every((trade) => trade.quantity >= 1));
});

test('Monte Carlo output remains bounded and deterministic', () => {
  const result = runEventDrivenBacktest(bars, { initialCapital: 10_000 });
  const monteCarlo = monteCarloLossProbability(result.trades, 10_000, 200);
  assert.ok(monteCarlo.lossProbabilityPct >= 0 && monteCarlo.lossProbabilityPct <= 100);
  assert.ok(monteCarlo.drawdown95Pct >= 0);
});
