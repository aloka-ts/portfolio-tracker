import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { transactionsStore, deleteTransaction } from '../../stores/portfolio';
import { settingsStore } from '../../stores/settings';
import { formatCurrency } from '../../lib/utils/formatters';
import { Trash2, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import type { Transaction } from '../../types';

export default function TransactionsList() {
  const transactions = useStore(transactionsStore);
  const settings = useStore(settingsStore);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract platforms
  const platforms = Array.from(new Set(transactions.map(tx => tx.platform))).filter(Boolean);

  // Filter transactions
  const filteredTxs = transactions.filter(tx => {
    const matchesSearch = tx.ticker.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
    const matchesPlatform = platformFilter === 'ALL' || tx.platform === platformFilter;
    return matchesSearch && matchesType && matchesPlatform;
  });

  // Sort transactions (default: reverse chronological)
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return sortAsc ? timeA - timeB : timeB - timeA;
  });

  const handleDelete = (id: string, ticker: string) => {
    if (confirm(`Are you sure you want to delete this transaction record for ${ticker}?`)) {
      deleteTransaction(id);
    }
  };

  return (
    <div className="cyber-card overflow-hidden w-full font-sans">
      {/* Search & Filters */}
      <div className="p-4 border-b border-white/[0.04] bg-black/40 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-navy-900 border border-white/[0.06] rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-accent placeholder:text-slate-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal size={13} className="text-slate-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-navy-900 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-accent"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-navy-900 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-accent"
          >
            <option value="ALL">ALL PLATFORMS</option>
            {platforms.map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="p-1.5 border border-white/[0.06] hover:bg-white/[0.02] text-slate-400 hover:text-white rounded-lg flex items-center gap-1 text-xs transition"
          >
            <ArrowUpDown size={13} />
            <span>{sortAsc ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-navy-950 text-slate-400 font-semibold border-b border-white/[0.08] uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Asset</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Fees</th>
              <th className="p-3 text-right">Total Outlay</th>
              <th className="p-3">Platform</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sortedTxs.map((tx) => {
              const isBuy = tx.type === 'BUY';
              const totalOutlay = (tx.quantity * tx.price) + (isBuy ? tx.fees : -tx.fees);
              const txCurrency = tx.market === 'US' ? 'USD' : 'INR';

              return (
                <tr key={tx.id} className="hover:bg-white/[0.01] transition duration-150">
                  <td className="p-3 font-mono text-[11px] text-slate-400">{tx.date}</td>
                  <td className="p-3 font-bold text-white uppercase tracking-tight">
                    {tx.ticker}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      isBuy
                        ? 'bg-gain/10 text-gain border border-gain/20'
                        : 'bg-loss/10 text-loss border border-loss/20'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono-nums text-slate-300">
                    {tx.quantity.toFixed(3).replace(/\.?0+$/, '')}
                  </td>
                  <td className="p-3 text-right font-mono-nums text-slate-400">
                    {formatCurrency(tx.price, txCurrency, settings.decimals)}
                  </td>
                  <td className="p-3 text-right font-mono-nums text-slate-500">
                    {formatCurrency(tx.fees, txCurrency, settings.decimals)}
                  </td>
                  <td className="p-3 text-right font-mono-nums font-bold text-white">
                    {formatCurrency(totalOutlay, txCurrency, settings.decimals)}
                  </td>
                  <td className="p-3 text-slate-400 font-medium">
                    <span className="bg-slate-900 px-2 py-0.5 rounded-full border border-white/[0.08] text-[9px] text-slate-350">
                      {tx.platform}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDelete(tx.id, tx.ticker)}
                      className="p-1.5 bg-loss/5 hover:bg-loss/15 text-loss border border-loss/15 hover:border-loss/30 rounded-lg transition"
                      title="Delete transaction record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedTxs.length === 0 && (
        <div className="p-12 text-center text-slate-500 font-tech text-xs">
          [ NO TRANSACTION RECORDS FOUND ]
        </div>
      )}
    </div>
  );
}
