import React, { useState, useMemo } from 'react';
import { Search, X, TrendingUp, Building2, Landmark, Coins, Globe } from 'lucide-react';

export interface TickerSearchResult {
  ticker: string;
  name: string;
  category: 'Stocks' | 'Mutual Funds' | 'ETFs' | 'Crypto';
  market: 'IN' | 'US';
  exchange?: string;
}

const POPULAR_TICKERS: TickerSearchResult[] = [
  // US Tech Giants & ETFs
  { ticker: 'AAPL', name: 'Apple Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'TSLA', name: 'Tesla Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'META', name: 'Meta Platforms Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'NFLX', name: 'Netflix Inc.', category: 'Stocks', market: 'US', exchange: 'NASDAQ' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', category: 'ETFs', market: 'US', exchange: 'NYSE' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq 100)', category: 'ETFs', market: 'US', exchange: 'NASDAQ' },

  // Indian Large & Mid-Cap Equities
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'TCS.NS', name: 'Tata Consultancy Services Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'INFY.NS', name: 'Infosys Limited', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'ICICIBANK.NS', name: 'ICICI Bank Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'TATAMOTORS.NS', name: 'Tata Motors Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'BSE.NS', name: 'BSE Limited', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'MCX.NS', name: 'Multi Commodity Exchange of India', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'POWERINDIA.NS', name: 'Hitachi Energy India Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'NATIONALUM.NS', name: 'National Aluminium Co Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'ADANIPOWER.NS', name: 'Adani Power Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },
  { ticker: 'BHARATFORG.NS', name: 'Bharat Forge Ltd.', category: 'Stocks', market: 'IN', exchange: 'NSE' },

  // Indian ETFs
  { ticker: 'NIFTYBEES.NS', name: 'Nippon India ETF Nifty BeES', category: 'ETFs', market: 'IN', exchange: 'NSE' },
  { ticker: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', category: 'ETFs', market: 'IN', exchange: 'NSE' },
  { ticker: 'JUNIORBEES.NS', name: 'Nippon India ETF Junior BeES', category: 'ETFs', market: 'IN', exchange: 'NSE' },
  { ticker: 'MON100.NS', name: 'Motilal Oswal Nasdaq 100 ETF', category: 'ETFs', market: 'IN', exchange: 'NSE' },
  { ticker: 'CPSEETF.NS', name: 'CPSE ETF', category: 'ETFs', market: 'IN', exchange: 'NSE' },
  { ticker: 'ALPHA.NS', name: 'Kotak Nifty Alpha 50 ETF', category: 'ETFs', market: 'IN', exchange: 'NSE' },

  // Indian Mutual Funds
  { ticker: 'PARA_PARI_FLEX_17J17OL', name: 'Parag Parikh Flexi Cap Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'AXIS_SMAL_CAP_OE6ZGA', name: 'Axis Small Cap Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'NIPP_INDI_MULT_XVC2VX', name: 'Nippon India Multi Cap Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'UTI_NIFT_50_FGX2CX', name: 'UTI Nifty 50 Index Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'CANA_ROBE_SMAL_FYLATW', name: 'Canara Robeco Small Cap Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'MIRA_ASSE_ELSS_41CP29', name: 'Mirae Asset ELSS Tax Saver Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },
  { ticker: 'WHIT_CAPI_MULT_Q9NB0D', name: 'WhiteOak Capital Multi Cap Fund Direct-Growth', category: 'Mutual Funds', market: 'IN', exchange: 'AMFI' },

  // Cryptocurrencies
  { ticker: 'BTC', name: 'Bitcoin', category: 'Crypto', market: 'US', exchange: 'CRYPTO' },
  { ticker: 'ETH', name: 'Ethereum', category: 'Crypto', market: 'US', exchange: 'CRYPTO' },
  { ticker: 'SOL', name: 'Solana', category: 'Crypto', market: 'US', exchange: 'CRYPTO' },
  { ticker: 'BNB', name: 'BNB', category: 'Crypto', market: 'US', exchange: 'CRYPTO' }
];

interface TickerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: TickerSearchResult) => void;
}

export const TickerSearchModal: React.FC<TickerSearchModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POPULAR_TICKERS.filter((item) => {
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesQuery = !q || 
        item.ticker.toLowerCase().includes(q) || 
        item.name.toLowerCase().includes(q) ||
        (item.exchange && item.exchange.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-tab-change">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/95 shadow-2xl shadow-cyan-500/10 text-slate-100">
        
        {/* Header with search input */}
        <div className="relative p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by company name, ticker, or symbol (e.g. RELIANCE, Parag Parikh, NVDA)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-slate-500 text-slate-100"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {['ALL', 'Stocks', 'ETFs', 'Mutual Funds', 'Crypto'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
          {filteredResults.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching assets found for "{query}". You can still type custom symbols directly.
            </div>
          ) : (
            filteredResults.map((item) => (
              <button
                key={item.ticker}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="w-full p-3 rounded-xl flex items-center justify-between hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 transition-colors">
                    {item.category === 'Stocks' && <Building2 className="w-5 h-5 text-cyan-400" />}
                    {item.category === 'ETFs' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                    {item.category === 'Mutual Funds' && <Landmark className="w-5 h-5 text-indigo-400" />}
                    {item.category === 'Crypto' && <Coins className="w-5 h-5 text-amber-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">{item.ticker}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                        {item.exchange || item.market}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-1">{item.name}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-medium text-cyan-400/80 group-hover:text-cyan-300">
                    Select &rarr;
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 flex justify-between items-center">
          <span>Click any symbol to auto-fill transaction form</span>
          <span className="text-slate-400 font-mono">{filteredResults.length} assets available</span>
        </div>

      </div>
    </div>
  );
};
