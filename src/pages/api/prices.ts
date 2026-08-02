import type { APIRoute } from 'astro';
import { parseNavSeriesPoints } from '../../lib/market/mfHistory';

export const prerender = false;

const priceCache: Record<string, { price: number; change24h: number; timestamp: number }> = {};
// Server-side cache: shields Google/Yahoo from per-visitor request storms and
// protects the egress IP's reputation. 10s still feels live on a 5s poll.
const CACHE_TTL = 10_000;

// Structured debug logging to stdout, enabled only with DEBUG_SCRAPE=1.
// Never write scraped pages or diagnostics to the filesystem — production
// runs with a read-only root FS and dumped pages leak scrape internals.
const DEBUG_SCRAPE = process.env.DEBUG_SCRAPE === '1';
function debugLog(message: string) {
  if (DEBUG_SCRAPE) console.error(`[prices] ${message}`);
}

// Whitelist ticker charset ('.NS', '^NSEI', 'BTC-USD', 'GVT&D.NS', MUTF codes)
const SYMBOL_RE = /^[A-Za-z0-9.^:&_-]{1,25}$/;

// Bare crypto tickers (e.g. BTC) must be quoted as a USD pair (BTC-USD), or the
// scrapers resolve them to an unrelated equity and return a junk price.
const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC']);
function isCrypto(symbol: string): boolean {
  return CRYPTO_TICKERS.has(symbol.trim().toUpperCase());
}

