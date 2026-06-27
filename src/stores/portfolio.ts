import { atom } from 'nanostores';
import type { Holding } from '../types';

const isBrowser = typeof window !== 'undefined';

export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'AAPL', shares: 25, avgCost: 175.50, platform: 'Groww', companyName: 'Apple Inc.' },
  { symbol: 'NVDA', shares: 12, avgCost: 650.00, platform: 'Vested', companyName: 'NVIDIA Corporation' },
  { symbol: 'RELIANCE.NS', shares: 45, avgCost: 2820.00, platform: 'Zerodha', companyName: 'Reliance Industries Ltd.' },
  { symbol: 'TCS.NS', shares: 15, avgCost: 3910.00, platform: 'Zerodha', companyName: 'Tata Consultancy Services Ltd.' },
  { symbol: 'TSLA', shares: 20, avgCost: 188.40, platform: 'Groww', companyName: 'Tesla Inc.' }
];

function loadInitialHoldings(): Holding[] {
  if (!isBrowser) return [];
  try {
    const saved = localStorage.getItem('portfolio_holdings');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load portfolio holdings from localStorage', e);
  }
  // Default to pre-seeded demo data on fresh load
  return MOCK_HOLDINGS;
}

export const portfolioStore = atom<Holding[]>(loadInitialHoldings());

function saveHoldings(holdings: Holding[]) {
  if (isBrowser) {
    try {
      localStorage.setItem('portfolio_holdings', JSON.stringify(holdings));
    } catch (e) {
      console.error('Failed to save holdings to localStorage', e);
    }
  }
}

export function addHolding(holding: Holding) {
  const current = portfolioStore.get();
  // Check if ticker already exists on same platform to merge shares
  const existingIndex = current.findIndex(
    h => h.symbol.toUpperCase() === holding.symbol.toUpperCase() && 
         h.platform.trim().toLowerCase() === holding.platform.trim().toLowerCase()
  );
  
  let next: Holding[];
  if (existingIndex > -1) {
    next = [...current];
    const match = next[existingIndex];
    const totalShares = match.shares + holding.shares;
    const avgCost = ((match.shares * match.avgCost) + (holding.shares * holding.avgCost)) / totalShares;
    next[existingIndex] = {
      ...match,
      shares: totalShares,
      avgCost
    };
  } else {
    next = [...current, holding];
  }
  
  portfolioStore.set(next);
  saveHoldings(next);
}

export function deleteHolding(symbol: string, platform: string) {
  const current = portfolioStore.get();
  const next = current.filter(
    h => !(h.symbol.toUpperCase() === symbol.toUpperCase() && 
           h.platform.toLowerCase() === platform.toLowerCase())
  );
  portfolioStore.set(next);
  saveHoldings(next);
}

export function clearHoldings() {
  portfolioStore.set([]);
  saveHoldings([]);
}

export function importHoldings(newHoldings: Holding[], action: 'merge' | 'overwrite') {
  if (action === 'overwrite') {
    portfolioStore.set(newHoldings);
    saveHoldings(newHoldings);
  } else {
    // Merge holdings
    const current = [...portfolioStore.get()];
    newHoldings.forEach(nh => {
      const matchIndex = current.findIndex(
        ch => ch.symbol.toUpperCase() === nh.symbol.toUpperCase() &&
             ch.platform.trim().toLowerCase() === nh.platform.trim().toLowerCase()
      );
      if (matchIndex > -1) {
        const match = current[matchIndex];
        const totalShares = match.shares + nh.shares;
        const avgCost = ((match.shares * match.avgCost) + (nh.shares * nh.avgCost)) / totalShares;
        current[matchIndex] = {
          ...match,
          shares: totalShares,
          avgCost
        };
      } else {
        current.push(nh);
      }
    });
    portfolioStore.set(current);
    saveHoldings(current);
  }
}
