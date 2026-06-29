import { atom } from 'nanostores';
import type { PriceTick } from '../types';
import { settingsStore } from './settings';
import { MockMarketDataProvider } from '../lib/market/mockProvider';
import { YahooFinanceProvider } from '../lib/market/yahooProvider';
import { GoogleFinanceProvider } from '../lib/market/googleProvider';

// Helper to load cached prices
const loadCachedPrices = (): Record<string, PriceTick> => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('cached_prices');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('Failed to load cached prices', e);
    }
  }
  return {};
};

// Price ticks registry initialized with cache
export const priceStore = atom<Record<string, PriceTick>>(loadCachedPrices());
// Metadata stores
export const lastUpdatedStore = atom<Date | null>(null);
export const isPollingStore = atom<boolean>(false);

// Active unsubscriber function
let activeUnsubscribe: (() => void) | null = null;
let currentTickers: string[] = [];

// Get appropriate provider from settings
function getProvider(providerId: string) {
  if (providerId === 'google') return GoogleFinanceProvider;
  if (providerId === 'yahoo') return YahooFinanceProvider;
  return MockMarketDataProvider;
}

export function startPriceSubscription(portfolioStore: any) {
  if (typeof window === 'undefined') return;

  const runSubscription = () => {
    // Stop any active subscriptions first
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }

    const holdings = portfolioStore.get();
    const settings = settingsStore.get();
    
    // Extract unique tickers
    const tickers = Array.from(new Set(holdings.map(h => h.symbol.toUpperCase())))
      .filter(t => t.trim().length > 0);
    
    currentTickers = tickers;
    
    if (tickers.length === 0) {
      isPollingStore.set(false);
      return;
    }

    const provider = getProvider(settings.provider);
    const intervalMs = settings.pollingFreq * 1000;
    
    isPollingStore.set(true);
    
    activeUnsubscribe = provider.subscribePrices(
      tickers,
      (updates) => {
        const currentPrices = { ...priceStore.get() };
        
        Object.entries(updates).forEach(([symbol, tick]) => {
          const prevTick = currentPrices[symbol];
          currentPrices[symbol] = {
            symbol,
            price: tick.price ?? prevTick?.price ?? 0,
            change24h: tick.change24h ?? prevTick?.change24h ?? 0,
            sparkline: tick.sparkline ?? prevTick?.sparkline ?? [],
          };
        });
        
        priceStore.set(currentPrices);
        lastUpdatedStore.set(new Date());
        
        // Save to cache
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('cached_prices', JSON.stringify(currentPrices));
          } catch (e) {
            console.error('Failed to cache prices', e);
          }
        }
      },
      intervalMs
    );
  };

  // Run subscription
  runSubscription();

  // Re-run if holdings, provider, or frequency change
  const unsubPortfolio = portfolioStore.listen(() => {
    // Only re-run if tickers list actually changed
    const holdings = portfolioStore.get();
    const newTickers = Array.from(new Set(holdings.map(h => h.symbol.toUpperCase())))
      .filter(t => t.trim().length > 0);
    
    const hasChanged = newTickers.length !== currentTickers.length || 
      newTickers.some((t, i) => t !== currentTickers[i]);
    
    if (hasChanged) {
      runSubscription();
    }
  });

  const unsubSettings = settingsStore.listen((settings, oldSettings) => {
    if (
      settings.provider !== oldSettings?.provider ||
      settings.pollingFreq !== oldSettings?.pollingFreq
    ) {
      runSubscription();
    }
  });

  // Handle Tab Visibility changes (pause polling when hidden)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (activeUnsubscribe) {
        activeUnsubscribe();
        activeUnsubscribe = null;
        isPollingStore.set(false);
      }
    } else {
      // Tab became visible, restart
      runSubscription();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return unsubscribe to clean up listeners
  return () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
    }
    unsubPortfolio();
    unsubSettings();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
