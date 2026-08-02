import React from 'react';
  import { useStore } from '@nanostores/react';
  import { portfolioStore, platformFilterStore, cashBalancesStore, EXCHANGE_RATE } from '../../stores/portfolio';
  import { priceStore, lastUpdatedStore } from '../../stores/prices';
  import { settingsStore } from '../../stores/settings';
  import { formatCurrency, formatPercent, getFinancialColorClass } from '../../lib/utils/formatters';
  import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight } from 'lucide-react';
  
  export default function HeroStats() {
    const holdings = useStore(portfolioStore);
    const prices = useStore(priceStore);
    const settings = useStore(settingsStore);
    const lastUpdated = useStore(lastUpdatedStore);
    const platformFilter = useStore(platformFilterStore);
    const cashBalances = useStore(cashBalancesStore);
  
    // Filter holdings based on selected custodian/platform
    const filteredHoldings = platformFilter === 'ALL'
      ? holdings
      : holdings.filter(h => h.platform.toLowerCase() === platformFilter.toLowerCase());
  
    // 1. Calculations
    let totalValue = 0;
    let totalCost = 0;
    let totalDayPnL = 0;
  
    // Calculate cash balance in settings.currency (only for ALL platforms since cash is global)
    let cashBalance = 0;
    if (platformFilter === 'ALL') {
      if (settings.currency === 'USD') {
        cashBalance = cashBalances.USD + (cashBalances.INR / EXCHANGE_RATE);
      } else if (settings.currency === 'INR') {
        cashBalance = cashBalances.INR + (cashBalances.USD * EXCHANGE_RATE);
      } else {
        cashBalance = cashBalances.USD + (cashBalances.INR / EXCHANGE_RATE);
      }
    }
  
    // Track weighted portfolio sparkline (size 8)
    const portfolioSparkline = new Array(8).fill(0);
  
    filteredHoldings.forEach(holding => {
      const symbol = holding.symbol.toUpperCase();
      const isUS = holding.market === 'US';
      const holdingCurrency = isUS ? 'USD' : 'INR';
  
      const priceInfo = prices[symbol];
      const livePrice = (priceInfo && typeof priceInfo.price === 'number') ? priceInfo.price : holding.avgCost;
      const change24h = (priceInfo && typeof priceInfo.change24h === 'number') ? priceInfo.change24h : 0;
      
      let val = holding.shares * livePrice;
      let costBasis = holding.shares * holding.avgCost;
      
      // Convert to settings.currency
      if (holdingCurrency !== settings.currency) {
        if (holdingCurrency === 'USD' && settings.currency === 'INR') {
          val *= EXCHANGE_RATE;
          costBasis *= EXCHANGE_RATE;
        } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
          val /= EXCHANGE_RATE;
          costBasis /= EXCHANGE_RATE;
        }
      }
  
      totalValue += val;
      totalCost += costBasis;
  
      // Calculate Day P&L
      // prevClose = livePrice / (1 + change24h / 100)
      const prevClose = livePrice / (1 + change24h / 100);
      let dayPnL = holding.shares * (livePrice - prevClose);
      
      if (holdingCurrency !== settings.currency) {
        if (holdingCurrency === 'USD' && settings.currency === 'INR') {
          dayPnL *= EXCHANGE_RATE;
        } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
          dayPnL /= EXCHANGE_RATE;
        }
      }
      totalDayPnL += dayPnL;
  
      // Accumulate weighted sparkline points
      if (priceInfo && priceInfo.sparkline && priceInfo.sparkline.length === 8) {
        priceInfo.sparkline.forEach((p, idx) => {
          let pVal = holding.shares * p;
          if (holdingCurrency !== settings.currency) {
            if (holdingCurrency === 'USD' && settings.currency === 'INR') {
              pVal *= EXCHANGE_RATE;
            } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
              pVal /= EXCHANGE_RATE;
            }
          }
          portfolioSparkline[idx] += pVal;
        });
      } else {
        // Fallback: fill sparkline with current value
        for (let i = 0; i < 8; i++) {
          portfolioSparkline[i] += val;
        }
      }
    });
  
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    
    const totalDayPnLPercent = (totalValue - totalDayPnL) > 0 
      ? (totalDayPnL / (totalValue - totalDayPnL)) * 100 
      : 0;
  
    // Add cash balance to total portfolio value if cash is tracked
  const grandTotalValue = totalValue + cashBalance;

  // Helper to render sparkline SVG path
  const renderSparklinePath = (points: number[]) => {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min === 0 ? 1 : max - min;
    
    const height = 40;
    const width = 120;
    
    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${coords.join(' L ')}`;
  };

  const isDayPnLPositive = totalDayPnL >= 0;
  const isTotalPnLPositive = totalPnL >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* 1. Total Invested Value */}
      <div className="cyber-card glow-card hover-scale p-4 md:p-5 flex flex-col justify-between overflow-hidden group">
        <div className="glow-card-inner h-full flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Invested</span>
            <span className="text-xl md:text-2xl font-extrabold text-white tracking-tight block">
              {formatCurrency(totalCost, settings.currency, settings.decimals)}
            </span>
          </div>
          
          <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-slate-500">
            <DollarSign size={12} className="text-slate-400" />
            <span>Historical Cost Basis</span>
          </div>
        </div>
      </div>

      {/* 2. Present Value - High Contrast Stone Panel */}
      <div className="stone-card glow-card hover-scale p-4 md:p-5 flex flex-col justify-between overflow-hidden group">
        {/* Background sparkline curve */}
        <div className="absolute right-0 bottom-0 opacity-20 group-hover:opacity-30 transition pointer-events-none">
          <svg width="120" height="40" className="overflow-visible">
            <path
              d={renderSparklinePath(portfolioSparkline)}
              fill="none"
              stroke={isDayPnLPositive ? '#10B981' : '#FF0055'}
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="glow-card-inner h-full flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">Present Value</span>
            <span className="text-xl md:text-2xl font-extrabold text-white tracking-tight block">
              {formatCurrency(totalValue, settings.currency, settings.decimals)}
            </span>
          </div>
          
          <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-slate-400">
            <span>Live price feed</span>
            {lastUpdated && (
              <span className="text-slate-350 font-mono-nums">
                ({lastUpdated.toLocaleTimeString(undefined, { hour12: false })})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Total Return (Total P&L & Total P&L %) */}
      <div className="cyber-card glow-card hover-scale p-4 md:p-5 flex flex-col justify-between overflow-hidden group">
        <div className="glow-card-inner h-full flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Return</span>
            <span className={`text-lg md:text-xl font-bold tracking-tight block ${getFinancialColorClass(totalPnL, settings.colorblind)}`}>
              {formatCurrency(totalPnL, settings.currency, settings.decimals)}
            </span>
          </div>

          <div className="mt-2.5 flex items-center space-x-1">
            {isTotalPnLPositive ? (
              <TrendingUp size={12} className={getFinancialColorClass(totalPnL, settings.colorblind)} />
            ) : (
              <TrendingDown size={12} className={getFinancialColorClass(totalPnL, settings.colorblind)} />
            )}
            <span className={`text-[10px] font-bold font-mono-nums ${getFinancialColorClass(totalPnL, settings.colorblind)}`}>
              {formatPercent(totalPnLPercent)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Day's P&L & Day's P&L % */}
      <div className="cyber-card glow-card hover-scale p-4 md:p-5 flex flex-col justify-between overflow-hidden group">
        <div className="glow-card-inner h-full flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Day's Return</span>
            <span className={`text-lg md:text-xl font-bold tracking-tight block ${getFinancialColorClass(totalDayPnL, settings.colorblind)}`}>
              {formatCurrency(totalDayPnL, settings.currency, settings.decimals)}
            </span>
          </div>

          <div className="mt-2.5 flex items-center space-x-1">
            {isDayPnLPositive ? (
              <TrendingUp size={12} className={getFinancialColorClass(totalDayPnL, settings.colorblind)} />
            ) : (
              <TrendingDown size={12} className={getFinancialColorClass(totalDayPnL, settings.colorblind)} />
            )}
            <span className={`text-[10px] font-bold font-mono-nums ${getFinancialColorClass(totalDayPnL, settings.colorblind)}`}>
              {formatPercent(totalDayPnLPercent)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
