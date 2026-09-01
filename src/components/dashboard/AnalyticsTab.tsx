import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, transactionsStore, EXCHANGE_RATE, cashBalancesStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import { themeTickStore, getChartPalette, getCssVar } from '../../lib/theme';
import { BarChart3, TrendingUp, TrendingDown, ShieldAlert, Coins, Globe, Landmark } from 'lucide-react';
import Chart from 'chart.js/auto';
import { TaxInsightsCard } from './TaxInsightsCard';

// Benchmark indices for the trend chart overlay
const BENCHMARKS: Record<string, string> = {
  '^NSEI': 'NIFTY 50',
  '^GSPC': 'S&P 500',
};

// Trend timeframes -> /api/history range keys
const TIMEFRAMES: { id: string; range: string }[] = [
  { id: '1D', range: '1d' },
  { id: '1W', range: '5d' },
  { id: '1M', range: '1mo' },
  { id: '3M', range: '3mo' },
  { id: '6M', range: '6mo' },
  { id: '1Y', range: '1y' },
  { id: '3Y', range: '3y' },
];

interface HistorySeries {
  timestamps: number[];
  closes: (number | null)[];
}

export default function AnalyticsTab() {
  const holdings = useStore(portfolioStore);
  const transactions = useStore(transactionsStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);
  const cashBalances = useStore(cashBalancesStore);
  const themeTick = useStore(themeTickStore);

  // Benchmark overlay: default to NIFTY 50 (INR is the default base currency)
  const [benchmark, setBenchmark] = useState<string>('^NSEI');
  const [timeframe, setTimeframe] = useState<string>('1M');
  const [histories, setHistories] = useState<Record<string, HistorySeries>>({});
  const [benchLive, setBenchLive] = useState<number | null>(null);

  const uniqueSymbols = Array.from(new Set(holdings.map(h => h.symbol.toUpperCase()))).sort();
  const symbolsKey = uniqueSymbols.join(',');

  // Fetch real historical closes for every held/traded symbol + the benchmark
  useEffect(() => {
    const range = (TIMEFRAMES.find(t => t.id === timeframe) || TIMEFRAMES[2]).range;
    const wanted = benchmark !== 'none' ? [...uniqueSymbols, benchmark] : uniqueSymbols;
    if (wanted.length === 0) {
      setHistories({});
      return;
    }
    let cancelled = false;

    // Live benchmark quote so the chart's "now" point is real-time
    if (benchmark !== 'none') {
      fetch(`/api/prices?symbols=${encodeURIComponent(benchmark)}&provider=yahoo`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled) {
            const p = d?.[benchmark]?.price;
            setBenchLive(typeof p === 'number' ? p : null);
          }
        })
        .catch(() => {});
    } else {
      setBenchLive(null);
    }

    Promise.all(
      wanted.map(s =>
        fetch(`/api/history?symbol=${encodeURIComponent(s)}&range=${range}`)
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      if (cancelled) return;
      const map: Record<string, HistorySeries> = {};
      results.forEach((d, i) => {
        if (d && Array.isArray(d.timestamps) && d.timestamps.length >= 2) {
          map[wanted[i]] = { timestamps: d.timestamps, closes: d.closes };
        }
      });
      setHistories(map);
    });
    return () => {
      cancelled = true;
    };
  }, [timeframe, symbolsKey, benchmark]);

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

  // Actual dividend income recorded via DIVIDEND transactions (in base currency)
  const actualDividends = transactions
    .filter(tx => tx.type === 'DIVIDEND')
    .reduce((sum, tx) => {
      let amount = tx.quantity * tx.price - tx.fees;
      const txCurrency = tx.market === 'US' ? 'USD' : 'INR';
      if (txCurrency === 'USD' && settings.currency === 'INR') {
        amount *= EXCHANGE_RATE;
      } else if (txCurrency === 'INR' && settings.currency === 'USD') {
        amount /= EXCHANGE_RATE;
      }
      return sum + amount;
    }, 0);

  // 2. COMPUTE PORTFOLIO PERFORMANCE FROM REAL CLOSES
  // Backtests the CURRENT holdings (constant share counts) against real
  // historical closes. Bulk-imported portfolios carry the upload date on
  // every BUY, so replaying transaction dates showed cash-only until the
  // import day; a constant-shares backtest matches what "performance over
  // this window" actually means. Cash is excluded so a large idle balance
  // can't flatten the line.
  const getTrend = () => {
    const labels: string[] = [];
    const data: number[] = [];

    const formatAxisLabel = (t: number) => {
      const d = new Date(t * 1000);
      if (timeframe === '1D') {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      if (timeframe === '1W') {
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
      }
      if (timeframe === '1Y' || timeframe === '3Y') {
        return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const holdingSeries = uniqueSymbols.map(s => histories[s]).filter(Boolean);
    if (holdingSeries.length === 0) return { labels, data, bench: null };

    // Union of every series' timestamps (incl. benchmark) so each line keeps
    // its own market-hours shape — sampling one symbol's calendar flattened
    // the others (NSE and US trading hours barely overlap).
    const bh = benchmark !== 'none' ? histories[benchmark] : null;
    const axisSource = bh ? [...holdingSeries, bh] : holdingSeries;
    let axis = Array.from(new Set(axisSource.flatMap(h => h.timestamps))).sort((a, b) => a - b);

    // Clip to the selected window (the MF NAV series can carry older points)
    const WINDOW_SECONDS: Record<string, number> = {
      '1D': 1.5 * 86400, '1W': 8 * 86400, '1M': 32 * 86400, '3M': 95 * 86400,
      '6M': 185 * 86400, '1Y': 370 * 86400, '3Y': 1100 * 86400,
    };
    const nowSec = Math.floor(Date.now() / 1000);
    const windowed = axis.filter(t => t >= nowSec - (WINDOW_SECONDS[timeframe] ?? 32 * 86400));
    axis = windowed.length >= 2 ? windowed : axis.slice(-30);

    const MAX_POINTS = 160;
    if (axis.length > MAX_POINTS) {
      const step = Math.ceil(axis.length / MAX_POINTS);
      axis = axis.filter((_, i) => i % step === 0 || i === axis.length - 1);
    }

    // Append a live "now" point so both lines end at the current valuation
    let appendedNow = false;
    if (axis.length > 0 && nowSec > axis[axis.length - 1]) {
      axis = [...axis, nowSec];
      appendedNow = true;
    }

    // Forward-fill helper: last known close at or before t (backfills with the
    // first close for points before a series starts)
    const lastSeen: Record<string, number> = {};
    const cursor: Record<string, number> = {};
    const closeAt = (sym: string, t: number): number | null => {
      const h = histories[sym];
      if (!h) return null;
      let i = cursor[sym] ?? 0;
      while (i < h.timestamps.length && h.timestamps[i] <= t) {
        const c = h.closes[i];
        if (typeof c === 'number') lastSeen[sym] = c;
        i++;
      }
      cursor[sym] = i;
      if (lastSeen[sym] !== undefined) return lastSeen[sym];
      const first = h.closes.find(c => typeof c === 'number');
      return typeof first === 'number' ? first : null;
    };

    axis.forEach(t => {
      const isNow = appendedNow && t === nowSec;

      let holdingsVal = 0;
      holdings.forEach(h => {
        const ticker = h.symbol.toUpperCase();
        // Live quote at the "now" point; ponytail: no-history symbols held at live price
        const live = prices[ticker]?.price;
        const priceOnDay = isNow
          ? (live ?? closeAt(ticker, t) ?? 0)
          : (closeAt(ticker, t) ?? live ?? 0);
        let assetVal = h.shares * priceOnDay;

        const holdingCurrency = h.market === 'US' ? 'USD' : 'INR';
        if (holdingCurrency !== settings.currency) {
          if (holdingCurrency === 'USD' && settings.currency === 'INR') {
            assetVal *= EXCHANGE_RATE;
          } else {
            assetVal /= EXCHANGE_RATE;
          }
        }
        holdingsVal += assetVal;
      });

      labels.push(isNow ? 'Now' : formatAxisLabel(t));
      data.push(holdingsVal);
    });

    // Benchmark forward-filled onto the same axis, rebased to the portfolio's
    // starting value so the gap reads as relative performance
    let bench: number[] | null = null;
    if (bh && data.length > 0 && data[0] > 0) {
      let bi = 0;
      let bLast: number | null = null;
      const raw = axis.map(t => {
        if (appendedNow && t === nowSec && typeof benchLive === 'number') {
          return benchLive;
        }
        while (bi < bh.timestamps.length && bh.timestamps[bi] <= t) {
          const c = bh.closes[bi];
          if (typeof c === 'number') bLast = c;
          bi++;
        }
        return bLast;
      });
      const base = raw.find(v => v !== null);
      if (base) {
        bench = raw.map(v => data[0] * (((v ?? base) as number) / (base as number)));
      }
    }

    return { labels, data, bench };
  };

  const { labels: trendLabels, data: trendData, bench: benchmarkSeries } = getTrend();

  // 3. TOP ASSET CONTRIBUTORS FOR TREND GRAPH DESCRIPTION
  const topAssets = [...holdings]
    .map(h => {
      const symbol = h.symbol.toUpperCase();
      const livePrice = prices[symbol]?.price ?? h.avgCost;
      let val = h.shares * livePrice;
      const isUS = h.market === 'US';
      const currency = isUS ? 'USD' : 'INR';
      if (currency !== settings.currency) {
        if (currency === 'USD' && settings.currency === 'INR') {
          val *= EXCHANGE_RATE;
        } else {
          val /= EXCHANGE_RATE;
        }
      }
      return {
        symbol,
        name: h.companyName || symbol,
        value: val,
        weight: totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : '0'
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  // Trend chart: updates in place so timeframe/benchmark/live-price changes
  // morph smoothly instead of destroying and rebuilding the chart.
  useEffect(() => {
    if (trendChartRef.current) {
      const ctx = trendChartRef.current.getContext('2d');
      if (ctx) {
        const existing = Chart.getChart(trendChartRef.current);
        // Recreate only when styling context changes; otherwise morph data
        const metaKey = `${themeTick}:${settings.currency}:${benchmarkSeries ? 2 : 1}`;
        if (existing && (existing as any).$wfMetaKey === metaKey) {
          existing.data.labels = trendLabels;
          existing.data.datasets[0].data = trendData;
          if (benchmarkSeries && existing.data.datasets[1]) {
            existing.data.datasets[1].data = benchmarkSeries;
            existing.data.datasets[1].label = `${BENCHMARKS[benchmark] || benchmark} (indexed)`;
          }
          existing.update();
          return;
        }
        if (existing) existing.destroy();

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(74, 222, 128, 0.06)' : 'rgba(0, 0, 0, 0.04)';
        const textColor = isDark ? '#86EFAC' : '#3D6652';

        const strokeGradient = ctx.createLinearGradient(0, 0, ctx.canvas.width || 600, 0);
        strokeGradient.addColorStop(0, '#22C55E'); // emerald leaf
        strokeGradient.addColorStop(0.5, '#10B981'); // jade mint
        strokeGradient.addColorStop(1, '#EAB308'); // warm gold

        const fillGradient = ctx.createLinearGradient(0, 0, 0, 220);
        fillGradient.addColorStop(0, isDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.18)');
        fillGradient.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

        const datasets: any[] = [{
          label: 'Portfolio Holdings Value',
          data: trendData,
          borderColor: strokeGradient,
          borderWidth: 2.5,
          pointBackgroundColor: '#22C55E',
          pointBorderColor: isDark ? '#11291D' : '#FFFFFF',
          pointHoverBackgroundColor: '#4ADE80',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverRadius: 5,
          pointHoverBorderWidth: 1.5,
          pointRadius: 0,
          pointHitRadius: 8,
          fill: true,
          backgroundColor: fillGradient,
          tension: 0.25
        }];

        if (benchmarkSeries) {
          datasets.push({
            label: `${BENCHMARKS[benchmark] || benchmark} (indexed)`,
            data: benchmarkSeries,
            borderColor: textColor,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHitRadius: 8,
            fill: false,
            tension: 0.25
          });
        }

        const trendChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'nearest',
              axis: 'x',
              intersect: false
            },
            plugins: { 
              legend: { display: false },
              tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                backgroundColor: isDark ? '#11291D' : '#FFFFFF',
                titleColor: isDark ? '#F0FDF4' : '#0B2418',
                bodyColor: isDark ? '#86EFAC' : '#3D6652',
                borderColor: isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(11, 36, 24, 0.08)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                  label: function(context: any) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += formatCurrency(context.parsed.y, settings.currency, 0);
                    }
                    return label;
                  }
                }
              }
            },
            animation: {
              duration: 1000,
              easing: 'easeInOutQuart'
            },
            scales: {
              x: { 
                display: true,
                grid: { display: false },
                ticks: {
                  color: textColor,
                  font: {
                    family: 'system-ui, -apple-system, sans-serif',
                    size: 9,
                    weight: '500'
                  },
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 6
                }
              },
              y: {
                grid: { color: gridColor },
                ticks: { 
                  color: textColor, 
                  font: { family: 'system-ui, -apple-system, sans-serif', size: 9 },
                  callback: function(value: any) {
                    if (settings.currency === 'INR') {
                      if (value >= 10000000) return (value / 10000000).toFixed(1) + ' Cr';
                      if (value >= 100000) return (value / 100000).toFixed(1) + ' L';
                      if (value >= 1000) return (value / 1000).toFixed(0) + ' k';
                    } else {
                      if (value >= 1000000) return (value / 1000000).toFixed(1) + ' M';
                      if (value >= 1000) return (value / 1000).toFixed(0) + ' k';
                    }
                    return value;
                  }
                }
              }
            }
          }
        });
        (trendChart as any).$wfMetaKey = metaKey;
      }
    }
  }, [holdings, settings.currency, histories, timeframe, benchmark, themeTick, prices, benchLive]);

  // Allocation / sector / geo charts (rebuilt on data or theme change only —
  // deliberately excludes the 5s price poll to avoid flicker)
  useEffect(() => {
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
              backgroundColor: getChartPalette(settings.colorblind).slice(0, Object.keys(categoryValues).length),
              borderWidth: 1,
              borderColor: getCssVar('--bg-card', '#11291D')
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
              backgroundColor: getChartPalette(settings.colorblind)[3],
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
              backgroundColor: [getChartPalette(settings.colorblind)[1], getChartPalette(settings.colorblind)[4]],
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
  }, [holdings, settings.currency, settings.colorblind, themeTick]);

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
          <div className="border-b border-white/[0.04] pb-2.5 flex flex-col md:flex-row md:items-center justify-between gap-1">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              [ Portfolio Performance ({settings.currency}) ]
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeframe(tf.id)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors duration-150 ${
                      timeframe === tf.id
                        ? 'bg-accent text-white shadow-sm shadow-accent/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf.id}
                  </button>
                ))}
              </div>
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className="bg-white/[0.04] border border-white/10 text-[10px] text-slate-300 rounded px-1.5 py-0.5 outline-none"
                title="Benchmark overlay"
              >
                <option value="^NSEI">NIFTY 50</option>
                <option value="^GSPC">S&P 500</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="h-52 w-full relative">
            <canvas ref={trendChartRef} />
            {trendData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                {uniqueSymbols.length === 0 ? '[ No holdings to chart ]' : '[ Loading price history… ]'}
              </div>
            )}
          </div>
          <p className="text-[9px] text-slate-500 font-sans">
            Your current holdings backtested against real exchange closes (Yahoo Finance). Mutual funds use
            published NAVs (~1 month of depth, earlier points held at first known NAV). Cash is excluded so
            idle balances don't flatten the curve.
          </p>
          {topAssets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <span className="text-[9px] uppercase font-bold text-slate-450 block mb-2 tracking-wider">
                Key Asset Contributors to Current Net Worth
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {topAssets.map(asset => (
                  <div key={asset.symbol} className="p-2 bg-white/[0.01] border border-white/[0.03] rounded-lg">
                    <span className="text-[10px] font-bold text-slate-300 block truncate" title={asset.name}>
                      {asset.symbol}
                    </span>
                    <span className="text-xs font-extrabold text-white block mt-0.5 font-mono-nums">
                      {formatCurrency(asset.value, settings.currency, 0)}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      {asset.weight}% weight
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <span>{actualDividends > 0 ? 'Dividend Income Received' : 'Estimated Dividend Yield'}</span>
              </span>
              <span className="text-xs text-slate-500 font-sans block">
                {actualDividends > 0
                  ? 'Total recorded dividend transactions'
                  : 'Estimated yearly passive inflow'}
              </span>
            </div>
            <span className="text-base font-bold text-white font-mono-nums">
              {formatCurrency(actualDividends > 0 ? actualDividends : estYearlyDividends, settings.currency, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Tax Insights & Capital Gains Estimator */}
      <TaxInsightsCard />
    </div>
  );
}
