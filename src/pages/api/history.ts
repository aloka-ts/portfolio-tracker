import type { APIRoute } from 'astro';
import { fetchMfNavSeries } from '../../lib/market/mfHistory';

export const prerender = false;

// Historical closes for any symbol (holdings trend + benchmark overlays).
// Yahoo blocks CORS from the browser, so proxy server-side like /api/prices.
// Mutual funds (tickers with '_') have no Yahoo data; their NAV series is
// scraped from Google Finance instead (~1 month of daily points).

const cache: Record<string, { data: object; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1h — daily closes don't need fresher

// Supported ranges -> Yahoo chart params. 3y isn't a valid Yahoo range
// keyword, so it goes through period1/period2 instead.
const RANGES: Record<string, { range?: string; years?: number; interval: string }> = {
  '1d': { range: '1d', interval: '15m' },
  '5d': { range: '5d', interval: '60m' },
  '1mo': { range: '1mo', interval: '1d' },
  '3mo': { range: '3mo', interval: '1d' },
  '6mo': { range: '6mo', interval: '1d' },
  '1y': { range: '1y', interval: '1d' },
  '3y': { years: 3, interval: '1wk' },
};

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC']);
const US_TICKERS = new Set(['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX']);

// Same mapping rules as fetchYahooPrice in /api/prices
function toYahooSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (CRYPTO_TICKERS.has(s)) return `${s}-USD`;
  if (s.startsWith('^') || s.endsWith('.NS') || s.endsWith('.BO') || s.includes('_') || US_TICKERS.has(s)) {
    return s;
  }
  return `${s}.NS`;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase();
  const rangeKey = url.searchParams.get('range') || '1mo';
  // Public endpoint: whitelist ticker charset before it reaches upstream URLs
  if (!symbol || !/^[A-Z0-9.^:&_-]{1,25}$/.test(symbol)) {
    return new Response(JSON.stringify({ error: 'invalid symbol' }), { status: 400 });
  }
  const rangeCfg = RANGES[rangeKey] || RANGES['1mo'];

  const key = `${symbol}:${rangeKey}`;
  const now = Date.now();
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cache[key].data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let data: { symbol: string; timestamps: number[]; closes: (number | null)[] } = {
    symbol,
    timestamps: [],
    closes: [],
  };

  try {
    if (symbol.includes('_')) {
      // Mutual fund: Google-embedded NAV series, clipped to the window
      const points = await fetchMfNavSeries(symbol);
      const fromSec = rangeCfg.years
        ? now / 1000 - rangeCfg.years * 365 * 86400
        : now / 1000 - rangeDaysApprox(rangeKey) * 86400;
      const clipped = points.filter((p) => p.t >= fromSec);
      // Never leak the full month into short windows — two points are enough
      // for the client to forward-fill a flat NAV segment
      const usable = clipped.length >= 2 ? clipped : points.slice(-2);
      data = {
        symbol,
        timestamps: usable.map((p) => p.t),
        closes: usable.map((p) => p.nav),
      };
    } else {
      const yahooSym = toYahooSymbol(symbol);
      const params = new URLSearchParams({ interval: rangeCfg.interval });
      if (rangeCfg.years) {
        params.set('period2', String(Math.floor(now / 1000)));
        params.set('period1', String(Math.floor(now / 1000) - rangeCfg.years * 365 * 86400));
      } else {
        params.set('range', rangeCfg.range!);
      }
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?${params}`
      );
      if (res.ok) {
        const json = await res.json();
        const result = json.chart?.result?.[0];
        data = {
          symbol,
          timestamps: result?.timestamp || [],
          closes: result?.indicators?.quote?.[0]?.close || [],
        };
      }
    }
    if (data.timestamps.length > 0) {
      cache[key] = { data, timestamp: now };
    }
  } catch (e) {
    // Fall through with empty series; client treats it as "history unavailable"
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

function rangeDaysApprox(rangeKey: string): number {
  return { '1d': 2, '5d': 8, '1mo': 32, '3mo': 95, '6mo': 185, '1y': 370 }[rangeKey] ?? 32;
}
