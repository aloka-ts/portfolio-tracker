import { atom } from 'nanostores';
import type { Holding, Transaction } from '../types';
import { priceStore } from './prices';

const isBrowser = typeof window !== 'undefined';
export const EXCHANGE_RATE = 83.0; // USD to INR exchange rate

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 'tx-seed-1', ticker: 'AAPL', type: 'BUY', quantity: 25, price: 175.50, fees: 5, date: '2026-01-15', market: 'US', platform: 'Groww', category: 'Stocks' },
  { id: 'tx-seed-2', ticker: 'NVDA', type: 'BUY', quantity: 12, price: 650.00, fees: 10, date: '2026-02-10', market: 'US', platform: 'Vested', category: 'Stocks' },
  { id: 'tx-seed-3', ticker: 'RELIANCE.NS', type: 'BUY', quantity: 45, price: 2820.00, fees: 15, date: '2026-03-01', market: 'IN', platform: 'Zerodha', category: 'Stocks' },
  { id: 'tx-seed-4', ticker: 'TCS.NS', type: 'BUY', quantity: 15, price: 3910.00, fees: 12, date: '2026-03-15', market: 'IN', platform: 'Zerodha', category: 'Stocks' },
  { id: 'tx-seed-5', ticker: 'TSLA', type: 'BUY', quantity: 20, price: 188.40, fees: 8, date: '2026-04-05', market: 'US', platform: 'Groww', category: 'Stocks' },
  { id: 'tx-seed-6', ticker: 'AAPL', type: 'SELL', quantity: 10, price: 195.00, fees: 4, date: '2026-04-20', market: 'US', platform: 'Groww', category: 'Stocks' },
  { id: 'tx-seed-7', ticker: 'BTC', type: 'BUY', quantity: 0.15, price: 62000.00, fees: 25, date: '2026-05-01', market: 'US', platform: 'WazirX', category: 'Crypto' },
  { id: 'tx-seed-8', ticker: 'NIFTYBEES.NS', type: 'BUY', quantity: 150, price: 250.00, fees: 10, date: '2026-05-10', market: 'IN', platform: 'Zerodha', category: 'ETFs' },
  { id: 'tx-seed-9', ticker: 'PARA_PARI_FLEX_17J17OL', type: 'BUY', quantity: 500, price: 62.50, fees: 0, date: '2026-05-15', market: 'IN', platform: 'Groww', category: 'Mutual Funds' },
  { id: 'tx-seed-10', ticker: 'TSLA', type: 'SELL', quantity: 5, price: 170.00, fees: 3, date: '2026-05-25', market: 'US', platform: 'Groww', category: 'Stocks' },
  { id: 'tx-seed-11', ticker: 'ETH', type: 'BUY', quantity: 1.2, price: 3200.00, fees: 15, date: '2026-06-01', market: 'US', platform: 'WazirX', category: 'Crypto' }
];

// Helper to check if symbol is Indian stock
function isIndianStock(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s.endsWith('.NS') || 
         s.endsWith('.BO') || 
         s === 'PARA_PARI_FLEX_17J17OL' || 
         s.includes('_') ||
         s.includes('MUTUAL') ||
         s.includes('FUND');
}

// Helper to get company name
function getCompanyName(ticker: string): string {
  const t = ticker.toUpperCase().replace(/\.(NS|BO)$/, '');
  if (t === 'AAPL') return 'Apple Inc.';
  if (t === 'NVDA') return 'NVIDIA Corporation';
  if (t === 'TSLA') return 'Tesla Inc.';
  if (t === 'MSFT') return 'Microsoft Corp.';
  if (t === 'GOOGL') return 'Alphabet Inc.';
  if (t === 'AMZN') return 'Amazon.com Inc.';
  if (t === 'RELIANCE') return 'Reliance Industries Ltd.';
  if (t === 'TCS') return 'Tata Consultancy Services Ltd.';
  if (t === 'INFY') return 'Infosys Ltd.';
  if (t === 'HDFCBANK') return 'HDFC Bank Ltd.';
  if (t === 'ICICIBANK') return 'ICICI Bank Ltd.';
  if (t === 'TATAMOTORS') return 'Tata Motors Ltd.';
  if (t === 'BTC') return 'Bitcoin';
  if (t === 'ETH') return 'Ethereum';
  if (t === 'NIFTYBEES') return 'Nifty BeES ETF';
  if (t === 'PARA_PARI_FLEX_17J17OL') return 'Parag Parikh Flexi Cap Fund';
  return `${t} Corporation`;
}

