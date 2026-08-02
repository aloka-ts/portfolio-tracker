// Server-side helpers for Indian mutual fund NAV data scraped from Google
// Finance. The no-JS page variant renders placeholder quote values, but the
// real daily NAV series ships in an embedded AF_initDataCallback block:
//   [[2026,7,1,18,null,null,null,[19800]],[90.3012,...],0]
// Used by /api/prices (day change) and /api/history (trend series).

export interface NavPoint {
  t: number; // unix seconds
  nav: number;
}

const NAV_TUPLE_RE = /\[\[(20\d{2}),(\d{1,2}),(\d{1,2}),\d{1,2}[^\[\]]*\[\d+\]\],\[(\d+(?:\.\d+)?),/g;

export function parseNavSeriesPoints(html: string): NavPoint[] {
  const points: NavPoint[] = [];
  const re = new RegExp(NAV_TUPLE_RE.source, 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    // NAVs are published end-of-day IST; ~12:30 UTC keeps the calendar date right
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 30) / 1000;
    points.push({ t, nav: parseFloat(m[4]) });
  }
  return points;
}

export async function fetchMfNavSeries(symbol: string): Promise<NavPoint[]> {
  const googleSymbol = `${symbol.trim().toUpperCase()}:MUTF_IN`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${encodeURIComponent(googleSymbol)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return [];
    return parseNavSeriesPoints(await res.text());
  } catch (e) {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
