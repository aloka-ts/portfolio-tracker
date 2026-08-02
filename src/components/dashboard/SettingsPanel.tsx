import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { settingsStore, updateSettings } from '../../stores/settings';
import { portfolioStore, clearHoldings, importHoldings } from '../../stores/portfolio';
import { 
  Sliders, 
  Trash2, 
  Download, 
  ShieldAlert, 
  Check, 
  RefreshCw, 
  Eye, 
  EyeOff,
  LogOut,
  UserCheck
} from 'lucide-react';
import { parseSheetFile, mapRowsToHoldings } from '../../lib/parsing/sheetParser';
import { getThemeMode, setThemeMode, type ThemeMode } from '../../lib/theme';

// Miniature theme mockup card (Wealthfolio-inspired). Colors mirror the
// light/dark token values in global.css so previews stay truthful.
const PREVIEW_COLORS = {
  light: { base: '#F8FAFC', card: '#FFFFFF', line: '#CBD5E1' },
  dark: { base: '#08090B', card: '#0E1015', line: '#334155' },
};

function ThemePreview({ variant }: { variant: 'light' | 'dark' }) {
  const c = PREVIEW_COLORS[variant];
  return (
    <div className="rounded p-1.5 space-y-1" style={{ backgroundColor: c.base }}>
      <div className="rounded-sm p-1 space-y-1" style={{ backgroundColor: c.card }}>
        <div className="h-1 w-8 rounded" style={{ backgroundColor: '#FF0055' }} />
        <div className="h-1 w-12 rounded" style={{ backgroundColor: c.line }} />
      </div>
      <div className="rounded-sm p-1 flex items-center space-x-1" style={{ backgroundColor: c.card }}>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.line }} />
        <div className="h-1 w-10 rounded" style={{ backgroundColor: c.line }} />
      </div>
    </div>
  );
}

