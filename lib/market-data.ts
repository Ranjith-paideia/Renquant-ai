import type { Market } from './trading-engine';

export type MarketQuote = {
  symbol: string;
  market: Market;
  price: number;
  changePct: number;
  volume: number | null;
  timestamp: string;
  provider: 'Binance' | 'Alpha Vantage';
  delayed: boolean;
};

export type PriceBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketSymbol = {
  market: Market;
  provider: 'binance' | 'alpha';
  alphaFunction?: 'GLOBAL_QUOTE' | 'CURRENCY_EXCHANGE_RATE' | 'WTI' | 'HISTORICAL_OPTIONS';
};

export const MARKET_ALLOWLIST: Record<string, MarketSymbol> = {
  BTCUSDT: { market: 'Crypto', provider: 'binance' },
  ETHUSDT: { market: 'Crypto', provider: 'binance' },
  'RELIANCE.BSE': { market: 'Equity', provider: 'alpha', alphaFunction: 'GLOBAL_QUOTE' },
  IBM: { market: 'Equity', provider: 'alpha', alphaFunction: 'GLOBAL_QUOTE' },
  EURUSD: { market: 'Forex', provider: 'alpha', alphaFunction: 'CURRENCY_EXCHANGE_RATE' },
  WTI: { market: 'Futures', provider: 'alpha', alphaFunction: 'WTI' },
  IBM_OPTIONS: { market: 'Options', provider: 'alpha', alphaFunction: 'HISTORICAL_OPTIONS' },
};

function finite(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Market provider returned a non-numeric field.');
  return number;
}

export function normalizeBinanceTicker(symbol: string, payload: Record<string, unknown>): MarketQuote {
  return {
    symbol,
    market: 'Crypto',
    price: finite(payload.lastPrice),
    changePct: finite(payload.priceChangePercent),
    volume: finite(payload.quoteVolume),
    timestamp: new Date(finite(payload.closeTime)).toISOString(),
    provider: 'Binance',
    delayed: false,
  };
}

export function normalizeBinanceKlines(payload: unknown): PriceBar[] {
  if (!Array.isArray(payload)) throw new Error('Invalid Binance kline response.');
  return payload.map((row) => {
    if (!Array.isArray(row) || row.length < 6) throw new Error('Invalid Binance kline row.');
    return { time: finite(row[0]), open: finite(row[1]), high: finite(row[2]), low: finite(row[3]), close: finite(row[4]), volume: finite(row[5]) };
  });
}

export function normalizeAlphaQuote(symbol: string, market: Market, payload: Record<string, unknown>): MarketQuote {
  const quote = payload['Global Quote'] as Record<string, unknown> | undefined;
  const providerMessage = payload.Note ?? payload.Information;
  if (!quote) throw new Error(typeof providerMessage === 'string' ? providerMessage : 'Alpha Vantage quote unavailable.');
  return {
    symbol,
    market,
    price: finite(quote['05. price']),
    changePct: finite(String(quote['10. change percent']).replace('%', '')),
    volume: finite(quote['06. volume']),
    timestamp: new Date(`${String(quote['07. latest trading day'])}T00:00:00Z`).toISOString(),
    provider: 'Alpha Vantage',
    delayed: true,
  };
}

export function normalizeAlphaFx(symbol: string, payload: Record<string, unknown>): MarketQuote {
  const quote = payload['Realtime Currency Exchange Rate'] as Record<string, unknown> | undefined;
  const providerMessage = payload.Note ?? payload.Information;
  if (!quote) throw new Error(typeof providerMessage === 'string' ? providerMessage : 'Alpha Vantage FX quote unavailable.');
  return {
    symbol,
    market: 'Forex',
    price: finite(quote['5. Exchange Rate']),
    changePct: 0,
    volume: null,
    timestamp: new Date(String(quote['6. Last Refreshed'])).toISOString(),
    provider: 'Alpha Vantage',
    delayed: false,
  };
}

export function normalizeAlphaCommodity(symbol: string, payload: Record<string, unknown>): MarketQuote {
  const rows = payload.data;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Alpha Vantage commodity series unavailable.');
  const latest = rows.find((row) => row && typeof row === 'object' && Number.isFinite(Number((row as Record<string, unknown>).value))) as Record<string, unknown> | undefined;
  const previous = rows.find((row) => row !== latest && row && typeof row === 'object' && Number.isFinite(Number((row as Record<string, unknown>).value))) as Record<string, unknown> | undefined;
  if (!latest) throw new Error('Alpha Vantage commodity series has no numeric values.');
  const price = finite(latest.value);
  const previousPrice = previous ? finite(previous.value) : price;
  return { symbol, market: 'Futures', price, changePct: previousPrice ? (price / previousPrice - 1) * 100 : 0, volume: null, timestamp: new Date(`${String(latest.date)}T00:00:00Z`).toISOString(), provider: 'Alpha Vantage', delayed: true };
}

export function normalizeAlphaOptions(symbol: string, payload: Record<string, unknown>): MarketQuote {
  const rows = payload.data;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Alpha Vantage options chain unavailable.');
  const contracts = rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  const liquid = contracts.sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0))[0];
  const bid = Number(liquid.bid ?? 0);
  const ask = Number(liquid.ask ?? 0);
  const last = Number(liquid.last ?? liquid.mark ?? 0);
  const price = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Alpha Vantage options chain has no usable price.');
  return { symbol, market: 'Options', price, changePct: Number(liquid.percent_change ?? 0), volume: Number(liquid.volume ?? 0), timestamp: new Date().toISOString(), provider: 'Alpha Vantage', delayed: true };
}

export function normalizeAlphaDaily(payload: Record<string, unknown>): PriceBar[] {
  const series = (payload['Time Series (Daily)'] ?? payload['Time Series FX (Daily)']) as Record<string, Record<string, unknown>> | undefined;
  if (!series) throw new Error('Alpha Vantage daily history unavailable.');
  return Object.entries(series).map(([date, row]) => ({ time: Date.parse(`${date}T00:00:00Z`), open: finite(row['1. open']), high: finite(row['2. high']), low: finite(row['3. low']), close: finite(row['4. close']), volume: row['5. volume'] === undefined ? 0 : finite(row['5. volume']) })).sort((a, b) => a.time - b.time);
}
