import React from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent, getFinancialColorClass, resolveSymbolForDisplay } from '../../lib/utils/formatters';
import { Landmark, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { PlatformStat } from '../../types';

export default function PlatformBreakdown() {
  const holdings = useStore(portfolioStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);

  // Group calculations
  const platformGroups: Record<string, { value: number; cost: number; topSym: string; topVal: number }> = {};

  holdings.forEach(h => {
    const symbol = h.symbol.toUpperCase();
    const livePrice = prices[symbol]?.price || h.avgCost;
    const value = h.shares * livePrice;
    const cost = h.shares * h.avgCost;
    const platform = h.platform || 'Unknown';

    if (!platformGroups[platform]) {
      platformGroups[platform] = {
        value: 0,
        cost: 0,
        topSym: '',
        topVal: -1
      };
    }

    const group = platformGroups[platform];
    group.value += value;
    group.cost += cost;

    // Check if this holding has the highest value on this platform
    if (value > group.topVal) {
      group.topVal = value;
      group.topSym = symbol;
    }
  });

  const platformStats: PlatformStat[] = Object.entries(platformGroups).map(([platform, data]) => {
    const totalPnL = data.value - data.cost;
    const totalPnLPercent = data.cost > 0 ? (totalPnL / data.cost) * 100 : 0;
    return {
      platform,
      totalValue: data.value,
      totalPnL,
      totalPnLPercent,
      topHoldingSymbol: data.topSym,
      topHoldingValue: data.topVal
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  if (platformStats.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center space-x-2">
        <Landmark size={15} className="text-slate-500" />
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Platform Allocation</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platformStats.map(stat => {
          const isPositive = stat.totalPnL >= 0;
          return (
            <div 
              key={stat.platform}
              className="cyber-card p-4 flex flex-col justify-between hover:border-white/[0.12] transition duration-150"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase">{stat.platform}</span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                    isPositive 
                      ? 'border-gain/30 text-gain bg-gain/5' 
                      : 'border-loss/30 text-loss bg-loss/5'
                  }`}>
                    {formatPercent(stat.totalPnLPercent)}
                  </span>
                </div>
                
                <span className="text-lg font-bold font-mono-nums text-white block">
                  {formatCurrency(stat.totalValue, settings.currency, settings.decimals)}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <div className="space-y-0.5">
                  <span className="text-slate-500 block uppercase font-bold text-[8px]">Top Asset</span>
                  <span className="font-semibold text-slate-350">{resolveSymbolForDisplay(stat.topHoldingSymbol)}</span>
                </div>
                
                <div className="text-right space-y-0.5">
                  <span className="text-slate-500 block uppercase font-bold text-[8px]">Total P&L</span>
                  <span className={`font-mono-nums font-bold ${getFinancialColorClass(stat.totalPnL, settings.colorblind)}`}>
                    {formatCurrency(stat.totalPnL, settings.currency, settings.decimals)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