function ThemeModeSelector() {
  const [mode, setMode] = useState<ThemeMode>('dark');
  React.useEffect(() => {
    setMode(getThemeMode());
  }, []);

  const choose = (next: ThemeMode) => {
    setMode(next);
    setThemeMode(next);
  };

  const options: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: 'LIGHT' },
    { value: 'dark', label: 'DARK' },
  ];

  return (
    <div className="flex flex-col space-y-1">
      <label className="text-[9px] text-cyan-500/60 uppercase font-bold">APPEARANCE MODE</label>
      <div className="grid grid-cols-2 gap-2 max-w-xs">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => choose(opt.value)}
            className={`border rounded-none p-1.5 text-left transition ${
              mode === opt.value
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-cyan-500/30 hover:bg-cyan-500/5'
            }`}
          >
            <ThemePreview variant={opt.value} />
            <span className={`block text-center text-[9px] font-bold mt-1 ${
              mode === opt.value ? 'text-cyan-300' : 'text-cyan-500/70'
            }`}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const settings = useStore(settingsStore);
  const holdings = useStore(portfolioStore);

  // Success states for alerts
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [csvUploadSuccess, setCsvUploadSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Extract User info from local storage
  const rawUser = typeof window !== 'undefined' ? localStorage.getItem('portfolio_user') : null;
  const user = rawUser ? JSON.parse(rawUser) : { username: 'Guest User', isAuthenticated: false };

  const handleDisplayChange = (updates: any) => {
    updateSettings(updates);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // CSV Exporter logic
  const handleExportCSV = () => {
    if (holdings.length === 0) {
      alert('No assets available to export.');
      return;
    }

    const headers = ['Symbol', 'Shares', 'Avg Cost', 'Platform', 'Date Acquired'];
    const rows = holdings.map(h => [
      h.symbol,
      h.shares,
      h.avgCost,
      `"${h.platform}"`,
      h.dateAcquired || ''
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `antigravity_holdings_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct manual file import inside Settings
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const result = parseSheetFile(new Uint8Array(buffer));
          
          if (!result.mappings.symbol || !result.mappings.shares || !result.mappings.avgCost) {
            alert('Unable to auto-map standard columns. Please use the homepage wizard for complex mappings.');
            return;
          }
          
          const mapped = mapRowsToHoldings(result.rows, result.mappings);
          importHoldings(mapped, 'merge');
          setCsvUploadSuccess(true);
          setTimeout(() => setCsvUploadSuccess(false), 2500);
        } catch (err: any) {
          alert(err.message || 'Parsing error. Verify column layout.');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleClearAll = () => {
    if (!showConfirmPurge) {
      setShowConfirmPurge(true);
      setTimeout(() => setShowConfirmPurge(false), 4000);
      return;
    }
    clearHoldings();
    localStorage.removeItem('portfolio_settings');
    localStorage.removeItem('portfolio_user');
    window.location.href = '/';
  };

  const handleLogout = () => {
    localStorage.removeItem('portfolio_user');
    localStorage.removeItem('portfolio_holdings');
    clearHoldings();
    window.location.href = '/';
  };

  if (!mounted) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 font-sans">
        <div className="bg-navy-900 border border-slate-800/80 rounded-xl p-8 shadow-md h-64 animate-pulse flex flex-col justify-center space-y-4">
          <div className="h-4 bg-slate-800 rounded w-1/3 animate-pulse"></div>
          <div className="h-4 bg-slate-800 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 font-tech">
      
      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: User preferences */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Display & Layout Panel */}
          <div className="cyber-card p-5 space-y-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center space-x-2">
              <Sliders size={14} className="text-cyan-400" />
              <span className="glow-text-cyan">[ DISPLAY.PREFERENCES ]</span>
            </h3>

            <ThemeModeSelector />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Currency selector */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">BASE CURRENCY</label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleDisplayChange({ currency: e.target.value })}
                  className="bg-black/80 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 outline-none focus:border-cyan-400 font-tech"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              {/* Decimals Selector */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">DECIMAL PRECISION</label>
                <select
                  value={settings.decimals}
                  onChange={(e) => handleDisplayChange({ decimals: Number(e.target.value) })}
                  className="bg-black/80 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 outline-none focus:border-cyan-400 font-tech"
                >
                  <option value="0">0 DECIMALS ($150,000)</option>
                  <option value="1">1 DECIMAL ($150,000.0)</option>
                  <option value="2">2 DECIMALS ($150,000.00)</option>
                  <option value="3">3 DECIMALS ($150,000.000)</option>
                </select>
              </div>

              {/* Colorblind filter */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">THEME PALETTE</label>
                <button
                  onClick={() => handleDisplayChange({ colorblind: !settings.colorblind })}
                  className={`border text-xs rounded-none p-2 text-left transition font-tech ${
                    settings.colorblind 
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' 
                      : 'bg-black/80 border-cyan-500/30 text-cyan-500/70 hover:bg-cyan-500/5'
                  }`}
                >
                  {settings.colorblind ? 'HIGH CONTRAST (BLUE/GOLD)' : 'STANDARD NEO (GREEN/PINK)'}
                </button>
              </div>

              {/* Table density settings */}
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">SPACING DENSITY</label>
                <select
                  value={settings.density}
                  onChange={(e) => handleDisplayChange({ density: e.target.value })}
                  className="bg-black/80 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 outline-none focus:border-cyan-400 font-tech"
                >
                  <option value="compact">COMPACT LAYOUT</option>
                  <option value="comfortable">COMFORTABLE LAYOUT</option>
                </select>
              </div>
            </div>

            {saveSuccess && (
              <div className="text-[10px] text-gain bg-gain/5 border border-gain/20 rounded-none p-2 flex items-center space-x-1.5 animate-fade-in uppercase">
                <Check size={12} />
                <span>Preferences updated successfully.</span>
              </div>
            )}
          </div>

          {/* Market Data settings */}
          <div className="cyber-card p-5 space-y-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center space-x-2">
              <RefreshCw size={14} className="text-cyan-400" />
              <span className="glow-text-cyan">[ FEED.POLLING_CONFIG ]</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">MARKET FEED SOURCE</label>
                <select
                  value={settings.provider}
                  onChange={(e) => handleDisplayChange({ provider: e.target.value })}
                  className="bg-black/80 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 outline-none focus:border-cyan-400 font-tech"
                >
                  <option value="google">GOOGLE FINANCE FEED (REAL-TIME SCAPE)</option>
                  <option value="yahoo">YAHOO FINANCE PROXY (CORS BLOCK)</option>
                  <option value="mock">MOCK FEEDS (DIAGNOSTIC NOISE)</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[9px] text-cyan-500/60 uppercase font-bold">POLLING INTERVAL</label>
                <select
                  value={settings.pollingFreq}
                  onChange={(e) => handleDisplayChange({ pollingFreq: Number(e.target.value) })}
                  className="bg-black/80 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 outline-none focus:border-cyan-400 font-tech"
                >
                  <option value="3">3 SECONDS (HIGH DENSITY)</option>
                  <option value="5">5 SECONDS (STANDARD)</option>
                  <option value="15">15 SECONDS (ECONOMY)</option>
                  <option value="30">30 SECONDS (MIN FREQUENCY)</option>
                </select>
              </div>
            </div>
            
            <p className="text-[10px] text-cyan-500/50 leading-relaxed font-sans normal-case">
              Note: google finance provider uses local proxies. Mock price model walking is recommended for off-network sandboxed operations.
            </p>
          </div>

        </div>

        {/* Column 3: Portfolio operations & account details */}
        <div className="space-y-6">
          
          {/* Account Card */}
          <div className="cyber-card p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center space-x-2">
                <UserCheck size={14} className="text-cyan-400" />
                <span className="glow-text-cyan">[ CLIENT.ID ]</span>
              </h3>
              
              <div className="space-y-1 bg-black/40 p-3 border border-cyan-500/10">
                <span className="text-[9px] text-cyan-500/40 uppercase font-bold leading-none block">PROFILE</span>
                <span className="text-sm font-bold text-white tracking-widest block mt-1 uppercase">{user.username}</span>
                <span className="text-[9px] text-cyan-500/60 block leading-none mt-1 uppercase">
                  {user.isAuthenticated ? 'Mock Encryption Enabled' : 'Browser Guest Cache'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 w-full py-2 bg-black hover:bg-cyan-500/10 text-cyan-300 font-bold text-xs rounded-none border border-cyan-500/30 hover:border-cyan-400 transition duration-150 flex items-center justify-center space-x-1.5 uppercase"
            >
              <LogOut size={12} />
              <span>TERMINATE CLIENT SESSION</span>
            </button>
          </div>

          {/* Database controls */}
          <div className="cyber-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center space-x-2">
              <ShieldAlert size={14} className="text-loss" />
              <span className="glow-text-cyan">[ DATA.INTEGRITY_CONTROLS ]</span>
            </h3>

            <div className="space-y-2.5">
              {/* Manual merge import */}
              <label className="w-full py-2 bg-black hover:bg-cyan-500/10 text-cyan-300 font-bold text-xs rounded-none border border-cyan-500/20 hover:border-cyan-500/40 flex items-center justify-center space-x-1.5 cursor-pointer text-center uppercase">
                <RefreshCw size={12} />
                <span>MERGE TRANSACTION MANIFEST</span>
                <input
                  type="file"
                  onChange={handleFileImport}
                  accept=".csv,.xlsx"
                  className="hidden"
                />
              </label>

              {/* CSV Exporter */}
              <button
                onClick={handleExportCSV}
                className="w-full py-2 bg-black hover:bg-cyan-500/10 text-cyan-300 font-bold text-xs rounded-none border border-cyan-500/20 hover:border-cyan-500/40 flex items-center justify-center space-x-1.5 uppercase"
              >
                <Download size={12} />
                <span>DUMP DATA MANIFEST (CSV)</span>
              </button>

              {/* Danger Zone: Clear database */}
              <button
                onClick={handleClearAll}
                className={`w-full py-2 font-bold text-xs rounded-none border flex items-center justify-center space-x-1.5 uppercase transition duration-150 ${
                  showConfirmPurge 
                    ? 'bg-accent/20 hover:bg-accent/30 text-accent border-accent/40 animate-pulse' 
                    : 'bg-loss/10 hover:bg-loss/25 text-loss border-loss/30'
                }`}
              >
                <Trash2 size={12} />
                <span>{showConfirmPurge ? 'CONFIRM PURGE (CLICK AGAIN)' : 'PURGE ACTIVE DATABASE'}</span>
              </button>
            </div>

            {csvUploadSuccess && (
              <div className="text-[9px] text-gain bg-gain/5 border border-gain/20 rounded-none p-2 text-center animate-pulse uppercase">
                Records synced successfully!
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
