import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface IndexInfo {
  name: string;
  price: number;
  changePercent: number;
}

export default function TickerTape() {
  const [indices, setIndices] = useState<IndexInfo[]>([
    { name: 'NIFTY 50', price: 22096.75, changePercent: 0.32 },
    { name: 'SENSEX', price: 72831.94, changePercent: 0.26 },
    { name: 'BANK NIFTY', price: 47000.00, changePercent: 0.15 },
    { name: 'NASDAQ 100', price: 18000.00, changePercent: 0.50 },
    { name: 'S&P 500', price: 5100.00, changePercent: 0.40 },
    { name: 'LARGEMIDCAP', price: 14000.00, changePercent: 0.20 }
  ]);

  // Fetch live prices for indices from the API
  useEffect(() => {
    const fetchIndexPrices = async () => {
      try {
        const symbols = ['^NSEI', '^BSESN', '^NSEBANK', '^NDX', '^GSPC', 'NIFTY_LARGEMID250.NS'];
        const res = await fetch(`/api/prices?symbols=${symbols.join(',')}&provider=yahoo`);
        if (res.ok) {
          const data = await res.json();
          setIndices([
            { name: 'NIFTY 50', price: data['^NSEI']?.price || 22096.75, changePercent: data['^NSEI']?.change24h || 0.32 },
            { name: 'SENSEX', price: data['^BSESN']?.price || 72831.94, changePercent: data['^BSESN']?.change24h || 0.26 },
            { name: 'BANK NIFTY', price: data['^NSEBANK']?.price || 47000.00, changePercent: data['^NSEBANK']?.change24h || 0.15 },
            { name: 'NASDAQ 100', price: data['^NDX']?.price || 18000.00, changePercent: data['^NDX']?.change24h || 0.50 },
            { name: 'S&P 500', price: data['^GSPC']?.price || 5100.00, changePercent: data['^GSPC']?.change24h || 0.40 },
            { name: 'LARGEMIDCAP', price: data['NIFTY_LARGEMID250.NS']?.price || 14000.00, changePercent: data['NIFTY_LARGEMID250.NS']?.change24h || 0.20 }
          ]);
        }
      } catch (e) {
        console.error('Failed to fetch index prices', e);
      }
    };

    fetchIndexPrices();
    const interval = setInterval(fetchIndexPrices, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ticker-tape-wrap">
      <div className="ticker-tape-scroll">
        {/* Render three times for seamless looping marquee */}
        {[...indices, ...indices, ...indices].map((idx, i) => {
          const isPositive = idx.changePercent >= 0;
          return (
            <div key={i} className="ticker-card-item">
              <span className="text-slate-500 font-bold tracking-wider">{idx.name}</span>
              <span className="text-white font-semibold">
                {idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`flex items-center gap-0.5 font-bold ${isPositive ? 'text-gain' : 'text-loss'}`}>
                {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                <span>
                  {isPositive ? '+' : ''}
                  {idx.changePercent.toFixed(2)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
