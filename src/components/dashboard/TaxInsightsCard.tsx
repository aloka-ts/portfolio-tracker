import React, { useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { portfolioStore, transactionsStore, EXCHANGE_RATE } from '../../stores/portfolio';
import { settingsStore } from '../../stores/settings';
import { priceStore } from '../../stores/prices';
import { formatCurrency } from '../../lib/utils/formatters';
import { ShieldAlert, TrendingDown, Info, Calculator, Percent } from 'lucide-react';

export const TaxInsightsCard: React.FC = () => {
  const holdings = useStore(portfolioStore);
  const transactions = useStore(transactionsStore);
  const settings = useStore(settingsStore);
  const prices = useStore(priceStore);

  const taxAnalysis = useMemo(() => {
    const today = new Date();
    let totalStcgUnrealized = 0;
    let totalLtcgUnrealized = 0;
    const harvestingCandidates: Array<{
      symbol: string;
      category: string;
      market: 'IN' | 'US';
      unrealizedLoss: number;
      potentialTaxOffset: number;
      daysHeld: number;
    }> = [];

    holdings.forEach((h) => {
      if (h.shares <= 0) return;

      const currentPrice = prices[h.symbol]?.price ?? h.avgCost;
      const currentVal = h.shares * currentPrice;
      const totalCost = h.shares * h.avgCost;
      const unrealizedPnl = currentVal - totalCost;

      // Find earliest purchase transaction date for holding period calculation
      const txList = transactions.filter((t) => t.ticker.toUpperCase() === h.symbol.toUpperCase() && t.type === 'BUY');
      const earliestTxDate = txList.length > 0
        ? new Date(txList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date)
        : today;

      const daysHeld = Math.max(0, Math.floor((today.getTime() - earliestTxDate.getTime()) / (1000 * 60 * 60 * 24)));
      const isLongTerm = daysHeld >= 365;

      if (unrealizedPnl > 0) {
        if (isLongTerm) {
          totalLtcgUnrealized += unrealizedPnl;
        } else {
          totalStcgUnrealized += unrealizedPnl;
        }
      } else if (unrealizedPnl < 0) {
        const lossAmount = Math.abs(unrealizedPnl);
        // Tax offset estimated at STCG 20% or LTCG 12.5% rate
        const taxRate = isLongTerm ? 0.125 : 0.20;
        const potentialTaxOffset = lossAmount * taxRate;

        harvestingCandidates.push({
          symbol: h.symbol,
          category: h.category || 'Stocks',
          market: h.market,
          unrealizedLoss: lossAmount,
          potentialTaxOffset,
          daysHeld,
        });
      }
    });

    // Tax estimation rates (Indian IT Act defaults for Equity: STCG 20%, LTCG 12.5% above ₹1.25L exemption)
    const ltcgExemptionInr = 125000;
    const ltcgExemptionConverted = hMarketCurrencyVal(ltcgExemptionInr, 'IN', settings.currency);
    const taxableLtcg = Math.max(0, totalLtcgUnrealized - ltcgExemptionConverted);

    const estStcgTax = totalStcgUnrealized * 0.20;
    const estLtcgTax = taxableLtcg * 0.125;
    const totalEstTax = estStcgTax + estLtcgTax;
    const totalHarvestableLoss = harvestingCandidates.reduce((sum, item) => sum + item.unrealizedLoss, 0);

    return {
      totalStcgUnrealized,
      totalLtcgUnrealized,
      estStcgTax,
      estLtcgTax,
      totalEstTax,
      harvestingCandidates,
      totalHarvestableLoss,
    };
  }, [holdings, transactions, prices, settings.currency]);

  function hMarketCurrencyVal(valInr: number, market: 'IN' | 'US', displayCurrency: string): number {
    if (displayCurrency === 'USD') return valInr / EXCHANGE_RATE;
    return valInr;
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-6 space-y-6 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Tax Insights & Capital Gains Estimator</h3>
            <p className="text-xs text-slate-400">
              Estimated STCG vs LTCG unrealized tax obligations and tax-loss harvesting candidates.
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-bold">
          Fiscal Year 2026 Rules
        </span>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* STCG Unrealized */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-semibold">
            <span>STCG Unrealized</span>
            <span className="text-amber-400 font-mono">20% Tax</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">
            {formatCurrency(taxAnalysis.totalStcgUnrealized, settings.currency, settings.privacyMode)}
          </div>
          <div className="text-[11px] text-amber-400/80 font-mono">
            Est. Tax: {formatCurrency(taxAnalysis.estStcgTax, settings.currency, settings.privacyMode)}
          </div>
        </div>

        {/* LTCG Unrealized */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-semibold">
            <span>LTCG Unrealized</span>
            <span className="text-emerald-400 font-mono">12.5% Tax</span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">
            {formatCurrency(taxAnalysis.totalLtcgUnrealized, settings.currency, settings.privacyMode)}
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono">
            Est. Tax: {formatCurrency(taxAnalysis.estLtcgTax, settings.currency, settings.privacyMode)}
          </div>
        </div>

        {/* Total Est. Tax Obligation */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Estimated Tax</div>
          <div className="text-lg font-bold text-rose-400 font-mono">
            {formatCurrency(taxAnalysis.totalEstTax, settings.currency, settings.privacyMode)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Excludes surcharge & cess</div>
        </div>

        {/* Tax Loss Harvesting Potential */}
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Harvestable Losses</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">
            {formatCurrency(taxAnalysis.totalHarvestableLoss, settings.currency, settings.privacyMode)}
          </div>
          <div className="text-[11px] text-cyan-400/80 font-mono">
            {taxAnalysis.harvestingCandidates.length} loss-making position(s)
          </div>
        </div>
      </div>

      {/* Tax-Loss Harvesting Candidates Table */}
      {taxAnalysis.harvestingCandidates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-cyan-400" />
              Tax-Loss Harvesting Opportunities
            </h4>
            <span className="text-[10px] text-slate-400">Sell at loss to offset taxable gains</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[10px] text-slate-400 uppercase border-b border-slate-800 font-semibold">
                <tr>
                  <th className="p-3">Asset Ticker</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Holding Period</th>
                  <th className="p-3 text-right">Unrealized Loss</th>
                  <th className="p-3 text-right">Est. Tax Saving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {taxAnalysis.harvestingCandidates.map((item) => (
                  <tr key={item.symbol} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-bold text-slate-100">{item.symbol}</td>
                    <td className="p-3 text-slate-400">{item.category}</td>
                    <td className="p-3 text-slate-400">
                      {item.daysHeld} days ({item.daysHeld >= 365 ? 'LTCG' : 'STCG'})
                    </td>
                    <td className="p-3 text-right font-bold text-rose-400">
                      -{formatCurrency(item.unrealizedLoss, settings.currency, settings.privacyMode)}
                    </td>
                    <td className="p-3 text-right font-bold text-cyan-400">
                      +{formatCurrency(item.potentialTaxOffset, settings.currency, settings.privacyMode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950/30 border border-slate-800/60 text-slate-400 text-xs flex items-center gap-3">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>No loss-making positions currently available for tax-loss harvesting.</span>
        </div>
      )}
    </div>
  );
};