// Load initial transactions
function loadInitialTransactions(): Transaction[] {
  if (!isBrowser) return [];
  try {
    const savedTxs = localStorage.getItem('portfolio_transactions');
    if (savedTxs !== null) {
      const txs = JSON.parse(savedTxs);
      // Migrate existing transactions to correct market if needed
      let migrated = false;
      const updatedTxs = txs.map((tx: any) => {
        const correctMarket = isIndianStock(tx.ticker) ? 'IN' : 'US';
        if (tx.market !== correctMarket) {
          migrated = true;
          return { ...tx, market: correctMarket };
        }
        return tx;
      });
      if (migrated) {
        localStorage.setItem('portfolio_transactions', JSON.stringify(updatedTxs));
      }
      return updatedTxs;
    }
    
    // Migration check: if old holdings exist, convert them to transactions
    const savedHoldings = localStorage.getItem('portfolio_holdings');
    if (savedHoldings !== null) {
      const holdings = JSON.parse(savedHoldings);
      if (Array.isArray(holdings) && holdings.length > 0) {
        const migrated: Transaction[] = holdings.map((h, idx) => ({
          id: `tx-migrated-${idx}-${Date.now()}`,
          ticker: h.symbol.toUpperCase(),
          type: 'BUY',
          quantity: h.shares,
          price: h.avgCost,
          fees: 0,
          date: h.dateAcquired || new Date().toISOString().split('T')[0],
          market: isIndianStock(h.symbol) ? 'IN' : 'US',
          platform: h.platform || 'Groww',
          category: h.category || (isIndianStock(h.symbol) ? 'Stocks' : 'Stocks')
        }));
        localStorage.setItem('portfolio_transactions', JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.error('Failed to load transactions', e);
  }
  
  // Default seed transactions
  return SEED_TRANSACTIONS;
}

// Active Stores
export const transactionsStore = atom<Transaction[]>(loadInitialTransactions());
export const portfolioStore = atom<Holding[]>([]);
export const platformFilterStore = atom<string>('ALL');

export interface CashBalances {
  USD: number;
  INR: number;
}

export const cashBalancesStore = atom<CashBalances>({ USD: 50000, INR: 1000000 });

// Save transactions to localStorage
function saveTransactions(txs: Transaction[]) {
  if (isBrowser) {
    try {
      localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
    } catch (e) {
      console.error('Failed to save transactions', e);
    }
  }
}

// Compute holdings and cash balances from transactions
export function recalculatePortfolio(txs: Transaction[]) {
  const holdingsMap: Record<string, {
    symbol: string;
    shares: number;
    totalCostBasis: number;
    avgCost: number;
    platform: string;
    dateAcquired: string;
    companyName: string;
    realizedPnL: number;
    market: 'US' | 'IN';
    category: string;
  }> = {};

  // Sort chronologically for accurate cost basis
  const sortedTxs = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Initialize cash
  let cashUSD = 50000;
  let cashINR = 1000000;

  const currentPrices = { ...priceStore.get() };
  let pricesChanged = false;

  for (const tx of sortedTxs) {
    const ticker = tx.ticker.toUpperCase();
    const key = `${ticker}-${tx.platform.trim().toLowerCase()}`;
    const totalAmount = tx.quantity * tx.price;
    const isUS = tx.market === 'US';

    // 1. Adjust Cash Balances
    if (tx.type === 'BUY') {
      if (isUS) {
        cashUSD -= (totalAmount + tx.fees);
      } else {
        cashINR -= (totalAmount + tx.fees);
      }
    } else {
      if (isUS) {
        cashUSD += (totalAmount - tx.fees);
      } else {
        cashINR += (totalAmount - tx.fees);
      }
    }

    // 2. Initialize price in priceStore if not present
    if (!currentPrices[ticker]) {
      currentPrices[ticker] = {
        symbol: ticker,
        price: tx.price,
        change24h: 0,
        sparkline: [tx.price]
      };
      pricesChanged = true;
    }

    // 3. Aggregate Holdings & Realized PnL
    if (!holdingsMap[key]) {
      // Determine category
      let category = tx.category;
      if (!category) {
        const s = ticker.toUpperCase();
        if (s.includes('BTC') || s.includes('ETH') || s.includes('USDT') || s.includes('CRYPTO')) {
          category = 'Crypto';
        } else if (s.includes('FUND') || s.includes('MUTUAL') || s === 'PARA_PARI_FLEX_17J17OL') {
          category = 'Mutual Funds';
        } else if (s.includes('ETF') || s.includes('INDEX') || s.includes('BEES')) {
          category = 'ETFs';
        } else {
          category = 'Stocks';
        }
      }

      holdingsMap[key] = {
        symbol: ticker,
        shares: 0,
        totalCostBasis: 0,
        avgCost: 0,
        platform: tx.platform,
        dateAcquired: tx.date,
        companyName: getCompanyName(ticker),
        realizedPnL: 0,
        market: tx.market,
        category: category
      };
    }

    const h = holdingsMap[key];

    if (tx.type === 'BUY') {
      h.shares += tx.quantity;
      h.totalCostBasis += (totalAmount + tx.fees);
      h.avgCost = h.shares > 0 ? (h.totalCostBasis / h.shares) : 0;
    } else if (tx.type === 'SELL') {
      if (h.shares >= tx.quantity) {
        const currentAvgPrice = h.avgCost;
        const sellRevenue = totalAmount - tx.fees;
        const costBasisOfSold = tx.quantity * currentAvgPrice;
        
        h.realizedPnL += (sellRevenue - costBasisOfSold);
        h.shares -= tx.quantity;
        h.totalCostBasis = h.shares * currentAvgPrice;
        h.avgCost = h.shares > 0 ? currentAvgPrice : 0;
      }
    }
  }

  // Filter out empty holdings
  const finalHoldings: Holding[] = Object.values(holdingsMap)
    .filter(h => h.shares > 0)
    .map(h => ({
      symbol: h.symbol,
      shares: h.shares,
      avgCost: h.avgCost,
      platform: h.platform,
      dateAcquired: h.dateAcquired,
      companyName: h.companyName,
      realizedPnL: h.realizedPnL,
      market: h.market,
      category: h.category
    }));

  // Update stores
  portfolioStore.set(finalHoldings);
  cashBalancesStore.set({ USD: cashUSD, INR: cashINR });
  
  if (pricesChanged) {
    priceStore.set(currentPrices);
  }

  // Sync holdings back to legacy key just in case other parts of code read it
  if (isBrowser) {
    try {
      localStorage.setItem('portfolio_holdings', JSON.stringify(finalHoldings));
    } catch (e) {}
  }
}

// Subscribe to transactionsStore changes
transactionsStore.listen((txs) => {
  recalculatePortfolio(txs);
});

// Run initial calculation
recalculatePortfolio(transactionsStore.get());

// Export transaction controls
export function addTransaction(tx: Omit<Transaction, 'id'>) {
  const current = transactionsStore.get();
  const newTx: Transaction = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...tx,
    ticker: tx.ticker.toUpperCase()
  };
  const next = [...current, newTx];
  transactionsStore.set(next);
  saveTransactions(next);
  return newTx;
}

export function deleteTransaction(id: string) {
  const current = transactionsStore.get();
  const next = current.filter(tx => tx.id !== id);
  transactionsStore.set(next);
  saveTransactions(next);
}

export function editTransaction(id: string, updated: Partial<Transaction>) {
  const current = transactionsStore.get();
  const next = current.map(tx => {
    if (tx.id === id) {
      return {
        ...tx,
        ...updated,
        ticker: (updated.ticker || tx.ticker).toUpperCase()
      };
    }
    return tx;
  });
  transactionsStore.set(next);
  saveTransactions(next);
}

export function clearTransactions() {
  transactionsStore.set([]);
  saveTransactions([]);
  if (isBrowser) {
    localStorage.removeItem('portfolio_holdings');
  }
}

// Keep backward compatibility for Onboarding Wizard imports
export function importHoldings(newHoldings: Holding[], action: 'merge' | 'overwrite') {
  const txs: Transaction[] = newHoldings.map((h, idx) => {
    const symbol = h.symbol.toUpperCase();
    const category = h.category || (() => {
      if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('CRYPTO')) return 'Crypto';
      if (symbol.includes('FUND') || symbol.includes('MUTUAL') || symbol === 'PARA_PARI_FLEX_17J17OL' || symbol.includes('CANARA') || symbol.includes('AXIS') || symbol.includes('MIRAE')) return 'Mutual Funds';
      if (symbol.includes('ETF') || symbol.includes('INDEX') || symbol.includes('BEES')) return 'ETFs';
      return 'Stocks';
    })();

    return {
      id: `tx-imported-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticker: symbol,
      type: 'BUY',
      quantity: h.shares,
      price: h.avgCost,
      fees: 0,
      date: h.dateAcquired || new Date().toISOString().split('T')[0],
      market: isIndianStock(h.symbol) ? 'IN' : 'US',
      platform: h.platform || 'Groww',
      category
    };
  });

  importTransactions(txs, action);
}

export function importTransactions(newTxs: Transaction[], action: 'merge' | 'overwrite') {
  if (action === 'overwrite') {
    transactionsStore.set(newTxs);
    saveTransactions(newTxs);
  } else {
    const current = [...transactionsStore.get(), ...newTxs];
    transactionsStore.set(current);
    saveTransactions(current);
  }
}

// Deprecated functions kept as stub so they don't break old imports if any
export function addHolding(holding: Holding) {
  addTransaction({
    ticker: holding.symbol,
    type: 'BUY',
    quantity: holding.shares,
    price: holding.avgCost,
    fees: 0,
    date: holding.dateAcquired || new Date().toISOString().split('T')[0],
    market: isIndianStock(holding.symbol) ? 'IN' : 'US',
    platform: holding.platform
  });
}

export function deleteHolding(symbol: string, platform: string) {
  const current = transactionsStore.get();
  const next = current.filter(tx => !(tx.ticker.toUpperCase() === symbol.toUpperCase() && tx.platform.toLowerCase() === platform.toLowerCase()));
  transactionsStore.set(next);
  saveTransactions(next);
}

export function clearHoldings() {
  clearTransactions();
}
