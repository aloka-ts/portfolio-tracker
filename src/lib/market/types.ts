import type { PriceTick } from '../../types';

export interface MarketDataProvider {
  id: string;
  name: string;
  fetchPrices(symbols: string[]): Promise<Record<string, Partial<PriceTick>>>;
  subscribePrices(
    symbols: string[],
    callback: (prices: Record<string, Partial<PriceTick>>) => void,
    intervalMs: number
  ): () => void; // returns unsubscribe function
}
