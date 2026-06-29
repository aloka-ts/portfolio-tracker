import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { addTransaction, importHoldings, portfolioStore } from '../../stores/portfolio';
import { settingsStore } from '../../stores/settings';
import { parseSheetFile, mapRowsToHoldings } from '../../lib/parsing/sheetParser';
import { AlertCircle, CheckCircle2, Upload, FileSpreadsheet, ArrowRight } from 'lucide-react';

interface TransactionFormProps {
  onSuccess?: () => void;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const holdings = useStore(portfolioStore);
  const settings = useStore(settingsStore);

  // Form states
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Stocks');
  const [market, setMarket] = useState<'US' | 'IN'>('US');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [platform, setPlatform] = useState('');
  const [notes, setNotes] = useState('');

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Bulk Upload states
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-fill company name and market for popular tickers
  useEffect(() => {
    const t = ticker.toUpperCase();
    if (t === 'AAPL') { setName('Apple Inc.'); setMarket('US'); setCategory('Stocks'); }
    else if (t === 'NVDA') { setName('NVIDIA Corporation'); setMarket('US'); setCategory('Stocks'); }
    else if (t === 'TSLA') { setName('Tesla Inc.'); setMarket('US'); setCategory('Stocks'); }
    else if (t === 'MSFT') { setName('Microsoft Corporation'); setMarket('US'); setCategory('Stocks'); }
    else if (t === 'GOOGL') { setName('Alphabet Inc.'); setMarket('US'); setCategory('Stocks'); }
    else if (t === 'RELIANCE.NS') { setName('Reliance Industries Ltd.'); setMarket('IN'); setCategory('Stocks'); }
    else if (t === 'TCS.NS') { setName('Tata Consultancy Services Ltd.'); setMarket('IN'); setCategory('Stocks'); }
    else if (t.endsWith('.NS') || t.endsWith('.BO')) { setMarket('IN'); setCategory('Stocks'); }
  }, [ticker]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const today = new Date().toISOString().split('T')[0];

    if (!ticker.trim()) newErrors.ticker = 'Ticker symbol is required';
    if (!platform.trim()) newErrors.platform = 'Custodian platform is required';
    
    const qtyVal = Number(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    const priceVal = Number(price);
    if (isNaN(priceVal) || priceVal <= 0) {
      newErrors.price = 'Price must be greater than 0';
    }

    const feesVal = Number(fees);
    if (isNaN(feesVal) || feesVal < 0) {
      newErrors.fees = 'Fees cannot be negative';
    }

    if (date > today) {
      newErrors.date = 'Transaction date cannot be in the future';
    }

    // Check if selling more than owned
    if (type === 'SELL') {
      const existing = holdings.find(
        h => h.symbol.toUpperCase() === ticker.trim().toUpperCase() &&
             h.platform.toLowerCase() === platform.trim().toLowerCase()
      );
      const ownedShares = existing ? existing.shares : 0;
      if (qtyVal > ownedShares) {
        newErrors.quantity = `Insufficient shares. You only own ${ownedShares.toFixed(3).replace(/\.?0+$/, '')} shares on ${platform}.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    addTransaction({
      ticker: ticker.trim().toUpperCase(),
      type,
      category,
      quantity: Number(quantity),
      price: Number(price),
      fees: Number(fees),
      date,
      market,
      platform: platform.trim(),
      notes: notes.trim() || undefined
    });

    setShowSuccess(true);
    // Reset form except platform
    setTicker('');
    setName('');
    setQuantity('');
    setPrice('');
    setFees('0');
    setNotes('');
    setErrors({});

    setTimeout(() => {
      setShowSuccess(false);
      if (onSuccess) onSuccess();
    }, 1500);
  };

  // File Upload Handler
  const handleFileUpload = (file: File) => {
    setUploadError('');
    setUploadSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseSheetFile(new Uint8Array(buffer));

        const mappedHoldings = mapRowsToHoldings(result.rows, result.mappings);

        if (mappedHoldings.length === 0) {
          throw new Error('No valid holdings could be parsed from the file. Please check columns.');
        }

        // Import holdings (converts to BUY transactions)
        importHoldings(mappedHoldings, 'overwrite');
        setUploadSuccess(true);

        setTimeout(() => {
          setUploadSuccess(false);
          if (onSuccess) onSuccess();
        }, 1500);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse file');
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
    };
    reader.readAsArrayBuffer(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-5xl mx-auto font-sans">
      
      {/* Left Column: Manual Transaction Form */}
      <div className="stone-card p-6 space-y-5">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
            [ Record Activity Manually ]
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Record single buy or sell transactions.
          </p>
        </div>

        {showSuccess && (
          <div className="p-3 bg-gain/5 border border-gain/20 text-gain text-xs font-semibold rounded-lg flex items-center gap-2 animate-pulse">
            <CheckCircle2 size={15} />
            <span>Transaction recorded successfully! Updating telemetry...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Type selector */}
          <div className="flex gap-4">
            <label className="flex-1">
              <input
                type="radio"
                name="txType"
                checked={type === 'BUY'}
                onChange={() => setType('BUY')}
                className="sr-only"
              />
              <div className={`text-center py-2 font-bold cursor-pointer border transition duration-150 ${
                type === 'BUY'
                  ? 'bg-gain/10 border-gain text-gain'
                  : 'border-white/[0.06] text-slate-400 hover:text-white'
              }`}>
                BUY / ACQUIRE
              </div>
            </label>

            <label className="flex-1">
              <input
                type="radio"
                name="txType"
                checked={type === 'SELL'}
                onChange={() => setType('SELL')}
                className="sr-only"
              />
              <div className={`text-center py-2 font-bold cursor-pointer border transition duration-150 ${
                type === 'SELL'
                  ? 'bg-loss/10 border-loss text-loss'
                  : 'border-white/[0.06] text-slate-400 hover:text-white'
              }`}>
                SELL / DISPOSE
              </div>
            </label>
          </div>

          {/* Ticker & Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Ticker Symbol <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. AAPL, RELIANCE.NS"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className={`w-full bg-navy-900 border rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 ${
                  errors.ticker ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                }`}
              />
              {errors.ticker && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1">
                  <AlertCircle size={10} />
                  <span>{errors.ticker}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Company / Asset Name</label>
              <input
                type="text"
                placeholder="e.g. Apple Inc. (Optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 focus:border-accent"
              />
            </div>
          </div>

          {/* Category & Custodian */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Asset Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
              >
                <option value="Stocks">Stocks</option>
                <option value="Mutual Funds">Mutual Funds</option>
                <option value="ETFs">ETFs</option>
                <option value="Crypto">Crypto</option>
                <option value="Cash">Cash Account</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Custodian / Broker <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Zerodha, Groww, Vested"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={`w-full bg-navy-900 border rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 ${
                  errors.platform ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                }`}
              />
              {errors.platform && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1">
                  <AlertCircle size={10} />
                  <span>{errors.platform}</span>
                </p>
              )}
            </div>
          </div>

          {/* Market & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Exchange Market</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value as 'US' | 'IN')}
                className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none focus:border-accent"
              >
                <option value="US">US Market (USD / $)</option>
                <option value="IN">Indian Market (INR / ₹)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full bg-navy-900 border rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none ${
                  errors.date ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                }`}
              />
              {errors.date && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1">
                  <AlertCircle size={10} />
                  <span>{errors.date}</span>
                </p>
              )}
            </div>
          </div>

          {/* Qty, Price, Fees */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Quantity <span className="text-accent">*</span>
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full bg-navy-900 border rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 ${
                  errors.quantity ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                }`}
              />
              {errors.quantity && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1 font-sans">
                  <AlertCircle size={10} className="shrink-0 mt-0.5" />
                  <span>{errors.quantity}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Price per Share <span className="text-accent">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  {market === 'US' ? '$' : '₹'}
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`w-full bg-navy-900 border rounded-lg pl-6 pr-2 py-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 ${
                    errors.price ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                  }`}
                />
              </div>
              {errors.price && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1">
                  <AlertCircle size={10} />
                  <span>{errors.price}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Brokerage Fees</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  {market === 'US' ? '$' : '₹'}
                </span>
                <input
                  type="number"
                  step="any"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  className={`w-full bg-navy-900 border rounded-lg pl-6 pr-2 py-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 ${
                    errors.fees ? 'border-loss/40 focus:border-loss' : 'border-white/[0.06] focus:border-accent'
                  }`}
                />
              </div>
              {errors.fees && (
                <p className="text-[10px] text-loss flex items-center gap-1 mt-1">
                  <AlertCircle size={10} />
                  <span>{errors.fees}</span>
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Memo / Notes</label>
            <input
              type="text"
              placeholder="e.g. Strategy rebalancing, Dividend reinvestment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-navy-900 border border-white/[0.06] rounded-lg p-2 text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-600 focus:border-accent"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white font-bold tracking-wider rounded-lg transition duration-150 uppercase shadow-lg shadow-accent/10"
          >
            Commit Transaction Record
          </button>
        </form>
      </div>

      {/* Right Column: Bulk Upload Dropzone */}
      <div className="stone-card p-6 space-y-5 h-full flex flex-col">
        <div className="border-b border-white/[0.06] pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading">
            [ Bulk Upload Telemetry ]
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Import Excel or CSV spreadsheets directly (supports Zerodha, Groww, and custom formats).
          </p>
        </div>

        {uploadSuccess && (
          <div className="p-3 bg-gain/5 border border-gain/20 text-gain text-xs font-semibold rounded-lg flex items-center gap-2 animate-pulse">
            <CheckCircle2 size={15} />
            <span>Spreadsheet parsed and imported successfully! Syncing portfolio...</span>
          </div>
        )}

        {uploadError && (
          <div className="p-3 bg-loss/5 border border-loss/20 text-loss text-xs rounded-lg flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 min-h-[250px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition duration-200 relative cursor-pointer ${
            isDragging
              ? 'border-accent bg-accent/5'
              : 'border-white/[0.08] hover:border-white/20 bg-navy-900/40'
          }`}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          />
          
          <div className="p-4 bg-accent/5 border border-accent/15 rounded-full text-accent mb-4">
            <Upload size={28} className="animate-pulse" />
          </div>

          <span className="text-xs font-bold text-white block uppercase tracking-wide">
            Drag & Drop Spreadsheet
          </span>
          
          <span className="text-[10px] text-slate-400 mt-1 block">
            Supports .CSV, .XLSX, or .XLS files
          </span>

          <div className="flex items-center gap-2 mt-4 text-[9px] font-mono text-slate-500 uppercase">
            <FileSpreadsheet size={12} />
            <span>Column mapping is auto-detected</span>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-white/[0.01] border border-white/[0.04] p-3.5 rounded-lg space-y-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
            [ Supported Columns ]
          </span>
          <p className="text-[9px] text-slate-550 leading-relaxed font-mono">
            Ensure your file contains columns for: <strong className="text-white">Symbol / Ticker</strong>, <strong className="text-white">Quantity / Shares</strong>, and <strong className="text-white">Average Cost / Price</strong>.
          </p>
        </div>
      </div>

    </div>
  );
}
