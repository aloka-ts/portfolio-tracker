import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, transactionsStore, EXCHANGE_RATE } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import { getCssVar } from '../../lib/theme';
import { FlaskConical, Plus, Trash2, ArrowUpRight, ArrowDownRight, Sparkles, Target } from 'lucide-react';
import Chart from 'chart.js/auto';
import type { UserSettings } from '../../types';

// Goal / save-up planner: projects the (simulated) portfolio value forward
// with monthly contributions and compound growth until it crosses the target.
function GoalPlanner({ startValue, settings }: { startValue: number; settings: UserSettings }) {
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [annualReturn, setAnnualReturn] = useState('10');
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  const targetVal = Number(target) || 0;
  const monthlyVal = Number(monthly) || 0;
  const monthlyRate = (Number(annualReturn) || 0) / 100 / 12;

  // Iterate month-by-month, cap at 50 years
  let monthsToTarget: number | null = null;
  const series: number[] = [startValue];
  if (targetVal > startValue && (monthlyVal > 0 || monthlyRate > 0)) {
    let v = startValue;
    for (let m = 1; m <= 600; m++) {
      v = v * (1 + monthlyRate) + monthlyVal;
      series.push(v);
      if (v >= targetVal) {
        monthsToTarget = m;
        break;
      }
    }
  }

  const reachDate = (() => {
    if (monthsToTarget === null) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsToTarget);
    return d;
  })();

  const alreadyReached = targetVal > 0 && targetVal <= startValue;
  const unreachable = targetVal > startValue && monthsToTarget === null && (monthlyVal > 0 || monthlyRate > 0);

  useEffect(() => {
    if (!chartRef.current) return;
    const existing = Chart.getChart(chartRef.current);
    if (existing) existing.destroy();
    if (series.length < 2 || monthsToTarget === null) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const labels = series.map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    });

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Projected Value',
            data: series,
            borderColor: getCssVar('--color-accent', '#22C55E'),
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            fill: true,
            tension: 0.2,
          },
          {
            label: 'Target',
            data: series.map(() => targetVal),
            borderColor: getCssVar('--text-muted', '#94A3B8'),
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) =>
                `${context.dataset.label}: ${formatCurrency(context.parsed.y, settings.currency, 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: getCssVar('--text-muted', '#94A3B8'),
              font: { size: 9 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: getCssVar('--text-muted', '#94A3B8'), font: { size: 9 } },
          },
        },
      },
    });
  }, [target, monthly, annualReturn, startValue]);

  return (
    <div className="cyber-card p-5 space-y-4">
      <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
        <Target size={14} className="text-accent" />
        <span>[ Goal / Save-Up Planner ]</span>
      </span>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Target Amount ({settings.currency})</label>
          <input
            type="number"
            min="0"
            placeholder={`e.g. ${Math.round(startValue * 2)}`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Monthly Contribution ({settings.currency})</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 25000"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent placeholder:text-slate-600"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] uppercase font-bold text-slate-400">Expected Annual Return (%)</label>
          <input
            type="number"
            step="0.5"
            value={annualReturn}
            onChange={(e) => setAnnualReturn(e.target.value)}
            className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {alreadyReached && (
        <div className="p-2.5 bg-gain/5 border border-gain/20 text-gain text-[10px] rounded-lg">
          Target already reached — your simulated portfolio is worth {formatCurrency(startValue, settings.currency, 0)}.
        </div>
      )}
      {unreachable && (
        <div className="p-2.5 bg-warning/5 border border-warning/20 text-warning text-[10px] rounded-lg">
          Target not reachable within 50 years at these inputs. Increase the contribution or expected return.
        </div>
      )}
      {monthsToTarget !== null && reachDate && (
        <div className="p-2.5 bg-accent/5 border border-accent/20 text-[10px] rounded-lg text-slate-300">
          You would reach{' '}
          <span className="font-bold text-white font-mono-nums">{formatCurrency(targetVal, settings.currency, 0)}</span> around{' '}
          <span className="font-bold text-accent">
            {reachDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>{' '}
          ({Math.floor(monthsToTarget / 12) > 0 ? `${Math.floor(monthsToTarget / 12)}y ` : ''}
          {monthsToTarget % 12}m), starting from the simulated value above.
        </div>
      )}

      {monthsToTarget !== null && (
        <div className="h-44 w-full">
          <canvas ref={chartRef} />
        </div>
      )}
    </div>
  );
}

interface Hypothesis {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL' | 'PRICE_SHIFT';
  quantity?: number;
  price?: number;
  percentage?: number; // for price shifts, e.g. +20 or -15
  name?: string; // for new assets
  category?: string;
  market?: 'US' | 'IN';
}

export default function WhatIfSimulator() {
  const holdings = useStore(portfolioStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);

  // Active sandbox scenarios
  const [scenarios, setScenarios] = useState<Hypothesis[]>([]);

  // Form states
  const [ticker, setTicker] = useState('');
  const [actionType, setActionType] = useState<'BUY' | 'SELL' | 'PRICE_SHIFT'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [percentage, setPercentage] = useState('10');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Stocks');
  const [market, setMarket] = useState<'US' | 'IN'>('US');

  const [isNewTicker, setIsNewTicker] = useState(false);
  const [formError, setFormError] = useState('');

  // Auto-fill and check if ticker is new
  useEffect(() => {
    const t = ticker.trim().toUpperCase();
    if (!t) {
      setIsNewTicker(false);
      setName('');
      return;
    }

    const exists = holdings.some(h => h.symbol.toUpperCase() === t);
    setIsNewTicker(!exists);

    if (t === 'AAPL') { setName('Apple Inc.'); setMarket('US'); setCategory('Stocks'); setPrice(prices['AAPL']?.price.toString() || '180'); }
    else if (t === 'NVDA') { setName('NVIDIA Corporation'); setMarket('US'); setCategory('Stocks'); setPrice(prices['NVDA']?.price.toString() || '700'); }
    else if (t === 'TSLA') { setName('Tesla Inc.'); setMarket('US'); setCategory('Stocks'); setPrice(prices['TSLA']?.price.toString() || '190'); }
    else if (t === 'RELIANCE.NS') { setName('Reliance Industries Ltd.'); setMarket('IN'); setCategory('Stocks'); setPrice(prices['RELIANCE.NS']?.price.toString() || '2900'); }
    else if (t === 'TCS.NS') { setName('Tata Consultancy Services Ltd.'); setMarket('IN'); setCategory('Stocks'); setPrice(prices['TCS.NS']?.price.toString() || '4000'); }
    else {
      // Set price based on priceStore if exists
      const existingPrice = prices[t]?.price;
      if (existingPrice) {
        setPrice(existingPrice.toString());
      } else {
        setPrice('');
      }
    }
  }, [ticker]);

  // Handle adding scenario
  const handleAddScenario = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const t = ticker.trim().toUpperCase();
    if (!t) {
      setFormError('Ticker symbol is required');
      return;
    }

    const newScenario: Hypothesis = {
      id: `hypo-${Date.now()}`,
      ticker: t,
      type: actionType
    };

    if (actionType === 'PRICE_SHIFT') {
      const pct = Number(percentage);
      if (isNaN(pct) || pct === 0) {
        setFormError('Percentage shift must be a non-zero number');
        return;
      }
      newScenario.percentage = pct;
    } else {
      const qty = Number(quantity);
      if (isNaN(qty) || qty <= 0) {
        setFormError('Quantity must be greater than 0');
        return;
      }
      const prc = Number(price);
      if (isNaN(prc) || prc <= 0) {
        setFormError('Price must be greater than 0');
        return;
      }

      newScenario.quantity = qty;
      newScenario.price = prc;

      if (isNewTicker) {
        newScenario.name = name.trim() || `${t} Corporation`;
        newScenario.category = category;
        newScenario.market = market;
      }

      // If sell, check if we own enough
      if (actionType === 'SELL') {
        const existing = holdings.find(h => h.symbol.toUpperCase() === t);
        const owned = existing ? existing.shares : 0;
        if (qty > owned) {
          setFormError(`Cannot sell ${qty} shares. You only own ${owned.toFixed(2)} shares.`);
          return;
        }
      }
    }

    setScenarios(prev => [...prev, newScenario]);
    // Reset form
    setTicker('');
    setQuantity('');
    setPrice('');
    setName('');
    setFormError('');
  };

  const handleDeleteScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAll = () => {
    setScenarios([]);
  };

  // 1. CALCULATE ACTUAL PORTFOLIO VALUE (Before)
  let actualValue = 0;
  let actualCost = 0;

  holdings.forEach(h => {
    const symbol = h.symbol.toUpperCase();
    const isUS = h.market === 'US';
    const holdingCurrency = isUS ? 'USD' : 'INR';
    const livePrice = prices[symbol]?.price ?? h.avgCost;

    let val = h.shares * livePrice;
    let cost = h.shares * h.avgCost;

    // Convert to global currency
    if (holdingCurrency !== settings.currency) {
      if (holdingCurrency === 'USD' && settings.currency === 'INR') {
        val *= EXCHANGE_RATE;
        cost *= EXCHANGE_RATE;
      } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
        val /= EXCHANGE_RATE;
        cost /= EXCHANGE_RATE;
      }
    }

    actualValue += val;
    actualCost += cost;
  });

  const actualPnL = actualValue - actualCost;
  const actualPnLPercent = actualCost > 0 ? (actualPnL / actualCost) * 100 : 0;

  // 2. CALCULATE SIMULATED PORTFOLIO VALUE (After)
  const simPrices = { ...prices };
  const simHoldingsMap: Record<string, {
    symbol: string;
    shares: number;
    avgCost: number;
    companyName: string;
    category: string;
    market: 'US' | 'IN';
  }> = {};

  holdings.forEach(h => {
    const symbol = h.symbol.toUpperCase();
    
    simHoldingsMap[symbol] = {
      symbol,
      shares: h.shares,
      avgCost: h.avgCost,
      companyName: h.companyName || symbol,
      category: h.category || 'Stocks',
      market: h.market || 'US'
    };
  });

  // Apply scenarios in order
  scenarios.forEach(sc => {
    const symbol = sc.ticker.toUpperCase();
    
    if (sc.type === 'PRICE_SHIFT') {
      const basePrice = simPrices[symbol]?.price ?? (simHoldingsMap[symbol]?.avgCost || 100);
      const shift = sc.percentage || 0;
      simPrices[symbol] = {
        symbol,
        price: basePrice * (1 + shift / 100),
        change24h: 0,
        sparkline: []
      };
    } else if (sc.type === 'BUY') {
      const qty = sc.quantity || 0;
      const prc = sc.price || 0;
      const existing = simHoldingsMap[symbol];
      const isUS = existing ? (existing.market === 'US') : (sc.market === 'US' || (!symbol.endsWith('.NS') && !symbol.endsWith('.BO')));

      if (existing) {
        const totalShares = existing.shares + qty;
        const avgCost = ((existing.shares * existing.avgCost) + (qty * prc)) / totalShares;
        simHoldingsMap[symbol] = {
          ...existing,
          shares: totalShares,
          avgCost
        };
      } else {
        simHoldingsMap[symbol] = {
          symbol,
          shares: qty,
          avgCost: prc,
          companyName: sc.name || symbol,
          category: sc.category || 'Stocks',
          market: sc.market || (isUS ? 'US' : 'IN')
        };
      }
    } else if (sc.type === 'SELL') {
      const qty = sc.quantity || 0;
      if (simHoldingsMap[symbol]) {
        const exist = simHoldingsMap[symbol];
        exist.shares = Math.max(0, exist.shares - qty);
        if (exist.shares === 0) {
          delete simHoldingsMap[symbol];
        }
      }
    }
  });

  let simValue = 0;
  let simCost = 0;

  const simHoldingsList = Object.values(simHoldingsMap);

  simHoldingsList.forEach(sh => {
    const symbol = sh.symbol.toUpperCase();
    const livePrice = simPrices[symbol]?.price ?? sh.avgCost;
    const holdingCurrency = sh.market === 'US' ? 'USD' : 'INR';

    let val = sh.shares * livePrice;
    let cost = sh.shares * sh.avgCost;

    // Convert to global currency
    if (holdingCurrency !== settings.currency) {
      if (holdingCurrency === 'USD' && settings.currency === 'INR') {
        val *= EXCHANGE_RATE;
        cost *= EXCHANGE_RATE;
      } else if (holdingCurrency === 'INR' && settings.currency === 'USD') {
        val /= EXCHANGE_RATE;
        cost /= EXCHANGE_RATE;
      }
    }

    simValue += val;
    simCost += cost;
  });

  const simPnL = simValue - simCost;
  const simPnLPercent = simCost > 0 ? (simPnL / simCost) * 100 : 0;

  // Deltas
  const deltaValue = simValue - actualValue;
  const deltaValuePercent = actualValue > 0 ? (deltaValue / actualValue) * 100 : 0;

  const deltaPnL = simPnL - actualPnL;

  return (
    <div className="space-y-6">
      <div className="page-title-row">
        <h1 className="page-title flex items-center gap-2">
          <FlaskConical className="text-accent" size={24} />
          <span>What-If Sandbox Simulator</span>
        </h1>
        <p className="page-subtitle">
          Test hypothetical investment actions or market fluctuations. Review Simulated Net Worth and allocation shifts.
        </p>
      </div>

      {/* Deltas & Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Actual vs Simulated Value */}
        <div className="cyber-card p-5 space-y-2">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Simulated Net Worth</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white font-mono-nums">
              {formatCurrency(simValue, settings.currency, 0)}
            </span>
            <span className={`text-xs font-bold font-mono-nums ${
              deltaValue >= 0 ? 'text-gain' : 'text-loss'
            }`}>
              {deltaValue >= 0 ? '+' : ''}
              {formatCurrency(deltaValue, settings.currency, 0)} ({deltaValuePercent >= 0 ? '+' : ''}
              {deltaValuePercent.toFixed(1)}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans">
            Baseline Actual: {formatCurrency(actualValue, settings.currency, 0)}
          </div>
        </div>

        {/* Simulated P&L */}
        <div className="cyber-card p-5 space-y-2">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Simulated Profit / Loss</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-extrabold font-mono-nums ${
              simPnL >= 0 ? 'text-gain' : 'text-loss'
            }`}>
              {formatCurrency(simPnL, settings.currency, 0)}
            </span>
            <span className="text-xs text-slate-300 font-semibold font-mono-nums">
              {formatPercent(simPnLPercent)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans">
            Delta: {deltaPnL >= 0 ? '+' : ''}
            {formatCurrency(deltaPnL, settings.currency, 0)} vs Actual
          </div>
        </div>

        {/* Active Hypothesis Count */}
        <div className="cyber-card p-5 space-y-2 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Hypothesis Stack</span>
            {scenarios.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[9px] text-accent hover:underline uppercase font-bold"
              >
                Clear Stack
              </button>
            )}
          </div>
          <div className="text-2xl font-extrabold text-white font-mono-nums">
            {scenarios.length} <span className="text-xs text-slate-500 font-sans font-normal">Active Scenarios</span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans">
            Simulation runs completely in browser memory.
          </div>
        </div>
      </div>

      {/* Goal planner projects from the simulated value, so scenarios feed it */}
      <GoalPlanner startValue={simValue} settings={settings} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form & Active Scenarios */}
        <div className="lg:col-span-1 space-y-6">
          {/* Add Scenario Form */}
          <div className="cyber-card p-5 space-y-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
              [ Build Hypothesis ]
            </span>

            {formError && (
              <div className="p-2.5 bg-loss/5 border border-loss/20 text-loss text-[10px] rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddScenario} className="space-y-3 text-xs">
              {/* Action type */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
                >
                  <option value="BUY">BUY SHARES</option>
                  <option value="SELL">SELL SHARES</option>
                  <option value="PRICE_SHIFT">PRICE SHIFT (%)</option>
                </select>
              </div>

              {/* Ticker */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400">Ticker Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. AAPL, RELIANCE.NS"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent uppercase"
                />
              </div>

              {/* Conditional Inputs */}
              {actionType === 'PRICE_SHIFT' ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>PERCENTAGE SHIFT</span>
                    <span className={Number(percentage) >= 0 ? 'text-gain' : 'text-loss'}>
                      {Number(percentage) >= 0 ? '+' : ''}
                      {percentage}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      className="rebalance-slider"
                    />
                    <input
                      type="number"
                      min="-100"
                      max="1000"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      className="w-14 bg-navy-900 border border-white/[0.06] rounded p-1 text-right text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Shares Quantity</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Price per Share</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* New Asset Details */}
                  {isNewTicker && actionType === 'BUY' && (
                    <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg space-y-3 animate-slide-up">
                      <span className="text-[9px] uppercase font-bold text-accent block">[ NEW_ASSET_DETECTED ]</span>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase font-bold text-slate-400">Asset Full Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Nvidia Corp"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-black/40 border border-white/[0.06] rounded p-1.5 text-white focus:outline-none text-[11px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase font-bold text-slate-400">Category</label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="w-full bg-black/40 border border-white/[0.06] rounded p-1.5 text-white focus:outline-none text-[11px]"
                            >
                              <option value="Stocks">Stocks</option>
                              <option value="Mutual Funds">Mutual Funds</option>
                              <option value="ETFs">ETFs</option>
                              <option value="Crypto">Crypto</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] uppercase font-bold text-slate-400">Market</label>
                            <select
                              value={market}
                              onChange={(e) => setMarket(e.target.value as any)}
                              className="w-full bg-black/40 border border-white/[0.06] rounded p-1.5 text-white focus:outline-none text-[11px]"
                            >
                              <option value="US">US Market</option>
                              <option value="IN">India NSE</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-accent hover:bg-accent/90 text-white font-bold tracking-wider rounded-lg transition uppercase mt-2"
              >
                Add Hypothesis Scenario
              </button>
            </form>
          </div>

          {/* Scenario Stack List */}
          <div className="cyber-card p-5 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
              [ Hypothesis Stack ]
            </span>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {scenarios.map(sc => {
                const isPriceShift = sc.type === 'PRICE_SHIFT';
                const isBuy = sc.type === 'BUY';
                return (
                  <div
                    key={sc.id}
                    className="p-2.5 bg-black/40 border border-white/[0.06] rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white uppercase tracking-wide">{sc.ticker}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          isPriceShift
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : isBuy
                              ? 'bg-gain/10 text-gain border border-gain/20'
                              : 'bg-loss/10 text-loss border border-loss/20'
                        }`}>
                          {sc.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-sans block mt-1">
                        {isPriceShift
                          ? `Price shift of ${sc.percentage}%`
                          : `${sc.quantity} shares at ${formatCurrency(sc.price || 0, sc.market === 'IN' ? 'INR' : 'USD', 2)}`}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteScenario(sc.id)}
                      className="p-1 text-slate-500 hover:text-loss transition"
                      title="Remove hypothesis"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}

              {scenarios.length === 0 && (
                <div className="py-8 text-center text-slate-600 text-[11px] font-sans">
                  No active scenarios. Use the form above to add a hypothesis.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Simulated Holdings List */}
        <div className="lg:col-span-2 cyber-card p-5 space-y-4">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Hypothetical Holdings Comparison ]
          </span>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-slate-400 border-b border-white/[0.04] text-[9px] uppercase tracking-wider font-bold">
                <tr>
                  <th>Ticker</th>
                  <th className="text-right">Simulated Shares</th>
                  <th className="text-right">Simulated Cost Basis</th>
                  <th className="text-right">Simulated Price</th>
                  <th className="text-right">Simulated Value</th>
                  <th className="text-right">Simulated P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {simHoldingsList.map(sh => {
                  const symbol = sh.symbol.toUpperCase();
                  const livePrice = simPrices[symbol]?.price ?? sh.avgCost;
                  const value = sh.shares * livePrice;
                  const cost = sh.shares * sh.avgCost;
                  const pnl = value - cost;
                  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                  const currency = sh.market === 'US' ? 'USD' : 'INR';

                  // Compare with actual holding
                  const actual = holdings.find(h => h.symbol.toUpperCase() === symbol);
                  const hasChanged = !actual || actual.shares !== sh.shares || (prices[symbol]?.price !== livePrice);

                  return (
                    <tr
                      key={symbol}
                      className={`hover:bg-white/[0.01] ${
                        hasChanged ? 'bg-accent/5 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 font-bold text-white">
                        <div>{symbol}</div>
                        {hasChanged && (
                          <span className="text-[8px] bg-accent/20 text-accent px-1 rounded font-normal uppercase">
                            Simulated Change
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono-nums">
                        {sh.shares.toFixed(3).replace(/\.?0+$/, '')}
                      </td>
                      <td className="py-2.5 text-right font-mono-nums">
                        {formatCurrency(cost, currency, settings.decimals)}
                      </td>
                      <td className="py-2.5 text-right font-mono-nums text-white">
                        {formatCurrency(livePrice, currency, settings.decimals)}
                      </td>
                      <td className="py-2.5 text-right font-mono-nums text-white">
                        {formatCurrency(value, currency, settings.decimals)}
                      </td>
                      <td className={`py-2.5 text-right font-mono-nums font-bold ${
                        pnl >= 0 ? 'text-gain' : 'text-loss'
                      }`}>
                        <div>{formatCurrency(pnl, currency, settings.decimals)}</div>
                        <div className="text-[9px] font-sans font-normal opacity-80 mt-0.5">
                          {formatPercent(pnlPercent)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {simHoldingsList.length === 0 && (
            <div className="p-8 text-center text-slate-600 text-xs">
              [ NO HOLDINGS TO SIMULATE ]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
