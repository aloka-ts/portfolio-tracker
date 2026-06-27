import React from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore } from '../../stores/portfolio';
import { priceStore } from '../../stores/prices';
import { settingsStore } from '../../stores/settings';
import { formatCurrency, formatPercent } from '../../lib/utils/formatters';
import { Sparkles, AlertTriangle, Scale, Coins, Percent, Landmark } from 'lucide-react';
import type { AIInsight } from '../../types';

export default function AIInsights() {
  const holdings = useStore(portfolioStore);
  const prices = useStore(priceStore);
  const settings = useStore(settingsStore);

  // Compile calculations
  const totalValue = holdings.reduce((sum, h) => {
    const livePrice = prices[h.symbol.toUpperCase()]?.price || h.avgCost;
    return sum + (h.shares * livePrice);
  }, 0);

  const insights: AIInsight[] = [];

  if (holdings.length === 0 || totalValue === 0) {
    return (
      <div className="cyber-card p-5 shadow-lg h-full flex flex-col justify-center items-center text-slate-550 text-xs text-center">
        No active transactions found. Upload your spreadsheet or run seed demo data to compute AI insights.
      </div>
    );
  }

  // 1. Concentration Risk Checks
  const weights = holdings.map(h => {
    const livePrice = prices[h.symbol.toUpperCase()]?.price || h.avgCost;
    const value = h.shares * livePrice;
    return {
      symbol: h.symbol.toUpperCase(),
      weight: (value / totalValue) * 100
    };
  });

  // A. Individual stock concentration
  const maxWeightStock = weights.reduce((max, w) => w.weight > max.weight ? w : max, { symbol: '', weight: 0 });
  if (maxWeightStock.weight > 30) {
    insights.push({
      id: 'conc-risk-high',
      type: 'risk',
      title: 'High Concentration Alert',
      description: `Your holdings in ${maxWeightStock.symbol} represent ${maxWeightStock.weight.toFixed(1)}% of your total portfolio. We recommend trimming your exposure below 25% to minimize individual asset risk.`,
      severity: 'warning'
    });
  } else if (maxWeightStock.weight > 20) {
    insights.push({
      id: 'conc-risk-med',
      type: 'risk',
      title: 'Portfolio Concentration Heavy',
      description: `${maxWeightStock.symbol} accounts for ${maxWeightStock.weight.toFixed(1)}% of your total assets. Consider diversifying into other sectors.`,
      severity: 'info'
    });
  }

  // B. Platform concentration
  const platformValues: Record<string, number> = {};
  holdings.forEach(h => {
    const livePrice = prices[h.symbol.toUpperCase()]?.price || h.avgCost;
    platformValues[h.platform] = (platformValues[h.platform] || 0) + (h.shares * livePrice);
  });
  
  Object.entries(platformValues).forEach(([platform, val]) => {
    const weight = (val / totalValue) * 100;
    if (weight > 60) {
      insights.push({
        id: `plat-risk-${platform}`,
        type: 'risk',
        title: 'Custodian Concentration Exposure',
        description: `You have placed ${weight.toFixed(1)}% of your capital on ${platform}. Consider using multiple brokerages to safeguard against operational outages.`,
        severity: 'warning'
      });
    }
  });

  // 2. Momentum / Movers
  const activePriceUpdates = holdings.map(h => {
    const tick = prices[h.symbol.toUpperCase()];
    return {
      symbol: h.symbol.toUpperCase(),
      change24h: (tick && typeof tick.change24h === 'number') ? tick.change24h : 0,
      price: (tick && typeof tick.price === 'number') ? tick.price : h.avgCost
    };
  }).filter(t => t.change24h !== 0);

  if (activePriceUpdates.length > 0) {
    const gainer = activePriceUpdates.reduce((max, u) => u.change24h > max.change24h ? u : max, { symbol: '', change24h: -Infinity });
    const loser = activePriceUpdates.reduce((min, u) => u.change24h < min.change24h ? u : min, { symbol: '', change24h: Infinity });

    if (gainer.change24h > 1.5) {
      insights.push({
        id: 'momentum-gainer',
        type: 'mover',
        title: `Bullish Trend: ${gainer.symbol}`,
        description: `${gainer.symbol} is up +${formatPercent(gainer.change24h)} in this session, driving net gains for the portfolio.`,
        severity: 'success'
      });
    }

    if (loser.change24h < -1.5) {
      insights.push({
        id: 'momentum-loser',
        type: 'mover',
        title: `Bearish Trend: ${loser.symbol}`,
        description: `${loser.symbol} fell -${formatPercent(loser.change24h)} today. Monitor support levels.`,
        severity: 'warning'
      });
    }
  }

  // 3. Dividend Yield Estimations
  let totalEstDividends = 0;
  holdings.forEach(h => {
    const sym = h.symbol.toUpperCase();
    const livePrice = prices[sym]?.price || h.avgCost;
    const value = h.shares * livePrice;
    
    let yieldPct = 0.012; // default 1.2%
    if (sym.includes('.NS') || sym.includes('.BO')) {
      if (sym.includes('TCS') || sym.includes('INFY')) yieldPct = 0.024;
      else if (sym.includes('BANK')) yieldPct = 0.018;
    } else {
      if (sym === 'AAPL' || sym === 'MSFT') yieldPct = 0.006;
      else if (sym === 'NVDA' || sym === 'TSLA') yieldPct = 0.001;
    }
    
    totalEstDividends += value * yieldPct;
  });

  const avgDividendYield = (totalEstDividends / totalValue) * 100;
  insights.push({
    id: 'div-income',
    type: 'dividend',
    title: 'Estimated Dividend Yield',
    description: `Est. annual payout: ${formatCurrency(totalEstDividends, settings.currency, settings.decimals)} (approx. ${avgDividendYield.toFixed(2)}% portfolio yield).`,
    severity: 'success'
  });

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'risk': return <AlertTriangle size={15} className="text-loss shrink-0" />;
      case 'rebalance': return <Scale size={15} className="text-stone-400 shrink-0" />;
      case 'dividend': return <Coins size={15} className="text-gain shrink-0" />;
      case 'mover': return <Percent size={15} className="text-accent shrink-0" />;
      default: return <Sparkles size={15} className="text-accent shrink-0" />;
    }
  };

  const getBorderColorClass = (severity: AIInsight['severity']) => {
    if (severity === 'warning') return 'border-loss/30 bg-loss/5 text-slate-200';
    if (severity === 'success') return 'border-gain/30 bg-gain/5 text-slate-200';
    return 'border-white/[0.08] bg-[#0E1015]/60 text-slate-200';
  };

  return (
    <div className="stone-card p-4 md:p-5 shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4 shrink-0">
        <div className="flex items-center space-x-2">
          <Sparkles size={15} className="text-accent" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Insights & Diagnostics</h3>
        </div>
        <span className="text-[10px] text-slate-500 font-semibold uppercase">Asset Diversification</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] md:max-h-none">
        {insights.map(item => (
          <div 
            key={item.id}
            className={`p-3 border rounded-lg flex items-start space-x-2.5 transition duration-150 hover:bg-white/[0.02] ${getBorderColorClass(item.severity)}`}
          >
            {getInsightIcon(item.type)}
            <div className="space-y-1">
              <span className="text-xs font-bold block leading-none text-white">{item.title}</span>
              <p className="text-[10px] text-slate-400 leading-normal">{item.description}</p>
            </div>
          </div>
        ))}

        {insights.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-6">
            Computing metrics...
          </div>
        )}
      </div>
    </div>
  );
}
