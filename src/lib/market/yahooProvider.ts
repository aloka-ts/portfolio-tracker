import type { MarketDataProvider } from './types';
import type { PriceTick } from '../../types';
import { MockMarketDataProvider, STOCK_REGISTRY } from './mockProvider';

export const YahooFinanceProvider: MarketDataProvider = {
  id: 'yahoo',
  name: 'Yahoo Finance Feed (CORS Proxy)',
  
  async fetchPrices(symbols: string[]): Promise<Record<string, Partial<PriceTick>>> {
    const results: Record<string, Partial<PriceTick>> = {};
    const fallbacks: string[] = [];
    
    // We batch queries if possible, but Yahoo Finance v8 chart API fetches one-by-one.
    // So we run them in parallel with a Promise.all wrapper.
    await Promise.all(
      symbols.map(async (sym) => {
        const cleanSym = sym.trim().toUpperCase();
        try {
          // Use allorigins.win as CORS proxy
          const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSym}?interval=15m&range=1d`;
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
          
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error('Proxy error');
          
          const data = await response.json();
          const parsed = JSON.parse(data.contents);
          
          const chartResult = parsed.chart?.result?.[0];
          if (!chartResult) throw new Error('Invalid Yahoo response structure');
          
          const price = chartResult.meta?.regularMarketPrice;
          const prevClose = chartResult.meta?.previousClose || price;
          
          if (typeof price !== 'number') throw new Error('No price found');
          
          const change24h = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
          
          // Construct sparkline from closing prices
          const closes: number[] = chartResult.indicators?.quote?.[0]?.close || [];
          // Filter out nulls and take the last 8 ticks
          const validCloses = closes.filter((c: any) => typeof c === 'number') as number[];
          const sparkline = validCloses.length > 0 ? validCloses.slice(-8) : [prevClose, price];
          
          results[sym] = {
            symbol: sym,
            price,
            change24h,
            sparkline,
          };
        } catch (e) {
          // Queue for fallback
          fallbacks.push(sym);
        }
      })
    );
    
    // Fall back to Mock Provider for any failed requests
    if (fallbacks.length > 0) {
      const mockPrices = await MockMarketDataProvider.fetchPrices(fallbacks);
      Object.assign(results, mockPrices);
    }
    
    return results;
  },
  
  subscribePrices(
    symbols: string[],
    callback: (prices: Record<string, Partial<PriceTick>>) => void,
    intervalMs: number
  ): () => void {
    // Immediate fetch
    this.fetchPrices(symbols).then(callback);
    
    // Set up polling interval since WebSockets are not available for Yahoo Finance standard proxy
    const interval = setInterval(async () => {
      const updates = await this.fetchPrices(symbols);
      callback(updates);
    }, intervalMs);
    
    return () => clearInterval(interval);
  }
};