function isIndianStock(symbol: string): boolean {
  const s = symbol.toUpperCase().trim();
  const usSymbols = new Set(['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX', 'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC']);
  return !usSymbols.has(s);
}

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change24h: number } | null> {
  const cleanSym = symbol.trim().toUpperCase();
  let yahooSym = isCrypto(cleanSym) ? `${cleanSym}-USD` : cleanSym;
  
  if (isIndianStock(cleanSym) && !yahooSym.startsWith('^') && !yahooSym.endsWith('.NS') && !yahooSym.endsWith('.BO') && !yahooSym.includes('_')) {
    yahooSym = `${yahooSym}.NS`;
  }

  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=15m&range=1d`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

  try {
    const res = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    
    const data = await res.json();
    const chartResult = data.chart?.result?.[0];
    const price = chartResult?.meta?.regularMarketPrice;
    const prevClose = chartResult?.meta?.previousClose || price;
    
    if (typeof price === 'number') {
      const change24h = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      return { price, change24h };
    }
  } catch (e) {
    // Silent fail for fallback
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

// Google's mutual fund pages render placeholder "0.00%" day change (and a
// previous close equal to the NAV) in the no-JS variant served to fetch().
// Take the last two points of the embedded NAV series (see lib/market/mfHistory).
function parseNavSeries(html: string): { price: number; change24h: number } | null {
  const points = parseNavSeriesPoints(html);
  if (points.length < 2) return null;
  const last = points[points.length - 1].nav;
  const prev = points[points.length - 2].nav;
  if (!(last > 0) || !(prev > 0)) return null;
  return { price: last, change24h: ((last - prev) / prev) * 100 };
}

async function fetchGooglePrice(symbol: string): Promise<{ price: number; change24h: number } | null> {
  // Google Finance has no reliable quote page for bare crypto tickers; let the
  // caller fall through to Yahoo, which handles the BTC-USD pair correctly.
  if (isCrypto(symbol)) return null;

  let googleSymbol = symbol.trim().toUpperCase();

  if (isIndianStock(googleSymbol) && !googleSymbol.startsWith('^') && !googleSymbol.includes(':') && !googleSymbol.endsWith('.NS') && !googleSymbol.endsWith('.BO') && !googleSymbol.includes('_')) {
    googleSymbol = `${googleSymbol}:NSE`;
  }

  // Map common symbols to exchange formats
  if (googleSymbol.endsWith('.NS')) {
    googleSymbol = googleSymbol.replace('.NS', ':NSE');
  } else if (googleSymbol.endsWith('.BO')) {
    googleSymbol = googleSymbol.replace('.BO', ':BSE');
  } else if (googleSymbol.includes('_') && !googleSymbol.includes(':')) {
    googleSymbol = `${googleSymbol}:MUTF_IN`;
  } else if (!googleSymbol.includes(':')) {
    const usTechTickers = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX'];
    if (usTechTickers.includes(googleSymbol)) {
      googleSymbol = `${googleSymbol}:NASDAQ`;
    }
  }

  const targetUrl = `https://www.google.com/finance/quote/${encodeURIComponent(googleSymbol)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const html = await res.text();
    
    let isRedirected = false;
    const canonicalIndex = html.indexOf('rel="canonical"');
    if (canonicalIndex !== -1) {
      const canonicalSegment = html.substring(Math.max(0, canonicalIndex - 200), Math.min(html.length, canonicalIndex + 500));
      const canonicalMatch = canonicalSegment.match(/href="([^"]+)"/i);
      if (canonicalMatch) {
        const canonicalUrl = canonicalMatch[1];
        const symbolTicker = googleSymbol.split(':')[0].split('.')[0];
        const decodedCanonicalUrl = decodeURIComponent(canonicalUrl).toUpperCase();
        if (!decodedCanonicalUrl.includes(symbolTicker)) {
          isRedirected = true;
        }
      }
    }

    if (isRedirected) {
      debugLog(`redirected for ${symbol} (mapped: ${googleSymbol})`);
      return null;
    }

    // Mutual funds: the embedded NAV series is the only reliable source of
    // day change on these pages — prefer it over the class-based scraping.
    if (googleSymbol.endsWith(':MUTF_IN')) {
      const nav = parseNavSeries(html);
      if (nav) return nav;
    }

    let symbolPos = html.indexOf(`title="${googleSymbol}"`);
    if (symbolPos === -1) {
      symbolPos = html.indexOf(`title="${googleSymbol.replace('&', '&amp;')}"`);
    }
    if (symbolPos === -1) {
      symbolPos = html.indexOf(`data-entity-label="${googleSymbol}"`);
    }
    if (symbolPos === -1) {
      symbolPos = html.indexOf(`data-entity-label="${googleSymbol.replace('&', '&amp;')}"`);
    }
    if (symbolPos === -1) {
      symbolPos = html.indexOf(`/quote/${googleSymbol}`);
    }
    if (symbolPos === -1) {
      symbolPos = html.indexOf(`/quote/${googleSymbol.replace('&', '&amp;')}`);
    }

    if (symbolPos === -1) {
      debugLog(`symbol position not found for ${symbol} (mapped: ${googleSymbol})`);
      return null;
    }

    let priceMatch = null;
    let matchedText = '';

    // 1. Search locally around symbolPos first (to avoid top marquee indices)
    if (symbolPos !== -1) {
      const startSearch = Math.max(0, symbolPos - 2000);
      const endSearch = Math.min(html.length, symbolPos + 15000);
      const localHtml = html.substring(startSearch, endSearch);
      
      priceMatch = localHtml.match(/class="[^"]*fxKbKc[^"]*"[^>]*>(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?<\/span>/i);
      if (!priceMatch) {
        priceMatch = localHtml.match(/class="[^"]*fxKbKc[^"]*"[^>]*>([^<]+)</i);
      }
      if (priceMatch) {
        matchedText = priceMatch[0];
      }
    }

    // 2. Global search fallback if local search fails
    if (!priceMatch) {
      priceMatch = html.match(/class="[^"]*fxKbKc[^"]*"[^>]*>(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?<\/span>/i);
      if (!priceMatch) {
        priceMatch = html.match(/class="[^"]*fxKbKc[^"]*"[^>]*>([^<]+)</i);
      }
      if (priceMatch) {
        matchedText = priceMatch[0];
      }
    }

    // 3. Fallback: jsname="Pdsbrc" or YMlKec near symbolPos
    if (!priceMatch && symbolPos !== -1) {
      const priceIndex = html.indexOf('jsname="Pdsbrc"', symbolPos);
      if (priceIndex !== -1) {
        const priceHtmlSegment = html.substring(priceIndex - 50, priceIndex + 300);
        priceMatch = priceHtmlSegment.match(/jsname="Pdsbrc"[^>]*>(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?<\/span>/i);
      }
      if (!priceMatch) {
        const startSearch = Math.max(0, symbolPos - 5000);
        const endSearch = Math.min(html.length, symbolPos + 15000);
        const searchSegment = html.substring(startSearch, endSearch);
        priceMatch = searchSegment.match(/class="[^"]*(?:fxKbKc|YMlKec)[^"]*"[^>]*>([^<]+)</i);
      }
      if (priceMatch) {
        matchedText = priceMatch[0];
      }
    }
    
    // 4. Title fallback
    if (!priceMatch) {
      const titleMatch = html.match(/<title>[^<]*?(?:US\$|₹|\$)\s*([\d,.]+)/i);
      if (titleMatch) {
        priceMatch = [null, titleMatch[1]];
        matchedText = titleMatch[0];
      }
    }

    if (!priceMatch) {
      debugLog(`price not found for ${symbol} (mapped: ${googleSymbol}) symbolPos: ${symbolPos}`);
    }

    if (priceMatch) {
      const parsedPrice = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
      if (isNaN(parsedPrice)) return null;

      let change24h = 0;
      let changeFound = false;

      // 1. Look for percentage change directly after the price element (within 3000 chars)
      if (matchedText) {
        const priceIndex = html.indexOf(matchedText);
        if (priceIndex !== -1) {
          const afterPriceHtml = html.substring(priceIndex, priceIndex + 3000);
          const changeMatch = afterPriceHtml.match(/class="[^"]*(?:JwB6zf|ougHge|ymyBi)[^"]*"[^>]*>([\s\S]*?)([-+0-9.]+)%/i);
          if (changeMatch) {
            change24h = parseFloat(changeMatch[2]);
            const isNegative = /class="[^"]*(?:P2Luy|Ebnabc|DnMTof|ymyBi)[^"]*"/i.test(changeMatch[0]) || changeMatch[1].includes('-');
            if (isNegative && change24h > 0) {
              change24h = -change24h;
            }
            changeFound = true;
          }
        }
      }

      // 2. Fallback: Previous close calculation
      if (!changeFound) {
        const prevCloseMatch = html.substring(Math.max(0, symbolPos - 10000), Math.min(html.length, symbolPos + 25000)).match(/(?:Previous|Prev)\s+close[\s\S]*?class="[^"]*P6K39c[^"]*"[^>]*>([^<]+)</i);
        if (prevCloseMatch) {
          const previousClose = parseFloat(prevCloseMatch[1].replace(/[^0-9.]/g, ''));
          if (previousClose > 0) {
            change24h = ((parsedPrice - previousClose) / previousClose) * 100;
            changeFound = true;
          }
        }
      }
      
      // 3. Fallback: jsname="vY9t3b"
      if (!changeFound) {
        let changeIndex = html.indexOf('jsname="vY9t3b"', symbolPos);
        if (changeIndex === -1) {
          changeIndex = html.indexOf('jsname="vY9t3b"');
        }
        if (changeIndex !== -1) {
          const changeHtmlSegment = html.substring(changeIndex - 50, changeIndex + 500);
          const changeMatch = changeHtmlSegment.match(/jsname="vY9t3b"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i);
          if (changeMatch) {
            const matchContent = changeMatch[1];
            const numMatch = matchContent.match(/([+-]?\d+(?:\.\d+)?)/);
            if (numMatch) {
              change24h = parseFloat(numMatch[1]);
              const isNegative = matchContent.includes('ymyBi') || matchContent.includes('P2Luy') || matchContent.includes('Ebnabc') || matchContent.includes('DnMTof') || matchContent.includes('-');
              if (isNegative && change24h > 0) {
                change24h = -change24h;
              }
              changeFound = true;
            }
          }
        }
      }
      
      // 4. Fallback: Search generic class around symbolPos
      if (!changeFound) {
        const searchIndex = symbolPos !== -1 ? Math.max(0, symbolPos - 5000) : 0;
        const afterHtml = html.substring(searchIndex, searchIndex + 15000);
        const changeMatch = afterHtml.match(/class="[^"]*(?:JwB6zf|ougHge|ymyBi)[^"]*"[^>]*>([\s\S]*?)([-+0-9.]+)%/i);
        if (changeMatch) {
          change24h = parseFloat(changeMatch[2]);
          const isNegative = /class="[^"]*(?:P2Luy|Ebnabc|DnMTof|ymyBi)[^"]*"/i.test(changeMatch[0]);
          if (isNegative && change24h > 0) {
            change24h = -change24h;
          }
        }
      }
      
      return { price: parsedPrice, change24h };
    }
  } catch (err: any) {
    debugLog(`fetch error for ${symbol} (mapped: ${googleSymbol}): ${err?.message || err}`);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  // Public endpoint that fans out to upstream scrapers: whitelist the ticker
  // charset and cap the batch size to prevent abuse.
  const symbols = (url.searchParams.get('symbols')?.split(',') || [])
    .map(s => s.trim())
    .filter(s => SYMBOL_RE.test(s))
    .slice(0, 50);
  const provider = url.searchParams.get('provider') || 'google';
  
  const results: Record<string, { symbol: string; price: number; change24h: number }> = {};
  
  const now = Date.now();
  const symbolsToFetch: string[] = [];
  
  // 1. Resolve cached symbols
  for (const symbol of symbols) {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) continue;
    const cached = priceCache[cleanSym];
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      results[symbol] = {
        symbol,
        price: cached.price,
        change24h: cached.change24h
      };
    } else {
      symbolsToFetch.push(symbol);
    }
  }
  
  // 2. Fetch fresh symbols in chunks of 5
  if (symbolsToFetch.length > 0) {
    const chunkSize = 5;
    for (let i = 0; i < symbolsToFetch.length; i += chunkSize) {
      const chunk = symbolsToFetch.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (symbol) => {
        let priceData = null;
        if (provider === 'yahoo') {
          priceData = await fetchYahooPrice(symbol);
        } else {
          // Default routing:
          // Mutual funds (contain '_') must go to Google Finance first.
          // Stocks and ETFs (no '_') go to Yahoo Finance first because Yahoo is a clean API and highly accurate.
          const isMutf = symbol.includes('_');
          if (isMutf) {
            priceData = await fetchGooglePrice(symbol);
            if (!priceData) {
              priceData = await fetchYahooPrice(symbol);
            }
          } else {
            priceData = await fetchYahooPrice(symbol);
            if (!priceData) {
              priceData = await fetchGooglePrice(symbol);
            }
          }
        }
        
        if (priceData) {
          priceCache[symbol.trim().toUpperCase()] = {
            price: priceData.price,
            change24h: priceData.change24h,
            timestamp: now
          };
          results[symbol] = {
            symbol,
            price: priceData.price,
            change24h: priceData.change24h
          };
        }
      }));
      
      // Add a small delay between chunks to prevent aggressive rate limiting
      if (i + chunkSize < symbolsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  debugLog(`provider=${provider} requested=${symbols.length} fetched=${symbolsToFetch.length}`);
  
  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
};
