import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { settingsStore, updateSettings } from '../../stores/settings';
import { portfolioStore, importTransactions, SEED_TRANSACTIONS } from '../../stores/portfolio';
import { importHoldings } from '../../stores/portfolio';


// Import sub-components
import TickerTape from '../layout/TickerTape';
import HeroStats from './HeroStats';
import HoldingsTable from './HoldingsTable';
import PlatformBreakdown from './PlatformBreakdown';
import AllocationCharts from './AllocationCharts';
import AIInsights from './AIInsights';
import TransactionForm from './TransactionForm';
import TransactionsList from './TransactionsList';
import RebalancingAssistant from './RebalancingAssistant';
import WhatIfSimulator from './WhatIfSimulator';
import AnalyticsTab from './AnalyticsTab';
import SettingsPanel from './SettingsPanel';

// Icons
import {
  LayoutDashboard,
  Briefcase,
  FileSpreadsheet,
  PlusCircle,
  History,
  LineChart,
  Scale,
  FlaskConical,
  Settings,
  TrendingUp,
  Sun,
  Moon,
  BookOpen,
  Eye,
  EyeOff
} from 'lucide-react';
import { getThemeMode, setThemeMode, type ThemeMode } from '../../lib/theme';

export default function DashboardShell() {
  const settings = useStore(settingsStore);
  const holdings = useStore(portfolioStore);

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Load persisted tab after mount on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const persisted = sessionStorage.getItem('active_tab');
      if (persisted) {
        setActiveTab(persisted);
      }
    }
  }, []);

  // Persist active tab changes
  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      sessionStorage.setItem('active_tab', activeTab);
    }
  }, [activeTab]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [systemTime, setSystemTime] = useState('');

  // Sliding pill indicator for the top tab strip
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        setPill({ left: el.offsetLeft, width: el.offsetWidth });
        el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab, mounted]);

  // Privacy blur shutter: blur content, swap values mid-blur, unblur
  const [privacyAnimating, setPrivacyAnimating] = useState(false);
  const togglePrivacy = () => {
    setPrivacyAnimating(true);
    window.setTimeout(() => {
      updateSettings({ privacyMode: !settingsStore.get().privacyMode });
    }, 150);
    window.setTimeout(() => setPrivacyAnimating(false), 480);
  };
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    setTheme(getThemeMode());
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setThemeMode(nextTheme);
  };

  // Clock update for Market status widget
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setSystemTime(`${d.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'portfolio', label: 'Holdings', icon: Briefcase },
    { id: 'add-asset', label: 'Record Activity', icon: PlusCircle },
    { id: 'transactions', label: 'Transaction Log', icon: History },
    { id: 'analytics', label: 'Exposure Analytics', icon: LineChart },
    { id: 'rebalancing', label: 'Category Rebalancing', icon: Scale },
    { id: 'what-if', label: 'What-If Simulator', icon: FlaskConical },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleCurrencyChange = (curr: 'USD' | 'INR') => {
    updateSettings({ currency: curr });
  };

  const handleLoadDemoData = () => {
    importHoldings([], 'overwrite'); // clear first
    importTransactions(SEED_TRANSACTIONS, 'overwrite');
  };

  return (
    <div className="flex min-h-screen bg-transparent relative">
      
      {/* MAIN CONTENT WRAPPER (top-nav layout) */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Ticker Tape & floating glass navigation */}
        <header className="sticky top-0 z-40 w-full flex flex-col">
          <TickerTape />

          <div className="px-3 sm:px-4 lg:px-6 pt-2.5 pb-1.5">
            <div className="floating-nav rounded-2xl flex h-14 items-center gap-3 lg:gap-5 px-3 sm:px-5">
            {/* Logo */}
            <div className="hidden md:flex items-center space-x-2.5 shrink-0 animate-drop-in">
              <div className="p-1.5 bg-accent/10 border border-accent/20 rounded-lg text-accent">
                <TrendingUp size={18} />
              </div>
              <span className="font-heading font-extrabold text-sm tracking-tight text-white hidden xl:flex items-center space-x-1">
                <span>WealthFlow</span>
                <span className="bg-accent text-white font-bold text-[9px] px-1.5 py-0.5 rounded">Folio</span>
              </span>
            </div>

            {/* Tab strip with sliding active pill */}
            <nav className="relative flex-1 flex items-center gap-0.5 h-full overflow-x-auto scrollbar-none">
              <span
                className="top-tab-pill"
                style={{ left: pill.left, width: pill.width, opacity: pill.width ? 1 : 0 }}
              />
              {menuItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => { tabRefs.current[item.id] = el; }}
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    className={`animate-drop-in relative z-[1] flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'text-accent' : ''} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Utility cluster: currency / privacy / theme / docs / clock */}
            <div className="flex items-center space-x-2 shrink-0 top-actions">
              <div className="premium-currency-selector hidden md:flex">
                <button
                  onClick={() => handleCurrencyChange('USD')}
                  className={`premium-currency-btn ${settings.currency === 'USD' ? 'active' : ''}`}
                >
                  USD ($)
                </button>
                <button
                  onClick={() => handleCurrencyChange('INR')}
                  className={`premium-currency-btn ${settings.currency === 'INR' ? 'active' : ''}`}
                >
                  INR (₹)
                </button>
              </div>

              <button
                onClick={togglePrivacy}
                className="theme-toggle-btn"
                title={settings.privacyMode ? 'Show balances' : 'Hide balances (privacy mode)'}
                aria-label={settings.privacyMode ? 'Show balances' : 'Hide balances'}
              >
                <span key={String(settings.privacyMode)} className="animate-icon-morph inline-flex">
                  {settings.privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
                </span>
              </button>

              <button
                onClick={toggleTheme}
                className="theme-toggle-btn"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span key={theme} className="animate-icon-morph inline-flex">
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </span>
              </button>

              <a href="/docs" className="theme-toggle-btn" title="Docs & Guide">
                <BookOpen size={15} />
              </a>

              <div className="hidden xl:flex items-center gap-1.5 pl-1.5 text-[10px] font-mono text-slate-400" title={`Market feed clock — refreshes every ${settings.pollingFreq}s`}>
                <span className="status-pulse-dot"></span>
                <span>{systemTime}</span>
              </div>
            </div>
            </div>
          </div>
        </header>

        {/* Main Section Content Area (blur shutter during privacy toggle) */}
        <main className={`flex-1 w-full p-4 sm:p-6 lg:px-10 lg:py-8 2xl:px-16 space-y-6 relative z-10 privacy-shutter ${privacyAnimating ? 'privacy-shutter-active' : ''}`}>
          
          {!mounted ? (
            /* Premium Shimmering Loading Skeleton */
            <div className="space-y-6 animate-pulse">
              {/* Hero Stats Cards Shimmer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-navy-900/40 border border-white/[0.04] rounded-2xl p-5 space-y-3">
                    <div className="h-2 bg-white/5 rounded w-2/3"></div>
                    <div className="h-5 bg-white/5 rounded w-1/2"></div>
                    <div className="h-2 bg-white/5 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
              
              {/* Main Content Area Shimmer */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="h-[450px] bg-navy-900/40 border border-white/[0.04] rounded-2xl"></div>
                </div>
                <div className="space-y-6">
                  <div className="h-[210px] bg-navy-900/40 border border-white/[0.04] rounded-2xl"></div>
                  <div className="h-[210px] bg-navy-900/40 border border-white/[0.04] rounded-2xl"></div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Tab Routing */
            <div key={activeTab} className="animate-tab-change">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Welcome Banner for Empty State */}
                  {holdings.length === 0 && (
                    <div className="glow-card p-5 border border-accent/25 bg-accent/5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                      <div className="space-y-1 text-left">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <span className="status-pulse-dot bg-accent"></span>
                          <span>Get Started with Antigravity Portfolio</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 leading-normal max-w-xl">
                          Your portfolio telemetry is currently empty. Upload your Zerodha, Groww, or custom Excel/CSV spreadsheet, or load our pre-populated sample portfolio to explore all features.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                          onClick={handleLoadDemoData}
                          className="flex-1 md:flex-none px-4 py-2 bg-accent hover:bg-accent/90 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition shadow-lg shadow-accent/15 text-center"
                        >
                          Load Sample Data
                        </button>
                        <button
                          onClick={() => setActiveTab('add-asset')}
                          className="flex-1 md:flex-none px-4 py-2 bg-navy-900 border border-white/[0.08] hover:bg-white/[0.02] text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition text-center"
                        >
                          Upload CSV
                        </button>
                      </div>
                    </div>
                  )}
                  <HeroStats />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 space-y-6">
                      <HoldingsTable />
                      <PlatformBreakdown />
                    </div>
                    <div className="space-y-6">
                      <AllocationCharts />
                      <AIInsights />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'portfolio' && <HoldingsTable />}

              {activeTab === 'add-asset' && (
                <TransactionForm onSuccess={() => setActiveTab('portfolio')} />
              )}

              {activeTab === 'transactions' && <TransactionsList />}

              {activeTab === 'analytics' && <AnalyticsTab />}

              {activeTab === 'rebalancing' && <RebalancingAssistant />}

              {activeTab === 'what-if' && <WhatIfSimulator />}

              {activeTab === 'settings' && <SettingsPanel />}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
