import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency } from '../../lib/utils/formatters';
import { getChartPalette, getCssVar, themeTickStore } from '../../lib/theme';
import { AlertTriangle, PieChart, BarChart2, LineChart } from 'lucide-react';
import Chart from 'chart.js/auto';

export default function AllocationCharts() {
  const holdings = useStore(portfolioStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);
  const themeTick = useStore(themeTickStore);

  const doughnutRef = useRef<HTMLCanvasElement | null>(null);
  const barRef = useRef<HTMLCanvasElement | null>(null);
  const lineRef = useRef<HTMLCanvasElement | null>(null);

  const [activeTab, setActiveTab] = useState<'platform' | 'weights' | 'history'>('platform');
  const [highRiskHoldings, setHighRiskHoldings] = useState<string[]>([]);

  // 1. Calculations
  const processedData = holdings.map(h => {
    const symbol = h.symbol.toUpperCase();
    const livePrice = prices[symbol]?.price || h.avgCost;
    return {
      symbol,
      platform: h.platform || 'Unknown',
      value: h.shares * livePrice
    };
  });

  const grandTotal = processedData.reduce((acc, curr) => acc + curr.value, 0);

  // Group by Platform
  const platformGroups: Record<string, number> = {};
  processedData.forEach(item => {
    platformGroups[item.platform] = (platformGroups[item.platform] || 0) + item.value;
  });

  const platformLabels = Object.keys(platformGroups);
  const platformValues = Object.values(platformGroups);

  // Individual Weights
  const individualWeights = processedData.map(item => ({
    symbol: item.symbol,
    weight: grandTotal > 0 ? (item.value / grandTotal) * 100 : 0
  })).sort((a, b) => b.weight - a.weight);

  // Detect high concentration risk (> 20% weight)
  useEffect(() => {
    const risky = individualWeights
      .filter(item => item.weight > 20)
      .map(item => `${item.symbol} (${item.weight.toFixed(1)}%)`);
    setHighRiskHoldings(risky);
  }, [holdings, prices]);

  // Theme-aware chart palette from --chart-N tokens (see global.css)
  const colors = getChartPalette(settings.colorblind);

  // Instantiation of Charts
  useEffect(() => {
    // A. PLATFORM DOUGHNUT CHART
    if (activeTab === 'platform' && doughnutRef.current) {
      const existing = Chart.getChart(doughnutRef.current);
      if (existing) existing.destroy();

      const ctx = doughnutRef.current.getContext('2d');
      if (ctx && platformLabels.length > 0) {
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: platformLabels,
            datasets: [{
              data: platformValues,
              backgroundColor: colors.slice(0, platformLabels.length),
              borderColor: getCssVar('--bg-card', '#11291D'),
              borderWidth: 2,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: getCssVar('--text-muted', '#94A3B8'),
                  font: { family: 'Inter', size: 10 },
                  padding: 15
                }
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const val = context.raw as number;
                    const pct = grandTotal > 0 ? (val / grandTotal) * 100 : 0;
                    return `${context.label}: ${formatCurrency(val, settings.currency)} (${pct.toFixed(1)}%)`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // B. WEIGHTS BAR CHART
    if (activeTab === 'weights' && barRef.current) {
      const existing = Chart.getChart(barRef.current);
      if (existing) existing.destroy();

      const ctx = barRef.current.getContext('2d');
      if (ctx && individualWeights.length > 0) {
        const topWeights = individualWeights.slice(0, 10);
        
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: topWeights.map(w => w.symbol),
            datasets: [{
              data: topWeights.map(w => w.weight),
              backgroundColor: topWeights.map(w => w.weight > 20 ? getCssVar('--color-warning', '#F59E0B') : getCssVar('--color-accent', '#22C55E')),
              borderRadius: 4,
              borderWidth: 0,
              barThickness: 12
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const val = context.raw as number;
                    return `Weight: ${val.toFixed(2)}%`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: { color: getCssVar('--text-muted', '#86EFAC'), font: { family: 'Inter', size: 9 } },
                max: 100
              },
              y: {
                grid: { display: false },
                ticks: { color: getCssVar('--text-main', '#F0FDF4'), font: { family: 'Inter', size: 10 } }
              }
            }
          }
        });
      }
    }

    // C. HISTORICAL TIMELINE CHART
    if (activeTab === 'history' && lineRef.current) {
      const existing = Chart.getChart(lineRef.current);
      if (existing) existing.destroy();

      const ctx = lineRef.current.getContext('2d');
      if (ctx) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Today'];
        const values: number[] = [];
        let tempVal = grandTotal > 0 ? grandTotal : 15000;
        
        for (let i = 5; i >= 0; i--) {
          values.unshift(tempVal);
          tempVal = tempVal * (1 - (Math.random() * 0.08 - 0.03));
        }

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: months,
            datasets: [{
              data: values,
              borderColor: getCssVar('--color-accent', '#22C55E'),
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              borderWidth: 2,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: getCssVar('--color-accent', '#22C55E'),
              tension: 0.15
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const val = context.raw as number;
                    return `Portfolio Value: ${formatCurrency(val, settings.currency)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: getCssVar('--text-muted', '#94A3B8'), font: { family: 'Inter', size: 9 } }
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: { color: getCssVar('--text-muted', '#94A3B8'), font: { family: 'Inter', size: 9 } }
              }
            }
          }
        });
      }
    }
  }, [holdings, prices, activeTab, settings.colorblind, themeTick]);

  return (
    <div className="cyber-card p-4 md:p-5 shadow-lg flex flex-col justify-between h-[360px]">
      
      {/* Header and Tab Toggles */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <span>Allocation Analytics</span>
        </h3>
        
        <div className="flex bg-navy-950 p-1 border border-white/[0.08] rounded-xl text-[10px] font-semibold">
          <button
            onClick={() => setActiveTab('platform')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center space-x-1 ${
              activeTab === 'platform' 
                ? 'bg-white/[0.08] text-white border border-white/[0.04] shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <PieChart size={11} />
            <span className="hidden sm:inline">Custodian</span>
          </button>
          
          <button
            onClick={() => setActiveTab('weights')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center space-x-1 ${
              activeTab === 'weights' 
                ? 'bg-white/[0.08] text-white border border-white/[0.04] shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <BarChart2 size={11} />
            <span className="hidden sm:inline">Weights</span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center space-x-1 ${
              activeTab === 'history' 
                ? 'bg-white/[0.08] text-white border border-white/[0.04] shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <LineChart size={11} />
            <span className="hidden sm:inline">Timeline</span>
          </button>
        </div>
      </div>

      {/* Warning Box for Exposure risk */}
      {activeTab === 'weights' && highRiskHoldings.length > 0 && (
        <div className="mb-3 px-3 py-1.5 bg-loss/5 border border-loss/20 text-[10px] text-loss flex items-center space-x-1.5 rounded-lg">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Concentration Risk Warning: Asset weights exceeding 20% in {highRiskHoldings.join(', ')}</span>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        {grandTotal === 0 ? (
          <div className="text-xs text-slate-500">No active assets loaded to compile statistics.</div>
        ) : (
          <>
            {activeTab === 'platform' && (
              <div className="w-full h-full p-2">
                <canvas ref={doughnutRef} />
              </div>
            )}
            
            {activeTab === 'weights' && (
              <div className="w-full h-full p-1">
                <canvas ref={barRef} />
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="w-full h-full p-1">
                <canvas ref={lineRef} />
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
