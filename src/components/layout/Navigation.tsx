import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, Sun, Moon, Sparkles, TrendingUp, X, TrendingDown, HelpCircle, User } from 'lucide-react';
import { getThemeMode, setThemeMode, type ThemeMode } from '../../lib/theme';
import { settingsStore, updateSettings } from '../../stores/settings';
import { useStore } from '@nanostores/react';
import { MockMarketDataProvider } from '../../lib/market/mockProvider';
import { formatCurrency, formatPercent, getFinancialColorClass } from '../../lib/utils/formatters';
import Chart from 'chart.js/auto';

// Dynamic search suggestions database
const SEARCH_SYMBOLS = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS'];

export default function Navigation() {
  const settings = useStore(settingsStore);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [stockDetails, setStockDetails] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [hasUploadedData, setHasUploadedData] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    setTheme(getThemeMode());
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setThemeMode(nextTheme);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('portfolio_holdings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHasUploadedData(true);
          }
        }
      } catch (e) { }
    }
  }, []);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  let chartInstance: Chart | null = null;

  // Sync dark class on body
  useEffect(() => {
    if (settings.colorblind) {
      document.documentElement.classList.add('colorblind');
    } else {
      document.documentElement.classList.remove('colorblind');
    }
  }, [settings.colorblind]);

  // Suggestion typeahead filter
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const filtered = SEARCH_SYMBOLS.filter(sym =>
        sym.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  // Fetch quick-view stock stats
  const selectStockForLookup = async (symbol: string) => {
    setSearchQuery('');
    setSuggestions([]);

    // Fetch prices via Mock Provider (quick & works offline)
    const result = await MockMarketDataProvider.fetchPrices([symbol]);
    const tick = result[symbol];

    if (tick) {
      // Simulate historical data for chart
      const history: number[] = [];
      let base = tick.price ?? 100;
      for (let i = 0; i < 30; i++) {
        base = base * (1 + (Math.random() * 0.03 - 0.015));
        history.push(base);
      }

      setStockDetails({
        symbol,
        price: tick.price,
        change24h: tick.change24h,
        companyName: symbol === 'AAPL' ? 'Apple Inc.' : symbol === 'TSLA' ? 'Tesla Inc.' : `${symbol} Corp`,
        history
      });
      setSelectedStock(symbol);
      setShowSearchModal(true);
    }
  };

  // Render chart inside lookup modal
  useEffect(() => {
    if (showSearchModal && stockDetails && chartRef.current) {
      // Destroy previous chart if exists
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        // Find existing chart and destroy to prevent duplicate warnings
        const existingChart = Chart.getChart(chartRef.current);
        if (existingChart) existingChart.destroy();

        const labelArr = Array.from({ length: 30 }, (_, i) => `D${i + 1}`);
        const isPositive = (stockDetails.change24h ?? 0) >= 0;
        const color = isPositive
          ? (settings.colorblind ? '#22d3ee' : '#34d399')
          : (settings.colorblind ? '#f59e0b' : '#f87171');

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labelArr,
            datasets: [{
              label: `${stockDetails.symbol} Price`,
              data: stockDetails.history,
              borderColor: color,
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              backgroundColor: isPositive ? 'rgba(52, 211, 153, 0.05)' : 'rgba(248, 113, 113, 0.05)',
              tension: 0.15
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: {
                grid: { color: 'rgba(148, 163, 184, 0.05)' },
                ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
              }
            }
          }
        });
      }
    }
  }, [showSearchModal, stockDetails, settings.colorblind]);

  const toggleColorblind = () => {
    updateSettings({ colorblind: !settings.colorblind });
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-navy-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Logo and Brand */}
            <div className="flex items-center space-x-2.5 shrink-0">
              <a href={hasUploadedData ? "/dashboard" : "/"} className="flex items-center space-x-2">
                <div className="p-1.5 bg-accent/10 border border-accent/20 rounded-lg text-accent">
                  <TrendingUp size={20} />
                </div>
                <span className="font-heading font-extrabold text-base tracking-tight text-white flex items-center space-x-1.5">
                  <span>WealthFlow</span>
                  <span className="bg-accent text-white font-semibold text-[10px] px-2 py-0.5 rounded">Portfolio</span>
                </span>
              </a>
            </div>

            {/* Central Autocomplete Search */}
            <div className="flex-1 max-w-md relative shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  placeholder="Search tickers (e.g. AAPL, RELIANCE.NS)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-navy-900 border border-white/[0.06] rounded-lg pl-10 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-stone-500"
                />
              </div>

              {/* Autocomplete Suggestion Box */}
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-navy-900 border border-white/[0.06] rounded-lg shadow-2xl z-50 overflow-hidden">
                  {suggestions.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => selectStockForLookup(sym)}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/[0.04] text-stone-300 hover:text-white flex items-center justify-between border-b border-white/[0.04] last:border-b-0"
                    >
                      <span className="font-mono font-bold tracking-wide text-accent">{sym}</span>
                      <span className="text-[10px] text-stone-500">Quick Analysis Lookup</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right-side Preferences & Navigation */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-stone-400 hover:text-white transition duration-150"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Colorblind visual toggle */}
              <button
                onClick={toggleColorblind}
                title="Toggle High-Contrast Colorblind Mode"
                className={`p-1.5 rounded-lg border transition duration-150 ${settings.colorblind
                    ? 'bg-accent/10 border-accent/30 text-accent shadow-sm'
                    : 'border-white/[0.06] hover:bg-white/[0.04] text-stone-400 hover:text-white'
                  }`}
              >
                <Sparkles size={16} />
              </button>

              {/* Walkthrough Guide button */}
              <button
                onClick={() => setShowGuideModal(true)}
                title="User Guide & Spreadsheet Formats"
                className="p-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-stone-400 hover:text-white transition duration-150"
              >
                <HelpCircle size={16} />
              </button>

              {/* Back to Dashboard Link */}
              {hasUploadedData && (
                <a
                  href="/dashboard"
                  title="Go to Dashboard"
                  className="p-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-stone-400 hover:text-white transition duration-150 flex items-center space-x-1"
                >
                  <TrendingUp size={16} />
                  <span className="text-xs font-semibold hidden md:inline">Dashboard</span>
                </a>
              )}

              {/* Settings gear link */}
              <a
                href="/settings"
                title="Application Settings"
                className="p-1.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] text-stone-400 hover:text-white transition duration-150"
              >
                <Settings size={16} />
              </a>

              {/* Account avatar indicator */}
              <a
                href="/settings"
                title="Account Settings"
                className="flex items-center space-x-2 border-l border-white/[0.06] pl-3 cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-navy-900 border border-white/[0.06] flex items-center justify-center text-stone-300 group-hover:text-white group-hover:border-stone-500 font-bold text-xs transition duration-150">
                  <User size={14} />
                </div>
              </a>
            </div>

          </div>
        </div>
      </nav>

      {/* QUICK VIEW STOCK ANALYSIS MODAL */}
      {showSearchModal && stockDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="stone-card w-full max-w-xl overflow-hidden font-sans">

            {/* Modal Header */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 font-sans">Hypothetical Quick View</span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-heading">
                  <span className="font-bold tracking-wide text-accent">{stockDetails.symbol}</span>
                  <span className="text-stone-400 font-normal">| {stockDetails.companyName}</span>
                </h3>
              </div>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 border border-stone-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold font-serif-num text-white">
                    {formatCurrency(stockDetails.price, settings.currency, settings.decimals)}
                  </span>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${(stockDetails.change24h ?? 0) >= 0
                    ? 'border-gain/30 text-gain bg-gain/5'
                    : 'border-loss/30 text-loss bg-loss/5'
                  }`}>
                  {formatPercent(stockDetails.change24h)}
                </div>
              </div>

              {/* Simulated Chart */}
              <div className="h-[200px] w-full border border-stone-800 bg-stone-950 rounded-xl p-2">
                <canvas ref={chartRef} />
              </div>

              <div className="p-3 bg-stone-900 border border-stone-800 text-[10px] text-stone-405 leading-relaxed rounded-xl">
                Note: This is a diagnostic lookup sandbox. Closing this modal clears simulated data. To track this symbol inside your main dashboard, append a transaction row inside Onboarding or Settings.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-stone-900/50 px-4 py-3 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold rounded-lg transition"
              >
                Dismiss View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* USER GUIDE & WALKTHROUGH MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="stone-card w-full max-w-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">

            {/* Modal Header */}
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-accent font-semibold">Documentation</span>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-heading">
                  <span>How to Use & Spreadsheet Formats</span>
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 border border-stone-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Section 1: How to use */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">🚀 Quick Start Walkthrough</h4>
                <ol className="text-xs text-stone-300 space-y-2 list-decimal pl-4">
                  <li>Navigate to home onboarding wizard page.</li>
                  <li>Click **"Browse Files"** or drag and drop your transaction sheet.</li>
                  <li>Verify mapped columns are configured correctly.</li>
                  <li>Select import strategy (**Overwrite** to replace or **Merge** to append).</li>
                  <li>Click **"Build Dashboard"** to compile your live real-time analysis.</li>
                </ol>
              </div>

              {/* Section 2: Standard Format */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">📊 Standard Spreadsheet Format</h4>
                <p className="text-xs text-stone-400">
                  Ensure uploaded CSV or Excel records contain columns representing the following details:
                </p>
                <div className="overflow-x-auto border border-stone-800 rounded-lg">
                  <table className="w-full text-left text-[11px] text-stone-300">
                    <thead className="bg-stone-900 text-stone-400 border-b border-stone-800 font-semibold uppercase">
                      <tr>
                        <th className="p-2.5">Field</th>
                        <th className="p-2.5">Fuzzy Header Matches</th>
                        <th className="p-2.5">Example Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800 bg-stone-950/40">
                      <tr>
                        <td className="p-2.5 font-bold text-white">Ticker / Symbol</td>
                        <td className="p-2.5">`symbol`, `ticker`, `stock`, `instrument`</td>
                        <td className="p-2.5 font-mono text-accent">AAPL, RELIANCE.NS</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-white">Shares / Qty</td>
                        <td className="p-2.5">`shares`, `quantity`, `qty`, `units`</td>
                        <td className="p-2.5 font-mono text-accent">15, 243.50</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-white">Avg Cost</td>
                        <td className="p-2.5">`avgcost`, `purchase price`, `price`, `cost`</td>
                        <td className="p-2.5 font-mono text-accent">175.50, 2820.00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-white">Platform</td>
                        <td className="p-2.5">`platform`, `broker`, `custodian`</td>
                        <td className="p-2.5 text-stone-300">Zerodha, Groww</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Intelligent Autodetect */}
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg space-y-2">
                <h4 className="text-xs font-bold text-accent flex items-center space-x-1.5">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>Intelligent Multi-Sheet Autodetect</span>
                </h4>
                <p className="text-xs text-stone-300 leading-relaxed font-sans font-normal">
                  The dashboard features auto-recognition algorithms to parse specialized multi-sheet portfolio trackers directly (specifically, worksheets titled **"4.Portfolio Management"** or **"Rest of Portfolio"**).
                </p>
                <p className="text-xs text-stone-400 leading-relaxed font-sans">
                  You can upload files in their raw layout. Columns, exchanges, and brokers are parsed client-side automatically.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-stone-900/50 px-4 py-3 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition"
              >
                Acknowledge Reference
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
