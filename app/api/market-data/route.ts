import {
  MARKET_ALLOWLIST,
  normalizeAlphaQuote,
  normalizeAlphaFx,
  normalizeAlphaCommodity,
  normalizeAlphaOptions,
  normalizeAlphaDaily,
  normalizeBinanceKlines,
  normalizeBinanceTicker,
} from '@/lib/market-data';

export const runtime = 'edge';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    return await response.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') ?? 'BTCUSDT').toUpperCase();
  const mode = url.searchParams.get('mode') === 'history' ? 'history' : 'quote';
  const config = MARKET_ALLOWLIST[symbol];
  if (!config) return json({ error: 'Symbol is not in the server allowlist.' }, 400);

  try {
    if (config.provider === 'binance') {
      const base = 'https://data-api.binance.vision/api/v3';
      if (mode === 'history') {
        const payload = await fetchJson(`${base}/klines?symbol=${symbol}&interval=1d&limit=365`);
        return json({ symbol, market: config.market, provider: 'Binance', delayed: false, bars: normalizeBinanceKlines(payload) });
      }
      const payload = await fetchJson(`${base}/ticker/24hr?symbol=${symbol}`);
      return json({ quote: normalizeBinanceTicker(symbol, payload) });
    }

    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return json({ error: 'Alpha Vantage adapter is configured but locked until ALPHA_VANTAGE_API_KEY is set.', provider: 'Alpha Vantage' }, 503);
    const endpoint = new URL('https://www.alphavantage.co/query');
    endpoint.searchParams.set('apikey', apiKey);

    if (mode === 'history') {
      if (config.alphaFunction === 'GLOBAL_QUOTE') {
        endpoint.searchParams.set('function', 'TIME_SERIES_DAILY');
        endpoint.searchParams.set('symbol', symbol);
        endpoint.searchParams.set('outputsize', 'full');
      } else if (config.alphaFunction === 'CURRENCY_EXCHANGE_RATE') {
        endpoint.searchParams.set('function', 'FX_DAILY');
        endpoint.searchParams.set('from_symbol', symbol.slice(0, 3));
        endpoint.searchParams.set('to_symbol', symbol.slice(3));
        endpoint.searchParams.set('outputsize', 'full');
      } else {
        return json({ error: 'Historical OHLC backtesting is not supported for this instrument adapter.', provider: 'Alpha Vantage' }, 501);
      }
      const payload = await fetchJson(endpoint.toString());
      return json({ symbol, market: config.market, provider: 'Alpha Vantage', delayed: true, bars: normalizeAlphaDaily(payload) });
    }

    if (config.alphaFunction === 'GLOBAL_QUOTE') {
      endpoint.searchParams.set('function', 'GLOBAL_QUOTE');
      endpoint.searchParams.set('symbol', symbol);
      const payload = await fetchJson(endpoint.toString());
      return json({ quote: normalizeAlphaQuote(symbol, config.market, payload) });
    }
    if (config.alphaFunction === 'CURRENCY_EXCHANGE_RATE') {
      endpoint.searchParams.set('function', 'CURRENCY_EXCHANGE_RATE');
      endpoint.searchParams.set('from_currency', symbol.slice(0, 3));
      endpoint.searchParams.set('to_currency', symbol.slice(3));
      const payload = await fetchJson(endpoint.toString());
      return json({ quote: normalizeAlphaFx(symbol, payload) });
    }
    if (config.alphaFunction === 'WTI') {
      endpoint.searchParams.set('function', 'WTI');
      endpoint.searchParams.set('interval', 'daily');
      const payload = await fetchJson(endpoint.toString());
      return json({ quote: normalizeAlphaCommodity(symbol, payload) });
    }
    endpoint.searchParams.set('function', 'HISTORICAL_OPTIONS');
    endpoint.searchParams.set('symbol', symbol.replace('_OPTIONS', ''));
    const payload = await fetchJson(endpoint.toString());
    return json({ quote: normalizeAlphaOptions(symbol, payload) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Market provider request failed.' }, 502);
  }
}
