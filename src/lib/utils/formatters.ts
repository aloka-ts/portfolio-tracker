import type { UserSettings } from '../../types';

// Map currency codes to symbols and locales
const CURRENCY_CONFIGS = {
  USD: { locale: 'en-US', symbol: '$' },
  INR: { locale: 'en-IN', symbol: '₹' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
};

/**
 * Format a number into currency representation
 */
export function formatCurrency(
  value: number,
  currency: UserSettings['currency'] = 'USD',
  decimals: number = 2
): string {
  const config = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch (e) {
    // Fallback if formatting fails
    return `${config.symbol}${value.toFixed(decimals)}`;
  }
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Get color classes for financial status (positive, negative, neutral)
 * Supports colorblind mode (replacing green/red with blue/orange)
 */
export function getFinancialColorClass(
  value: number,
  colorblind: boolean = false,
  type: 'text' | 'bg' | 'border' = 'text'
): string {
  if (value === 0) {
    if (type === 'text') return 'text-slate-400';
    if (type === 'bg') return 'bg-slate-800';
    return 'border-slate-700';
  }

  const isPositive = value > 0;

  if (colorblind) {
    // Blue for positive, Orange/Amber for negative in colorblind mode
    if (isPositive) {
      if (type === 'text') return 'text-cyan-400';
      if (type === 'bg') return 'bg-cyan-500/10 text-cyan-400';
      return 'border-cyan-500/30';
    } else {
      if (type === 'text') return 'text-amber-500';
      if (type === 'bg') return 'bg-amber-500/10 text-amber-500';
      return 'border-amber-500/30';
    }
  } else {
    // Standard Green / Red
    if (isPositive) {
      if (type === 'text') return 'text-gain';
      if (type === 'bg') return 'bg-gain/10 text-gain';
      return 'border-gain/30';
    } else {
      if (type === 'text') return 'text-loss';
      if (type === 'bg') return 'bg-loss/10 text-loss';
      return 'border-loss/30';
    }
  }
}

/**
 * Resolve ticker symbol suffixes for display and lookup (e.g. resolve Indian stocks or US stocks)
 */
export function resolveSymbolForDisplay(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  // If it ends with .NS or .BO (NSE/BSE), remove it for cleaner display
  return clean.replace(/\.(NS|BO)$/, '');
}

/**
 * Helper to check if a symbol is an Indian stock based on suffix
 */
export function isIndianStock(symbol: string): boolean {
  return symbol.toUpperCase().endsWith('.NS') || symbol.toUpperCase().endsWith('.BO');
}
