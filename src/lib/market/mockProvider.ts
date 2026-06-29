import type { MarketDataProvider } from './types';
import type { PriceTick } from '../../types';

// Pre-seeded registry of common equities
export const STOCK_REGISTRY: Record<string, { name: string; basePrice: number; openPrice: number }> = {
  AAPL: { name: 'Apple Inc.', basePrice: 185.50, openPrice: 184.20 },
  TSLA: { name: 'Tesla Inc.', basePrice: 178.40, openPrice: 181.10 },
  MSFT: { name: 'Microsoft Corporation', basePrice: 420.30, openPrice: 418.00 },
  GOOGL: { name: 'Alphabet Inc.', basePrice: 172.50, openPrice: 173.80 },
  AMZN: { name: 'Amazon.com Inc.', basePrice: 180.20, openPrice: 178.90 },
  NVDA: { name: 'NVIDIA Corporation', basePrice: 875.00, openPrice: 862.00 },
  META: { name: 'Meta Platforms Inc.', basePrice: 505.00, openPrice: 512.30 },
  
  // Indian Stocks (NSE suffix)
  'RELIANCE.NS': { name: 'Reliance Industries Ltd.', basePrice: 2950.00, openPrice: 2930.00 },
  'TCS.NS': { name: 'Tata Consultancy Services Ltd.', basePrice: 3820.00, openPrice: 3850.00 },
  'INFY.NS': { name: 'Infosys Ltd.', basePrice: 1490.00, openPrice: 1510.00 },
  'HDFCBANK.NS': { name: 'HDFC Bank Ltd.', basePrice: 1450.00, openPrice: 1460.00 },
  'ICICIBANK.NS': { name: 'ICICI Bank Ltd.', basePrice: 1120.00, openPrice: 1110.00 },
  
  // Indian Stocks (BSE suffix)
  'RELIANCE.BO': { name: 'Reliance Industries Ltd.', basePrice: 2950.00, openPrice: 2930.00 },
  'TCS.BO': { name: 'Tata Consultancy Services Ltd.', basePrice: 3820.00, openPrice: 3850.00 },
};

// Global cache for dynamically generated symbols to keep prices consistent between calls
const dynamicRegistry: Record<string, { name: string; basePrice: number; openPrice: number; sparkline: number[] }> = {};

function getStockInfo(symbol: string): { name: string; price: number; openPrice: number; sparkline: number[] } | null {
  const cleanSym = symbol.trim().toUpperCase();
  
  // 1. Check pre-seeded registry
  if (STOCK_REGISTRY[cleanSym]) {
    const info = STOCK_REGISTRY[cleanSym];
    if (!dynamicRegistry[cleanSym]) {
      // Seed initial sparkline with historical noise
      const sparkline: number[] = [];
      let tempPrice = info.openPrice;
      for (let i = 0; i < 7; i++) {
        tempPrice = tempPrice * (1 + (Math.random() * 0.02 - 0.01));
        sparkline.push(tempPrice);
      }
      sparkline.push(info.basePrice);
      dynamicRegistry[cleanSym] = {
        name: info.name,
        basePrice: info.basePrice,
        openPrice: info.openPrice,
        sparkline,
      };
    }
    const current = dynamicRegistry[cleanSym];
    return {
      name: current.name,
      price: current.basePrice,
      openPrice: current.openPrice,
      sparkline: current.sparkline,
    };
  }
  
  // 2. Generate fallback config dynamically
  if (!dynamicRegistry[cleanSym]) {
    // Generate a random stable price and company name based on ticker characters
    const charCodeSum = cleanSym.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const generatedBase = 10 + (charCodeSum % 490); // $10 to $500
    const generatedOpen = generatedBase * (1 + (Math.random() * 0.04 - 0.02)); // +/- 2%
    const isIndian = cleanSym.endsWith('.NS') || cleanSym.endsWith('.BO');
    const displaySym = cleanSym.replace(/\.(NS|BO)$/, '');
    
    const name = `${displaySym} ${isIndian ? 'Limited' : 'Corp.'}`;
    const sparkline: number[] = [];
    let tempPrice = generatedOpen;
    for (let i = 0; i < 7; i++) {
      tempPrice = tempPrice * (1 + (Math.random() * 0.02 - 0.01));
      sparkline.push(tempPrice);
    }
    sparkline.push(generatedBase);
    
    dynamicRegistry[cleanSym] = {
      name,
      basePrice: generatedBase,
      openPrice: generatedOpen,
      sparkline,
    };
  }
  
  const current = dynamicRegistry[cleanSym];
  return {
    name: current.name,
    price: current.basePrice,
    openPrice: current.openPrice,
    sparkline: current.sparkline,
  };
}



export const MockMarketDataProvider: MarketDataProvider = {
  id: 'mock',
  name: 'Mock Price Feed (Real-time Walk)',
  
  async fetchPrices(symbols: string[]): Promise<Record<string, Partial<PriceTick>>> {
    const results: Record<string, Partial<PriceTick>> = {};
    symbols.forEach(sym => {
      const info = getStockInfo(sym);
      if (!info) return;
      const change24h = ((info.price - info.openPrice) / info.openPrice) * 100;
      results[sym] = {
        symbol: sym,
        price: info.price,
        change24h,
        sparkline: info.sparkline,
      };
    });
    return results;
  },
  
  subscribePrices(
    symbols: string[],
    callback: (prices: Record<string, Partial<PriceTick>>) => void,
    intervalMs: number
  ): () => void {
    // Run initial fetch immediately
    this.fetchPrices(symbols).then(callback);
    
    // Set up price ticker interval
    const interval = setInterval(() => {
      const updates: Record<string, Partial<PriceTick>> = {};
      let hasUpdates = false;
      
      symbols.forEach(sym => {
        const cleanSym = sym.trim().toUpperCase();
        
        const registryInfo = dynamicRegistry[cleanSym];
        if (registryInfo) {
          // Add a random walk tick fluctuation (+/- 0.15%)
          const fluctuation = (Math.random() * 0.003 - 0.0015);
          registryInfo.basePrice = registryInfo.basePrice * (1 + fluctuation);
          
          const newSparkline = [...registryInfo.sparkline.slice(1), registryInfo.basePrice];
          registryInfo.sparkline = newSparkline;
          
          const change24h = ((registryInfo.basePrice - registryInfo.openPrice) / registryInfo.openPrice) * 100;
          updates[sym] = {
            symbol: sym,
            price: registryInfo.basePrice,
            change24h,
            sparkline: newSparkline,
          };
          hasUpdates = true;
        }
      });
      
      if (hasUpdates) {
        callback(updates);
      }
    }, intervalMs);
    
    return () => clearInterval(interval);
  }
};
