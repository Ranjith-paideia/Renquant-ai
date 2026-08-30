/// <reference lib="webworker" />
import { monteCarloLossProbability, runEventDrivenBacktest } from './backtest-engine';
import type { PriceBar } from './market-data';

self.onmessage = (event: MessageEvent<{ bars: PriceBar[]; initialCapital: number }>) => {
  try {
    const result = runEventDrivenBacktest(event.data.bars, { initialCapital: event.data.initialCapital });
    const monteCarlo = monteCarloLossProbability(result.trades, event.data.initialCapital);
    self.postMessage({ ok: true, result, monteCarlo });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Backtest failed.' });
  }
};

export {};
