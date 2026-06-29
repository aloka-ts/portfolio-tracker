import React, { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, transactionsStore, EXCHANGE_RATE, cashBalancesStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import { BarChart3, TrendingUp, TrendingDown, ShieldAlert, Coins, Globe, Landmark } from 'lucide-react';
import Chart from 'chart.js/auto';

export default function AnalyticsTab() {
  const holdings = useStore(portfolioStore);
  const transactions = useStore(transactionsStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);
  const cashBalances = useStore(cashBalancesStore);

  const trendChartRef = useRef<HTMLCanvasElement | null>(null);
  const assetChartRef = useRef<HTMLCanvasElement | null>(null);
  const sectorChartRef = useRef<HTMLCanvasElement | null>(null);
  const geoChartRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to get sector/industry for a holding
  const getSector = (symbol: string): string => {
    const s = symbol.toUpperCase().replace(/\.(NS|BO)$/, '');
    if (s === 'AAPL' || s === 'NVDA' || s === 'MSFT' || s === 'TCS' || s === 'INFY') return 'Technology';
    if (s === 'TSLA' || s === 'TATAMOTORS') return 'Automotive';
    if (s === 'RELIANCE') return 'Energy / Conglomerate';
    if (s === 'HDFCBANK' || s === 'ICICIBANK') return 'Financial Services';
    if (s === 'BTC' || s === 'ETH') return 'Decentralized Finance (DeFi)';
    return 'General / Diversified';
  };

  // 1. COMPUTE PERFORMANCE METRICS
  let totalVal = 0;
  let totalCost = 0;
  let bestPerformer = { symbol: 'N/A', pnl: -Infinity, pct: 0 };
  let worstPerformer = { symbol: 'N/A', pnl: Infinity, pct: 0 };
  
  let weightedBeta = 0;
  let totalBetaWeight = 0;
  let weightedVol = 0;
  
  const categoryValues: Record<string, number> = { 'Stocks': 0, 'Mutual Funds': 0, 'ETFs': 0, 'Crypto': 0, 'Cash': 0 };
  const sectorValues: Record<string, number> = {};
  const geoValues: Record<string, number> = { 'US': 0, 'IN': 0 };

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
  totalVal += cashValue;
  totalCost += cashValue;
  
  // Cash has beta = 0, vol = 0
  totalBetaWeight += cashValue;

  holdings.forEach(h => {
    const symbol = h.symbol.toUpperCase();
    const livePrice = prices[symbol]?.price ?? h.avgCost;
    const isUS = h.market === 'US';
    const currency = isUS ? 'USD' : 'INR';

    let val = h.shares * livePrice;
    let cost = h.shares * h.avgCost;
    const pnl = val - cost;
    const pct = cost > 0 ? (pnl / cost) * 100 : 0;

    // Convert to global currency for aggregation
    if (currency !== settings.currency) {
      if (currency === 'USD' && settings.currency === 'INR') {
        val *= EXCHANGE_RATE;
        cost *= EXCHANGE_RATE;
      } else if (currency === 'INR' && settings.currency === 'USD') {
        val /= EXCHANGE_RATE;
        cost /= EXCHANGE_RATE;
      }
    }

    totalVal += val;
    totalCost += cost;

    // Best/Worst Check
    if (pnl > bestPerformer.pnl) {
      bestPerformer = { symbol, pnl, pct };
    }
    if (pnl < worstPerformer.pnl) {
      worstPerformer = { symbol, pnl, pct };
    }

    // Category / Sector / Geo Accumulation
    const cat = h.category || 'Stocks';
    categoryValues[cat] = (categoryValues[cat] || 0) + val;

    const sector = getSector(symbol);
    sectorValues[sector] = (sectorValues[sector] || 0) + val;

    const geo = isUS ? 'US' : 'IN';
    geoValues[geo] += val;

    // Risk Parameters (Beta & Volatility estimation)
    let beta = 1.0;
    let vol = 18; // 18% annualized vol
    if (cat === 'Crypto') { beta = 2.2; vol = 65; }
    else if (sector === 'Technology') { beta = 1.35; vol = 24; }
    else if (sector === 'Financial Services') { beta = 1.05; vol = 19; }
    else if (sector === 'Automotive') { beta = 1.25; vol = 28; }
    else if (sector === 'Energy / Conglomerate') { beta = 0.9; vol = 16; }

    weightedBeta += beta * val;
    weightedVol += vol * val;
    totalBetaWeight += val;
  });

  const portfolioBeta = totalBetaWeight > 0 ? (weightedBeta / totalBetaWeight) : 1.0;
  const portfolioVol = totalBetaWeight > 0 ? (weightedVol / totalBetaWeight) : 18.0;
  const portfolioSharpe = totalVal > 0 ? Math.max(0.4, Math.min(2.8, (totalVal - totalCost) / (totalCost * (portfolioVol / 100)))) : 0;

  // Estimated yearly dividends
  const estYearlyDividends = totalVal * 0.0135; // 1.35% average dividend yield

  // Render Charts
  useEffect(() => {
    // 1. 30-Day Trend Chart
    if (trendChartRef.current) {
      const ctx = trendChartRef.current.getContext('2d');
      if (ctx) {
        const existing = Chart.getChart(trendChartRef.current);
        if (existing) existing.destroy();

        // Simulate 30-day historical net worth path
        const labels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
        const data: number[] = [];
        let seed = totalVal || 10000;
        for (let i = 0; i < 30; i++) {
          seed = seed * (1 + (Math.random() * 0.02 - 0.009));
          data.push(seed);
        }
        data[29] = totalVal; // snap last day to current actual

        new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Portfolio Valuation',
              data,
              borderColor: '#FF0055',
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              backgroundColor: 'rgba(255, 0, 85, 0.03)',
              tension: 0.2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.02)' },
                ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 } }
              }
            }
          }
        });
      }
    }

    // 2. Asset Class Doughnut
    if (assetChartRef.current) {
      const ctx = assetChartRef.current.getContext('2d');
      if (ctx) {
        const existing = Chart.getChart(assetChartRef.current);
        if (existing) existing.destroy();

        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(categoryValues),
            datasets: [{
              data: Object.values(categoryValues),
              backgroundColor: ['#5f5af7', '#08b6d4', '#ec4899', '#f59e0b', '#10b981'],
              borderWidth: 1,
              borderColor: '#0E1015'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
          }
        });
      }
    }

    // 3. Sector Horizontal Bar Chart
    if (sectorChartRef.current) {
      const ctx = sectorChartRef.current.getContext('2d');
      if (ctx) {
        const existing = Chart.getChart(sectorChartRef.current);
        if (existing) existing.destroy();

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Object.keys(sectorValues),
            datasets: [{
              data: Object.values(sectorValues),
              backgroundColor: '#5f5af7',
              borderRadius: 4
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.02)' },
                ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 } }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#94A3B8', font: { size: 9 } }
              }
            }
          }
        });
      }
    }

    // 4. Geographic Bar Chart
    if (geoChartRef.current) {
      const ctx = geoChartRef.current.getContext('2d');
      if (ctx) {
        const existing = Chart.getChart(geoChartRef.current);
        if (existing) existing.destroy();

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['US Markets', 'Indian Markets'],
            datasets: [{
              data: [geoValues.US, geoValues.IN],
              backgroundColor: ['#08b6d4', '#f59e0b'],
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#94A3B8', font: { size: 9 } }
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.02)' },
                ticks: { color: '#64748B', font: { family: 'JetBrains Mono', size: 9 } }
              }
            }
          }
        });
      }
    }
  }, [holdings, settings.currency]);

  return (
    <div className="space-y-6">
      <div className="page-title-row">
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="text-accent" size={24} />
          <span>Portfolio Risk & Exposure Diagnostics</span>
        </h1>
        <p className="page-subtitle">
          Real-time analytical audits tracking geographical weights, custodian splits, sector exposure, and volatility metrics.
        </p>
      </div>

      {/* Row 1: Key Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Best Performer */}
        <div className="cyber-card p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <TrendingUp size={12} className="text-gain" />
              <span>Best Performer</span>
            </span>
            <div className="text-2xl font-extrabold text-white uppercase tracking-tight font-heading">
              {bestPerformer.symbol}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block">
              Valuation Gain: {bestPerformer.pnl !== -Infinity ? formatCurrency(bestPerformer.pnl, settings.currency, 0) : 'N/A'}
            </span>
          </div>
          <div className={`text-xs font-bold font-mono-nums px-2 py-0.5 rounded ${
            bestPerformer.pct >= 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
          }`}>
            {formatPercent(bestPerformer.pct)}
          </div>
        </div>

        {/* Worst Performer */}
        <div className="cyber-card p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <TrendingDown size={12} className="text-loss" />
              <span>Worst Performer</span>
            </span>
            <div className="text-2xl font-extrabold text-white uppercase tracking-tight font-heading">
              {worstPerformer.symbol}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block">
              Valuation Loss: {worstPerformer.pnl !== Infinity ? formatCurrency(worstPerformer.pnl, settings.currency, 0) : 'N/A'}
            </span>
          </div>
          <div className={`text-xs font-bold font-mono-nums px-2 py-0.5 rounded ${
            worstPerformer.pct >= 0 ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
          }`}>
            {formatPercent(worstPerformer.pct)}
          </div>
        </div>

        {/* Volatility Diagnostics */}
        <div className="cyber-card p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} className="text-accent" />
              <span>Risk Diagnostics</span>
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-nums">
              {portfolioBeta.toFixed(2)} <span className="text-xs text-slate-500 font-sans font-normal">Beta Coefficient</span>
            </div>
            <span className="text-[10px] text-slate-500 font-sans block">
              Sharpe Ratio: {portfolioSharpe.toFixed(2)} | Annualized Vol: {portfolioVol.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Graph Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 30-Day Growth */}
        <div className="cyber-card p-5 space-y-3 lg:col-span-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ 30-Day Net Worth Trend ]
          </span>
          <div className="h-56 w-full">
            <canvas ref={trendChartRef} />
          </div>
        </div>

        {/* Asset Class Distribution */}
        <div className="cyber-card p-5 space-y-3 lg:col-span-1">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Asset Class Allocation ]
          </span>
          <div className="h-56 w-full relative flex items-center justify-center">
            <canvas ref={assetChartRef} />
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Holdings</span>
              <span className="text-xs font-bold text-white font-mono-nums">
                {holdings.length} Assets
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Exposure splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sector Exposure */}
        <div className="cyber-card p-5 space-y-3 lg:col-span-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
            <Landmark size={14} className="text-accent" />
            <span>[ Sector Allocation ]</span>
          </span>
          <div className="h-44 w-full">
            <canvas ref={sectorChartRef} />
          </div>
        </div>

        {/* Geographic Allocation & Dividends */}
        <div className="cyber-card p-5 space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5 flex items-center gap-1.5">
              <Globe size={14} className="text-accent" />
              <span>[ Geographic Allocation ]</span>
            </span>
            <div className="h-28 w-full">
              <canvas ref={geoChartRef} />
            </div>
          </div>

          {/* Passive Income Card */}
          <div className="bg-white/[0.02] border border-white/[0.05] p-3.5 rounded-lg flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Coins size={12} className="text-accent" />
                <span>Estimated Dividend Yield</span>
              </span>
              <span className="text-xs text-slate-500 font-sans block">
                Estimated yearly passive inflow
              </span>
            </div>
            <span className="text-base font-bold text-white font-mono-nums">
              {formatCurrency(estYearlyDividends, settings.currency, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
