import React, { useState, useEffect } from 'react';
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
  Menu,
  X,
  TrendingUp,
  Sun,
  Moon
} from 'lucide-react';

export default function DashboardShell() {
  const settings = useStore(settingsStore);
  const holdings = useStore(portfolioStore);

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('active_tab') || 'dashboard';
    }
    return 'dashboard';
  });

  // Persist active tab across refreshes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_tab', activeTab);
    }
  }, [activeTab]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemTime, setSystemTime] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Clock update for Market status widget
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setSystemTime(d.toUTCString().replace('GMT', 'UTC'));
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
      
      {/* 1. SIDEBAR (Desktop: Fixed, Mobile: Drawer) */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 border-r border-white/[0.04] flex flex-col justify-between p-5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Logo and close button */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-accent/10 border border-accent/20 rounded-lg text-accent">
                <TrendingUp size={20} />
              </div>
              <span className="font-heading font-extrabold text-base tracking-tight text-white flex items-center space-x-1">
                <span>WealthFlow</span>
                <span className="bg-accent text-white font-bold text-[9px] px-1.5 py-0.5 rounded">Folio</span>
              </span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-slate-400 hover:text-white lg:hidden border border-white/[0.06] rounded"
            >
              <X size={16} />
            </button>
          </div>

          {/* Nav Menu */}
          <nav className="flex flex-col gap-1">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`sidebar-link w-full text-left ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} className={isActive ? 'text-accent' : 'text-slate-450'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Market Simulator Status Widget & Theme Toggle */}
        <div className="space-y-3">
          <div className="p-3.5 bg-white/[0.01] border border-white/[0.05] rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="status-pulse-dot"></span>
              <span>Market Simulator</span>
            </div>
            <div className="text-[11px] font-mono text-slate-300 font-semibold">{systemTime}</div>
            <div className="text-[9px] text-slate-500 font-sans">
              Feeds refresh every {settings.pollingFreq}s
            </div>
          </div>
          
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-400 font-medium">Theme</span>
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* 2. MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Ticker Tape & Mobile Navigation header */}
        <header className="sticky top-0 z-20 w-full bg-navy-950/80 backdrop-blur-md border-b border-white/[0.04] flex flex-col">
          <TickerTape />
          
          <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Hamburger */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-slate-400 hover:text-white border border-white/[0.06] rounded lg:hidden"
              >
                <Menu size={18} />
              </button>
            </div>

            {/* Currency switcher & theme toggle */}
            <div className="flex items-center space-x-3">
              <div className="premium-currency-selector">
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

              {/* Theme toggle for mobile header (hidden on desktop sidebar) */}
              <button
                onClick={toggleTheme}
                className="theme-toggle-btn lg:hidden"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Section Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 relative z-10">
          
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
            <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
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
