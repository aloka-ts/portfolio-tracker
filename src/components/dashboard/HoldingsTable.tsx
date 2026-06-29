import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, deleteHolding, platformFilterStore, EXCHANGE_RATE } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent, getFinancialColorClass, resolveSymbolForDisplay } from '../../lib/utils/formatters';
import { 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Trash2, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal 
} from 'lucide-react';
import type { Holding } from '../../types';

type SortField = 'symbol' | 'shares' | 'avgCost' | 'livePrice' | 'change24h' | 'totalValue' | 'totalPnL' | 'platform';
type SortDirection = 'asc' | 'desc';

export default function HoldingsTable() {
  const holdings = useStore(portfolioStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const platformFilter = useStore(platformFilterStore);
  const [sortField, setSortField] = useState<SortField>('totalValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Flash trend state
  const [priceTrend, setPriceTrend] = useState<Record<string, 'up' | 'down' | null>>({});
  const prevPricesRef = useRef<Record<string, number>>({});

  // Trigger flash classes on price changes
  useEffect(() => {
    // Respect user motion settings
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    const trends: Record<string, 'up' | 'down' | null> = {};
    let hasChanges = false;
    
    Object.entries(prices).forEach(([symbol, tick]) => {
      const prevPrice = prevPricesRef.current[symbol];
      if (prevPrice !== undefined && tick.price !== prevPrice) {
        trends[symbol] = tick.price > prevPrice ? 'up' : 'down';
        hasChanges = true;
      }
      prevPricesRef.current[symbol] = tick.price;
    });
    
    if (hasChanges) {
      setPriceTrend(prev => ({ ...prev, ...trends }));
      
      const timer = setTimeout(() => {
        setPriceTrend({});
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [prices]);

  // Extract platforms for dropdown filter
  const platforms = Array.from(new Set(holdings.map(h => h.platform))).filter(Boolean);

  // Toggle row expansion
  const toggleRow = (symbol: string, platform: string) => {
    const key = `${symbol}-${platform}`;
    const next = new Set(expandedRows);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRows(next);
  };

  // Keyboard navigation support for accessibility (Enter/Space to expand)
  const handleKeyDown = (e: React.KeyboardEvent, symbol: string, platform: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleRow(symbol, platform);
    }
  };

  // Delete holding item
  const handleDelete = (e: React.MouseEvent, symbol: string, platform: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove ${symbol} on platform ${platform}?`)) {
      deleteHolding(symbol, platform);
    }
  };

  // Handle Header Click for Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending
    }
  };

  // 2. Compute statistics for table rows
  const tableData = holdings.map(holding => {
    const symbol = holding.symbol.toUpperCase();
    const priceInfo = prices[symbol];
    const livePriceNative = (priceInfo && typeof priceInfo.price === 'number') ? priceInfo.price : holding.avgCost;
    const change24h = (priceInfo && typeof priceInfo.change24h === 'number') ? priceInfo.change24h : 0;

    // Convert native price/cost into the user's display currency (mirrors HeroStats),
    // so the currency symbol, market value and weights are all consistent.
    const holdingCurrency = holding.market === 'US' ? 'USD' : 'INR';
    let fx = 1;
    if (holdingCurrency === 'USD' && settings.currency === 'INR') fx = EXCHANGE_RATE;
    else if (holdingCurrency === 'INR' && settings.currency === 'USD') fx = 1 / EXCHANGE_RATE;

    const livePrice = livePriceNative * fx;
    const avgCost = holding.avgCost * fx;
    const totalValue = holding.shares * livePrice;
    const totalCost = holding.shares * avgCost;
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    // prevClose = livePrice / (1 + change24h / 100)
    const prevClose = livePriceNative / (1 + change24h / 100);
    const dayPnL = holding.shares * (livePriceNative - prevClose) * fx;
    const dayPnLPercent = prevClose > 0 ? ((livePriceNative - prevClose) / prevClose) * 100 : 0;

    return {
      ...holding,
      avgCost,
      livePrice,
      change24h,
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      dayPnL,
      dayPnLPercent,
      sparkline: priceInfo?.sparkline || []
    };
  });

  // Calculate sum total of all assets to determine portfolio weights
  const grandTotalValue = tableData.reduce((acc, curr) => acc + curr.totalValue, 0);

  // Filter rows
  const filteredData = tableData.filter(row => {
    const matchesSearch = row.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (row.companyName && row.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPlatform = platformFilter === 'ALL' || row.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  // Sort rows
  const sortedData = [...filteredData].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    
    if (sortField === 'change24h') {
      aVal = a.change24h;
      bVal = b.change24h;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Custom mini sparkline generator inside expanded drawer
  const renderMiniSparkline = (points: number[], isPositive: boolean) => {
    if (points.length < 2) return <div className="text-[10px] text-slate-500">No tick data</div>;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min === 0 ? 1 : max - min;
    const height = 24;
    const width = 80;
    
    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    });
    
    const strokeColor = isPositive 
      ? (settings.colorblind ? '#22d3ee' : '#34d399') 
      : (settings.colorblind ? '#f59e0b' : '#f87171');
      
    return (
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={`M ${coords.join(' L ')}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <div className="w-full cyber-card overflow-hidden shadow-lg font-tech">
      
      {/* Controls: Search, Filter, Sizing */}
      <div className="p-4 border-b border-cyan-500/20 bg-black/40 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />
          <input
            type="text"
            placeholder="FILTER BY SEC. ID/NAME..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-cyan-500/30 rounded-none pl-9 pr-4 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 placeholder:text-slate-600 font-tech uppercase"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <SlidersHorizontal size={13} className="text-cyan-500" />
          <select
            value={platformFilter}
            onChange={(e) => platformFilterStore.set(e.target.value)}
            className="bg-black/60 border border-cyan-500/30 rounded-none px-3 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 font-tech uppercase"
          >
            <option value="ALL">ALL CUSTODIANS</option>
            {platforms.map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE VIEW (Tablet & Desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-350">
          <thead className="bg-navy-950 text-slate-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[10px] select-none">
            <tr>
              <th className="p-3 w-8" />
              {[
                { label: 'Ticker', field: 'symbol' },
                { label: 'Shares', field: 'shares' },
                { label: 'Avg Cost', field: 'avgCost' },
                { label: 'Live Price', field: 'livePrice' },
                { label: 'Day Return', field: 'change24h' },
                { label: 'Market Value', field: 'totalValue' },
                { label: 'Total Return', field: 'totalPnL' },
                { label: 'Weight', field: 'totalValue' },
                { label: 'Platform', field: 'platform' }
              ].map((h, i) => (
                <th 
                  key={i} 
                  onClick={() => handleSort(h.field as SortField)}
                  className="p-3 cursor-pointer hover:bg-white/[0.02] hover:text-white transition duration-150 select-none"
                >
                  <div className="flex items-center space-x-1 justify-end first:justify-start">
                    <span>{h.label}</span>
                    <ArrowUpDown size={10} className="text-slate-500" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => {
              const rowKey = `${row.symbol}-${row.platform}`;
              const isExpanded = expandedRows.has(rowKey);
              const isDayPnLPositive = row.dayPnL >= 0;
              const weightPercent = grandTotalValue > 0 ? (row.totalValue / grandTotalValue) * 100 : 0;
              
              // Flash status - soft transitions
              const flash = priceTrend[row.symbol];
              const flashClass = flash === 'up' 
                ? 'bg-gain/10 text-gain transition duration-300' 
                : flash === 'down' 
                  ? 'bg-loss/10 text-loss transition duration-300' 
                  : '';

              return (
                <React.Fragment key={rowKey}>
                  <tr 
                    onClick={() => toggleRow(row.symbol, row.platform)}
                    onKeyDown={(e) => handleKeyDown(e, row.symbol, row.platform)}
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer select-none transition duration-150 ${isExpanded ? 'bg-white/[0.01]' : ''}`}
                  >
                    <td className="p-3 text-center text-slate-500">
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} />}
                    </td>
                    <td className="p-3 text-left font-sans font-bold tracking-tight text-white">
                      <div className="text-slate-100">{resolveSymbolForDisplay(row.symbol)}</div>
                      {row.companyName && (
                        <div className="text-[10px] text-slate-550 font-normal font-sans tracking-normal mt-0.5">{row.companyName}</div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono-nums text-slate-300">
                      {row.shares.toFixed(3).replace(/\.?0+$/, '')}
                    </td>
                    <td className="p-3 text-right font-mono-nums text-slate-350">
                      <div>{formatCurrency(row.avgCost, settings.currency, settings.decimals)}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5" title="Total Invested Value">
                        Cost: {formatCurrency(row.shares * row.avgCost, settings.currency, settings.decimals)}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono-nums font-bold ${flashClass}`}>
                      {formatCurrency(row.livePrice, settings.currency, settings.decimals)}
                    </td>
                    <td className={`p-3 text-right font-mono-nums font-bold ${getFinancialColorClass(row.change24h, settings.colorblind)}`}>
                      <div className="flex items-center justify-end space-x-1 font-sans text-xs">
                        {row.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        <span>{formatPercent(row.change24h)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono-nums font-bold text-white">
                      {formatCurrency(row.totalValue, settings.currency, settings.decimals)}
                    </td>
                    <td className={`p-3 text-right font-mono-nums font-bold ${getFinancialColorClass(row.totalPnL, settings.colorblind)}`}>
                      <div>{formatCurrency(row.totalPnL, settings.currency, settings.decimals)}</div>
                      <div className="text-[9px] font-sans font-normal tracking-wide opacity-80 mt-0.5">{formatPercent(row.totalPnLPercent)}</div>
                    </td>
                    <td className="p-3 text-right font-mono-nums text-slate-455">
                      {weightPercent.toFixed(1)}%
                    </td>
                    <td className="p-3 text-right text-slate-400 font-medium">
                      <span className="bg-slate-900 px-2 py-0.5 rounded-full border border-white/[0.08] text-[9px] text-slate-350">{row.platform}</span>
                    </td>
                  </tr>

                  {/* EXPANDED ROW DETAILS DRAWER */}
                  {isExpanded && (
                    <tr className="bg-white/[0.01] border-b border-white/[0.08]">
                      <td colSpan={10} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-slate-300">
                          
                          {/* Acquisition Stats */}
                          <div className="space-y-2">
                            <span className="text-[9px] uppercase font-bold text-slate-550 tracking-wider">Acquisition Details</span>
                            <div className="space-y-1.5">
                              <div className="flex justify-between border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500">Brokerage:</span>
                                <span className="font-semibold text-white">{row.platform}</span>
                              </div>
                              <div className="flex justify-between border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500">Acquired:</span>
                                <span className="font-mono text-slate-305">{row.dateAcquired || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between pb-1">
                                <span className="text-slate-500">Cost Basis:</span>
                                <span className="font-mono-nums text-white">{formatCurrency(row.shares * row.avgCost, settings.currency, settings.decimals)}</span>
                              </div>
                            </div>
                          </div>

                          {/* P&L Analysis */}
                          <div className="space-y-2">
                            <span className="text-[9px] uppercase font-bold text-slate-550 tracking-wider">Return Metrics</span>
                            <div className="space-y-1.5">
                              <div className="flex justify-between border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500">Day Return P&L:</span>
                                <span className={`font-mono-nums font-semibold ${getFinancialColorClass(row.dayPnL, settings.colorblind)}`}>
                                  {formatCurrency(row.dayPnL, settings.currency, settings.decimals)}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-white/[0.04] pb-1">
                                <span className="text-slate-500">Day Return %:</span>
                                <span className={`font-mono-nums font-semibold ${getFinancialColorClass(row.dayPnLPercent, settings.colorblind)}`}>
                                  {formatPercent(row.dayPnLPercent)}
                                </span>
                              </div>
                              <div className="flex justify-between pb-1">
                                <span className="text-slate-500">Portfolio Weight:</span>
                                <span className="font-mono-nums text-slate-300 font-semibold">{weightPercent.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Interactive Sparkline Chart */}
                          <div className="space-y-2 flex flex-col justify-between">
                            <span className="text-[9px] uppercase font-bold text-slate-550 tracking-wider">Live Tick Sparkline</span>
                            <div className="p-2 bg-navy-950/40 border border-white/[0.08] rounded-xl w-fit flex items-center justify-center">
                              {renderMiniSparkline(row.sparkline, isDayPnLPositive)}
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="space-y-2 flex flex-col justify-end items-start md:items-end">
                            <span className="text-[9px] uppercase font-bold text-slate-500/60 tracking-wider hidden md:block">Controls</span>
                            <button
                              onClick={(e) => handleDelete(e, row.symbol, row.platform)}
                              className="px-3 py-1.5 bg-loss/5 hover:bg-loss/15 text-loss border border-loss/20 hover:border-loss/40 text-[10px] font-semibold rounded-lg transition flex items-center space-x-1"
                            >
                              <Trash2 size={12} />
                              <span>Purge Asset Record</span>
                            </button>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE LIST VIEW (Cards on smaller screens) */}
      <div className="block md:hidden divide-y divide-cyan-500/10 font-tech">
        {sortedData.map((row) => {
          const rowKey = `${row.symbol}-${row.platform}`;
          const isExpanded = expandedRows.has(rowKey);
          const weightPercent = grandTotalValue > 0 ? (row.totalValue / grandTotalValue) * 100 : 0;
          
          return (
            <div 
              key={rowKey}
              onClick={() => toggleRow(row.symbol, row.platform)}
              className={`p-4 hover:bg-cyan-500/5 cursor-pointer flex flex-col space-y-2.5 transition duration-150 ${isExpanded ? 'bg-cyan-500/5' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm text-cyan-300 tracking-wide">{resolveSymbolForDisplay(row.symbol)}</span>
                  <span className="bg-cyan-500/5 border border-cyan-500/20 px-1.5 py-0.5 rounded-none text-[8px] text-cyan-400 font-bold ml-2 uppercase">{row.platform}</span>
                </div>
                
                <div className={`text-xs font-bold ${getFinancialColorClass(row.change24h, settings.colorblind)} flex items-center space-x-0.5`}>
                  {row.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span className="font-mono-nums">{formatPercent(row.change24h)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] text-cyan-500/60 uppercase">
                <div>
                  <span className="block text-[8px] text-cyan-500/40 font-bold mb-0.5">LIVE PRICE</span>
                  <span className="font-mono-nums text-white font-medium">{formatCurrency(row.livePrice, settings.currency, settings.decimals)}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-cyan-500/40 font-bold mb-0.5">NET VALUE</span>
                  <span className="font-mono-nums text-white font-medium">{formatCurrency(row.totalValue, settings.currency, settings.decimals)}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-cyan-500/40 font-bold mb-0.5">TOTAL P&L</span>
                  <div className={`font-mono-nums font-bold ${getFinancialColorClass(row.totalPnL, settings.colorblind)}`}>
                    <div>{formatCurrency(row.totalPnL, settings.currency, settings.decimals)}</div>
                    <div className="text-[8px] font-normal tracking-wide opacity-80 mt-0.5">{formatPercent(row.totalPnLPercent)}</div>
                  </div>
                </div>
              </div>

              {/* Mobile Expansion */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-cyan-500/10 grid grid-cols-2 gap-3 text-[10px] text-slate-300">
                  <div>
                    <span className="text-[8px] text-cyan-500/50 font-bold block mb-0.5">SHARES QTY</span>
                    <span className="font-mono text-white">{row.shares.toFixed(3).replace(/\.?0+$/, '')}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-cyan-500/50 font-bold block mb-0.5">ENTRY COST</span>
                    <span className="font-mono text-white">{formatCurrency(row.avgCost, settings.currency, settings.decimals)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-cyan-500/50 font-bold block mb-0.5">COST BASIS</span>
                    <span className="font-mono text-white">{formatCurrency(row.shares * row.avgCost, settings.currency, settings.decimals)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-cyan-500/50 font-bold block mb-0.5">TIMESTAMP</span>
                    <span className="font-mono text-white">{row.dateAcquired || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-cyan-500/50 font-bold block mb-0.5">PORT WEIGHT</span>
                    <span className="font-mono text-cyan-400 font-bold">{weightPercent.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-end justify-start">
                    <button
                      onClick={(e) => handleDelete(e, row.symbol, row.platform)}
                      className="px-2 py-1 bg-loss/10 border border-loss/30 hover:border-loss/40 text-loss text-[9px] font-bold rounded-none flex items-center space-x-1"
                    >
                      <Trash2 size={10} />
                      <span>PURGE</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedData.length === 0 && (
        <div className="p-12 text-center text-cyan-500/50 font-tech text-xs">
          [ NO DATA RECORDS FOUND MATCHING FILTER CRITERIA ]
        </div>
      )}
    </div>
  );
}
