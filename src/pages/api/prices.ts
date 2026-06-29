import type { APIRoute } from 'astro';

export const prerender = false;

const priceCache: Record<string, { price: number; change24h: number; timestamp: number }> = {};
const CACHE_TTL = 0; // Disable cache to force fresh fetches

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

  const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=15m&range=1d`;
  
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

  const targetUrl = `https://www.google.com/finance/quote/${googleSymbol}`;
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
      try {
        const fs = await import('fs');
        fs.appendFileSync('./tmp/debug_error.log', `${new Date().toISOString()} Redirected for ${symbol} (mapped: ${googleSymbol})\n`);
      } catch (e) {}
      return null;
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
      try {
        const fs = await import('fs');
        fs.appendFileSync('./tmp/debug_error.log', `${new Date().toISOString()} SymbolPos not found for ${symbol} (mapped: ${googleSymbol})\n`);
        fs.writeFileSync('./tmp/debug_error.html', html);
      } catch (e) {}
      return null;
    }

    let priceMatch = html.match(/class="[^"]*fxKbKc[^"]*"[^>]*>(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?<\/span>/i);
    if (!priceMatch) {
      priceMatch = html.match(/class="[^"]*fxKbKc[^"]*"[^>]*>([^<]+)</i);
    }
    
    // Fallback: search around symbolPos
    if (!priceMatch && symbolPos !== -1) {
      const priceIndex = html.indexOf('jsname="Pdsbrc"', symbolPos);
      if (priceIndex !== -1) {
        const priceHtmlSegment = html.substring(priceIndex - 50, priceIndex + 300);
        priceMatch = priceHtmlSegment.match(/jsname="Pdsbrc"[^>]*>(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?<\/span>/i);
      }
      if (!priceMatch) {
        const startSearch = Math.max(0, symbolPos - 10000);
        const endSearch = Math.min(html.length, symbolPos + 15000);
        const searchSegment = html.substring(startSearch, endSearch);
        priceMatch = searchSegment.match(/class="[^"]*(?:fxKbKc|YMlKec)[^"]*"[^>]*>([^<]+)</i);
      }
    }
    
    if (!priceMatch) {
      const titleMatch = html.match(/<title>[^<]*?(?:US\$|₹|\$)\s*([\d,.]+)/i);
      if (titleMatch) {
        priceMatch = [null, titleMatch[1]];
      }
    }

    if (!priceMatch) {
      try {
        const fs = await import('fs');
        fs.appendFileSync('./tmp/debug_error.log', `${new Date().toISOString()} PriceMatch not found for ${symbol} (mapped: ${googleSymbol}) symbolPos: ${symbolPos}\n`);
        fs.writeFileSync('./tmp/debug_error.html', html);
      } catch (e) {}
    }

    if (priceMatch) {
      const parsedPrice = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
      if (isNaN(parsedPrice)) return null;

      let change24h = 0;
      
      const prevCloseMatch = html.substring(Math.max(0, symbolPos - 10000), Math.min(html.length, symbolPos + 25000)).match(/(?:Previous|Prev)\s+close[\s\S]*?class="[^"]*P6K39c[^"]*"[^>]*>([^<]+)</i);
      if (prevCloseMatch) {
        const previousClose = parseFloat(prevCloseMatch[1].replace(/[^0-9.]/g, ''));
        if (previousClose > 0) {
          change24h = ((parsedPrice - previousClose) / previousClose) * 100;
        }
      }
      
      if (change24h === 0) {
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
            }
          }
        }
      }
      
      if (change24h === 0) {
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
    try {
      const fs = await import('fs');
      fs.appendFileSync('./tmp/debug_error.log', `${new Date().toISOString()} Fetch error for ${symbol} (mapped: ${googleSymbol}): ${err.message || err}\n`);
    } catch (e) {}
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const symbols = url.searchParams.get('symbols')?.split(',') || [];
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
          // Default: Google, fallback to Yahoo
          priceData = await fetchGooglePrice(symbol);
          if (!priceData) {
            priceData = await fetchYahooPrice(symbol);
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
  
  // 3. Log results to debug log
  try {
    const fs = await import('fs');
    fs.appendFileSync('./tmp/debug_api.log', JSON.stringify({
      timestamp: new Date().toISOString(),
      provider,
      requestedCount: symbols.length,
      fetchedCount: symbolsToFetch.length,
      resultsSummary: Object.keys(results).map(s => `${s}:${results[s].price}`)
    }) + '\n');
  } catch (err) {}
  
  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
};
