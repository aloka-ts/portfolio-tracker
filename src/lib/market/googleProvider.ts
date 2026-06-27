import type { MarketDataProvider } from './types';
import type { PriceTick } from '../../types';
import { MockMarketDataProvider, STOCK_REGISTRY } from './mockProvider';

export const GoogleFinanceProvider: MarketDataProvider = {
  id: 'google',
  name: 'Google Finance Feed',
  
  async fetchPrices(symbols: string[]): Promise<Record<string, Partial<PriceTick>>> {
    const results: Record<string, Partial<PriceTick>> = {};
    const fallbacks: string[] = [];
    
    // 1. Try fetching via local Astro API endpoint
    try {
      const response = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(','))}&provider=google`);
      if (response.ok) {
        const data = await response.json();
        Object.keys(data).forEach(sym => {
          results[sym] = {
            symbol: sym,
            price: data[sym].price,
            change24h: data[sym].change24h,
            // Google Finance page scraping does not return sparklines easily,
            // so we generate a mock sparkline for visual appeal.
            sparkline: [data[sym].price * 0.98, data[sym].price * 1.01, data[sym].price * 0.99, data[sym].price]
          };
        });
      }
    } catch (e) {
      console.warn('Local prices API failed, will scrape client-side:', e);
    }
    
    // 2. Fall back to client-side CORS proxy scrape for any symbols not successfully returned by the API
    const missingSymbols = symbols.filter(sym => !results[sym]);
     for (const sym of missingSymbols) {
          try {
            let googleSymbol = sym.trim().toUpperCase();
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
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('Proxy error');
            const html = await res.text();
            
            // Parse redirect check (similar to server-side)
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

            // Find localized position
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

            if (symbolPos === -1 || isRedirected) {
              throw new Error('Symbol not found or redirected');
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
            
            if (!priceMatch) throw new Error('Could not find price element');
            
            const price = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
            
            let change24h = 0;
            
            // Try to find the Previous Close stat and calculate the exact percentage change
            const prevCloseMatch = html.substring(Math.max(0, symbolPos - 10000), Math.min(html.length, symbolPos + 25000)).match(/(?:Previous|Prev)\s+close[\s\S]*?class="[^"]*P6K39c[^"]*"[^>]*>([^<]+)</i);
            if (prevCloseMatch) {
              const previousClose = parseFloat(prevCloseMatch[1].replace(/[^0-9.]/g, ''));
              if (previousClose > 0) {
                change24h = ((price - previousClose) / previousClose) * 100;
              }
            }
            
            // Fallback 1: Use the new jsname="vY9t3b" daily change percent element
            if (change24h === 0) {
              let changeMatchIndex = html.indexOf('jsname="vY9t3b"', symbolPos);
              if (changeMatchIndex === -1) {
                changeMatchIndex = html.indexOf('jsname="vY9t3b"');
              }
              if (changeMatchIndex !== -1) {
                const changeHtmlSegment = html.substring(changeMatchIndex - 50, changeMatchIndex + 500);
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
            
            // Fallback 2: Old JwB6zf daily percentage change scraping
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
            
            results[sym] = {
              symbol: sym,
              price,
              change24h,
              sparkline: [price * 0.98, price * 1.01, price * 0.99, price]
            };
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (err) {
            fallbacks.push(sym);
          }
        }
    
    // 3. Fall back to Mock Provider for any completely failed symbols (seeded symbols only)
    const seededFallbacks = fallbacks.filter(sym => STOCK_REGISTRY[sym.trim().toUpperCase()]);
    if (seededFallbacks.length > 0) {
      const mockPrices = await MockMarketDataProvider.fetchPrices(seededFallbacks);
      Object.assign(results, mockPrices);
    }
    
    return results;
  },
  
  subscribePrices(
    symbols: string[],
    callback: (prices: Record<string, Partial<PriceTick>>) => void,
    intervalMs: number
  ): () => void {
    // Run initial fetch immediately
    this.fetchPrices(symbols).then(callback);
    
    // Set up polling interval
    const interval = setInterval(async () => {
      const updates = await this.fetchPrices(symbols);
      callback(updates);
    }, intervalMs);
    
    return () => clearInterval(interval);
  }
};
