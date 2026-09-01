import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, transactionsStore, EXCHANGE_RATE, cashBalancesStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import { getCssVar } from '../../lib/theme';
import { Scale, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import Chart from 'chart.js/auto';

const CATEGORIES = ['Stocks', 'Mutual Funds', 'ETFs', 'Crypto', 'Cash'];

export default function RebalancingAssistant() {
  const holdings = useStore(portfolioStore);
  const transactions = useStore(transactionsStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);
  const cashBalances = useStore(cashBalancesStore);

  // Targets state (defaults to 100% split)
  const [targets, setTargets] = useState<Record<string, number>>({
    'Stocks': 50,
    'Mutual Funds': 20,
    'ETFs': 15,
    'Crypto': 10,
    'Cash': 5
  });

  const chartBeforeRef = useRef<HTMLCanvasElement | null>(null);
  const chartAfterRef = useRef<HTMLCanvasElement | null>(null);

  // Calculate current values
  const categoryValues: Record<string, number> = {
    'Stocks': 0,
    'Mutual Funds': 0,
    'ETFs': 0,
    'Crypto': 0,
    'Cash': 0
  };

  let totalPortfolioValue = 0;

  // Calculate cash balance in settings.currency
  let cashValue = 0;
  if (settings.currency === 'USD') {
    cashValue = cashBalances.USD + (cashBalances.INR / EXCHANGE_RATE);
  } else if (settings.currency === 'INR') {
    cashValue = cashBalances.INR + (cashBalances.USD * EXCHANGE_RATE);
  } else {
    cashValue = cashBalances.USD + (cashBalances.INR / EXCHANGE_RATE);
  }

  // Add Cash as an asset class
  categoryValues['Cash'] = cashValue;
  totalPortfolioValue += cashValue;

  holdings.forEach(h => {
    const symbol = h.symbol.toUpperCase();
    const livePrice = prices[symbol]?.price ?? h.avgCost;
    let value = h.shares * livePrice;
    
    // Convert to global currency
    const isUS = h.market === 'US';
    const holdingCurrency = isUS ? 'USD' : 'INR';
    
    if (holdingCurrency !== settings.currency) {
      if (holdingCurrency === 'USD' && settings.currency === 'INR') {
        value = value * EXCHANGE_RATE;
      } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
        value = value / EXCHANGE_RATE;
      }
    }

    const cat = h.category || 'Stocks';
    if (categoryValues[cat] !== undefined) {
      categoryValues[cat] += value;
    } else {
      categoryValues['Stocks'] += value; // Default fallback
    }
    totalPortfolioValue += value;
  });

  // Calculate percentages and drift
  const currentPcts = CATEGORIES.map(cat => {
    return totalPortfolioValue > 0 ? (categoryValues[cat] / totalPortfolioValue) * 100 : 0;
  });

  const targetPcts = CATEGORIES.map(cat => targets[cat] || 0);
  const totalTarget = targetPcts.reduce((sum, val) => sum + val, 0);

  const driftData = CATEGORIES.map((cat, idx) => {
    const currentPct = currentPcts[idx];
    const targetPct = targetPcts[idx];
    const drift = currentPct - targetPct;
    
    const targetVal = totalPortfolioValue * (targetPct / 100);
    const currentVal = categoryValues[cat];
    const diffVal = targetVal - currentVal; // Positive means underweight (need to buy)

    let status: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'BALANCED' = 'BALANCED';
    if (drift > 1.5) status = 'OVERWEIGHT';
    else if (drift < -1.5) status = 'UNDERWEIGHT';

    return {
      category: cat,
      currentVal,
      currentPct,
      targetPct,
      drift,
      diffVal,
      status
    };
  });

  // Handle Target Changes
  const handleTargetChange = (category: string, value: string) => {
    const num = Math.min(100, Math.max(0, Number(value) || 0));
    setTargets(prev => ({
      ...prev,
      [category]: num
    }));
  };

  // Reset Targets
  const handleReset = () => {
    setTargets({
      'Stocks': 50,
      'Mutual Funds': 20,
      'ETFs': 15,
      'Crypto': 10,
      'Cash': 5
    });
  };

  // Render Charts
  useEffect(() => {
    if (chartBeforeRef.current && chartAfterRef.current) {
      const ctxBefore = chartBeforeRef.current.getContext('2d');
      const ctxAfter = chartAfterRef.current.getContext('2d');

      if (ctxBefore && ctxAfter) {
        // Destroy existing
        const chartB = Chart.getChart(chartBeforeRef.current);
        if (chartB) chartB.destroy();
        const chartA = Chart.getChart(chartAfterRef.current);
        if (chartA) chartA.destroy();

        const colors = ['#22C55E', '#10B981', '#EAB308', '#34D399', '#14B8A6'];
        const cardBg = getCssVar('--bg-card', '#11291D');

        new Chart(ctxBefore, {
          type: 'doughnut',
          data: {
            labels: CATEGORIES,
            datasets: [{
              data: currentPcts,
              backgroundColor: colors,
              borderWidth: 1,
              borderColor: cardBg
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            cutout: '70%'
          }
        });

        new Chart(ctxAfter, {
          type: 'doughnut',
          data: {
            labels: CATEGORIES,
            datasets: [{
              data: targetPcts,
              backgroundColor: colors,
              borderWidth: 1,
              borderColor: cardBg
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            cutout: '70%'
          }
        });
      }
    }
  }, [holdings, targets, settings.currency]);

  return (
    <div className="space-y-6">
      <div className="page-title-row">
        <h1 className="page-title flex items-center gap-2">
          <Scale className="text-accent" size={24} />
          <span>Category Rebalancing Assistant</span>
        </h1>
        <p className="page-subtitle">
          Define target allocations across asset categories. We calculate drifts and generate specific trade recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Target Inputs */}
        <div className="cyber-card p-5 space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider">[ Set Target Allocations ]</span>
            <button
              onClick={handleReset}
              className="text-[10px] text-accent hover:underline flex items-center gap-1 uppercase font-bold"
            >
              <RefreshCw size={10} />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-3">
            {CATEGORIES.map(cat => (
              <div key={cat} className="space-y-1 text-xs">
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>{cat.toUpperCase()}</span>
                  <span>{targets[cat]}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={targets[cat] || 0}
                    onChange={(e) => handleTargetChange(cat, e.target.value)}
                    className="rebalance-slider"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets[cat] || 0}
                    onChange={(e) => handleTargetChange(cat, e.target.value)}
                    className="w-12 bg-black/50 border border-white/[0.06] rounded p-1 text-right text-[11px] font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Validation Panel */}
          <div className={`p-3 border text-[10px] font-bold uppercase rounded-lg ${
            totalTarget === 100
              ? 'bg-gain/5 border-gain/25 text-gain'
              : 'bg-loss/5 border-loss/25 text-loss'
          }`}>
            <div className="flex justify-between">
              <span>Total Allocation:</span>
              <span>{totalTarget}%</span>
            </div>
            {totalTarget !== 100 && (
              <p className="font-normal font-sans normal-case text-[9px] mt-1 text-slate-400">
                Targets must add up to exactly 100% to calculate recommendations. Currently off by {100 - totalTarget}%.
              </p>
            )}
          </div>
        </div>

        {/* Center: Allocation Visuals (Before & After) */}
        <div className="cyber-card p-5 lg:col-span-2 space-y-4">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Allocation Comparison ]
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Before Chart */}
            <div className="flex flex-col items-center space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Allocation</span>
              <div className="h-44 w-full relative flex items-center justify-center">
                <canvas ref={chartBeforeRef} />
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Total</span>
                  <span className="text-sm font-bold text-white font-mono-nums">
                    {formatCurrency(totalPortfolioValue, settings.currency, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* After Chart */}
            <div className="flex flex-col items-center space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Allocation</span>
              <div className="h-44 w-full relative flex items-center justify-center">
                <canvas ref={chartAfterRef} />
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Target</span>
                  <span className="text-sm font-bold text-white font-mono-nums">100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drift & Recommendations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drift Table */}
        <div className="cyber-card p-5 lg:col-span-2 space-y-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Allocation Drift Audit ]
          </span>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-slate-400 border-b border-white/[0.04] text-[9px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Current Value</th>
                  <th className="pb-2 text-right">Current %</th>
                  <th className="pb-2 text-right">Target %</th>
                  <th className="pb-2 text-right">Drift</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {driftData.map(d => {
                  const isOver = d.drift > 1.5;
                  const isUnder = d.drift < -1.5;
                  const driftColor = isOver ? 'text-loss' : isUnder ? 'text-gain' : 'text-slate-400';
                  
                  return (
                    <tr key={d.category} className="hover:bg-white/[0.01]">
                      <td className="py-2.5 font-bold text-white">{d.category}</td>
                      <td className="py-2.5 text-right font-mono-nums">
                        {formatCurrency(d.currentVal, settings.currency, settings.decimals)}
                      </td>
                      <td className="py-2.5 text-right font-mono-nums">{d.currentPct.toFixed(1)}%</td>
                      <td className="py-2.5 text-right font-mono-nums">{d.targetPct.toFixed(1)}%</td>
                      <td className={`py-2.5 text-right font-mono-nums font-bold ${driftColor}`}>
                        {d.drift >= 0 ? '+' : ''}
                        {d.drift.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          d.status === 'OVERWEIGHT'
                            ? 'bg-loss/10 text-loss border border-loss/20'
                            : d.status === 'UNDERWEIGHT'
                              ? 'bg-gain/10 text-gain border border-gain/20'
                              : 'bg-slate-900 text-slate-400 border border-white/[0.08]'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actionable Recommendations */}
        <div className="cyber-card p-5 lg:col-span-1 space-y-3 flex flex-col">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Rebalance Recommendations ]
          </span>

          <div className="space-y-2 flex-1">
            {totalTarget !== 100 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                <span>[ Adjust targets to 100% to compile trade actions ]</span>
              </div>
            ) : driftData.every(d => d.status === 'BALANCED') ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gain text-xs space-y-2">
                <Sparkles size={20} className="animate-bounce" />
                <span className="font-bold uppercase">[ PORTFOLIO_BALANCED ]</span>
                <p className="text-[10px] text-slate-400 font-sans normal-case">
                  All category allocations are within 1.5% of targets. No rebalancing required.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {driftData
                  .filter(d => Math.abs(d.diffVal) > 10) // skip tiny adjustments
                  .sort((a, b) => b.diffVal - a.diffVal) // buys first
                  .map(d => {
                    const isBuy = d.diffVal > 0;
                    return (
                      <div
                        key={d.category}
                        className={`p-3 border rounded-lg flex items-center justify-between text-xs ${
                          isBuy
                            ? 'bg-gain/5 border-gain/15 text-gain'
                            : 'bg-loss/5 border-loss/15 text-loss'
                        }`}
                      >
                        <div>
                          <span className="font-bold uppercase block text-[10px] tracking-wide">
                            {isBuy ? 'BUY / INFLOW' : 'SELL / OUTFLOW'}
                          </span>
                          <span className="text-white font-bold">{d.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono-nums font-bold text-white block">
                            {formatCurrency(Math.abs(d.diffVal), settings.currency, 0)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-sans">
                            {isBuy ? 'Underweight' : 'Overweight'} by {Math.abs(d.drift).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
