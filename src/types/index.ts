export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
  platform: string;
  dateAcquired?: string;
  companyName?: string;
}

export interface PriceTick {
  symbol: string;
  price: number;
  change24h: number; // percentage, e.g., +1.42
  sparkline: number[]; // relative price ticks (typically 7-10 data points)
}

export interface UserSettings {
  currency: 'USD' | 'INR' | 'EUR' | 'GBP';
  decimals: number;
  colorblind: boolean;
  density: 'compact' | 'comfortable';
  provider: 'mock' | 'yahoo' | 'google';
  pollingFreq: number; // in seconds, e.g. 3, 5, 30
}

export interface AIInsight {
  id: string;
  type: 'risk' | 'rebalance' | 'dividend' | 'mover';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success';
}

export interface PlatformStat {
  platform: string;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  topHoldingSymbol: string;
  topHoldingValue: number;
}
