import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAlphaDaily, normalizeAlphaFx, normalizeAlphaOptions, normalizeBinanceKlines, normalizeBinanceTicker } from './market-data.ts';
/* oxlint-disable typescript/no-floating-promises -- node:test registers tests synchronously */

test('normalizes and validates Binance quotes', () => {
  const quote = normalizeBinanceTicker('BTCUSDT', { lastPrice: '64000.5', priceChangePercent: '1.25', quoteVolume: '900000', closeTime: 1_735_689_600_000 });
  assert.equal(quote.price, 64_000.5);
  assert.equal(quote.provider, 'Binance');
  assert.equal(quote.delayed, false);
});

test('rejects malformed kline payloads', () => {
  assert.throws(() => normalizeBinanceKlines([[1, 2]]), /Invalid Binance kline row/);
});

test('normalizes OHLCV bars without trusting extra fields', () => {
  const bars = normalizeBinanceKlines([[1000, '10', '12', '9', '11', '50', 2000, '0']]);
  assert.deepEqual(bars[0], { time: 1000, open: 10, high: 12, low: 9, close: 11, volume: 50 });
});

test('normalizes Alpha Vantage FX and daily history schemas', () => {
  const fx = normalizeAlphaFx('EURUSD', { 'Realtime Currency Exchange Rate': { '5. Exchange Rate': '1.17', '6. Last Refreshed': '2026-08-28 20:00:00' } });
  assert.equal(fx.price, 1.17);
  const bars = normalizeAlphaDaily({ 'Time Series (Daily)': { '2026-08-28': { '1. open': '10', '2. high': '12', '3. low': '9', '4. close': '11', '5. volume': '1000' } } });
  assert.equal(bars[0].close, 11);
});

test('selects the most liquid usable option contract', () => {
  const quote = normalizeAlphaOptions('IBM_OPTIONS', { data: [{ bid: '1', ask: '1.2', volume: '10' }, { bid: '2', ask: '2.4', volume: '100' }] });
  assert.equal(quote.price, 2.2);
  assert.equal(quote.volume, 100);
});
