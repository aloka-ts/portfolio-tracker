import * as XLSX from 'xlsx';
import type { Holding } from '../../types';

// Standard fields we want to extract
export const TARGET_FIELDS = {
  symbol: { label: 'Ticker / Symbol', keys: ['symbol', 'ticker', 'stock', 'equity', 'instrument', 'code', 'asset'] },
  shares: { label: 'Shares / Quantity', keys: ['shares', 'quantity', 'qty', 'units', 'volume', 'size', 'count'] },
  avgCost: { label: 'Avg Cost / Purchase Price', keys: ['avgcost', 'avg cost', 'costbasis', 'cost basis', 'purchase price', 'price', 'avg_cost', 'cost', 'buyprice', 'buy price'] },
  platform: { label: 'Platform / Broker', keys: ['platform', 'broker', 'account', 'exchange', 'wallet', 'depository'] },
  dateAcquired: { label: 'Date Acquired (Optional)', keys: ['date', 'dateacquired', 'date acquired', 'purchase date', 'acquired'] },
};

export interface ParseResult {
  headers: string[];
  mappings: Record<string, string>; // Maps target field -> source column header
  rows: Record<string, any>[];      // Raw row data parsed as objects
  previewRows: Record<string, any>[]; // First 5 rows
  validationErrors: Array<{ row: number; field: string; message: string }>;
}

/**
 * Normalizes text for comparison by lowercasing and trimming
 */
function normalize(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Fuzzy matches a sheet header name against our predefined targets
 */
function detectMapping(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  Object.entries(TARGET_FIELDS).forEach(([field, config]) => {
    // Look for exact or fuzzy match
    const match = headers.find(h => {
      const normH = normalize(h);
      return config.keys.some(k => normalize(k) === normH || normH.includes(normalize(k)));
    });
    if (match) {
      mappings[field] = match;
    }
  });
  
  return mappings;
}

/**
 * Parse a file (buffer) into a ParseResult
 */
function normalizeSymbol(sym: any): string {
  let s = String(sym || '').trim().toUpperCase();
  if (s.startsWith('NSE:')) {
    s = s.substring(4) + '.NS';
  } else if (s.startsWith('BSE:')) {
    s = s.substring(4) + '.BO';
  } else if (s !== '' && !s.includes('_') && !s.endsWith('.NS') && !s.endsWith('.BO')) {
    const COMMON_US_TICKERS = [
      'AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 
      'AMD', 'INTC', 'PYPL', 'ADBE', 'CSCO', 'PEP', 'KO', 'NKE', 'DIS', 'XOM',
      'JPM', 'BAC', 'V', 'MA', 'WMT', 'PG', 'HD', 'JNJ', 'MRK', 'ABBV', 'LLY',
      'UNH', 'COST', 'AVGO', 'CRM', 'ORCL', 'QCOM', 'TXN', 'HON', 'AMGN', 'SBUX'
    ];
    if (COMMON_US_TICKERS.includes(s)) {
      return s; // Keep US ticker clean
    }
    s = s + '.NS';
  }
  return s;
}

export function parseSheetFile(data: ArrayBuffer | Uint8Array): ParseResult {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  
  const pmSheetName = workbook.SheetNames.find(n => n.toLowerCase().trim() === '4.portfolio management');
  const restSheetName = workbook.SheetNames.find(n => n.toLowerCase().trim() === 'rest of portfolio');
  
  // If the workbook has our specific multi-sheet structure, parse intelligently!
  if (pmSheetName || restSheetName) {
    const rows: Record<string, any>[] = [];
    
    // 1. Process "4.Portfolio Management" sheet
    if (pmSheetName) {
      const ws = workbook.Sheets[pmSheetName];
      const dataRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      let headers: string[] | null = null;
      let scriptIdx = -1, qtyIdx = -1, priceIdx = -1, statusIdx = -1;
      
      dataRows.forEach((row) => {
        if (row.includes('Script') && row.includes('Qty')) {
          headers = row;
          scriptIdx = row.indexOf('Script');
          qtyIdx = row.indexOf('Qty');
          priceIdx = row.indexOf('Entry Price');
          statusIdx = row.indexOf('Status');
          return;
        }
        
        if (headers && row.length > 0) {
          const symbol = row[scriptIdx];
          const qty = Number(row[qtyIdx]);
          const price = Number(row[priceIdx]);
          const status = String(row[statusIdx]).trim();
          
          if (symbol && qty > 0 && status === 'Active') {
            rows.push({
              Symbol: normalizeSymbol(symbol),
              Shares: qty,
              'Avg Cost': price || 0,
              Platform: 'Portfolio Management'
            });
          }
        }
      });
    }
    
    // 2. Process "Rest of portfolio" sheet
    if (restSheetName) {
      const ws = workbook.Sheets[restSheetName];
      const dataRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      let currentSection = 'Rest of Portfolio';
      let headers: string[] | null = null;
      let scriptIdx = -1, qtyIdx = -1, priceIdx = -1, statusIdx = -1;
      
      dataRows.forEach((row) => {
        const cell0 = String(row[0] || '').trim();
        const cell1 = String(row[1] || '').trim();
        
        let sectionTitle = '';
        if (/portfolio|mutual\s*funds/i.test(cell0)) {
          sectionTitle = cell0;
        } else if (/portfolio|mutual\s*funds/i.test(cell1)) {
          sectionTitle = cell1;
        }
        
        if (sectionTitle) {
          currentSection = sectionTitle;
          headers = null; // reset to find headers in the next section block
          return;
        }
        
        if (row.includes('Script') && row.includes('Qty')) {
          headers = row;
          scriptIdx = row.indexOf('Script');
          qtyIdx = row.indexOf('Qty');
          priceIdx = row.indexOf('Entry Price');
          statusIdx = row.indexOf('Status');
          return;
        }
        
        if (headers && row.length > 0) {
          const symbol = row[scriptIdx];
          const qty = Number(row[qtyIdx]);
          const price = Number(row[priceIdx]);
          const status = String(row[statusIdx]).trim();
          
          if (symbol && qty > 0 && status === 'Active') {
            rows.push({
              Symbol: normalizeSymbol(symbol),
              Shares: qty,
              'Avg Cost': price || 0,
              Platform: currentSection
            });
          }
        }
      });
    }
    
    if (rows.length === 0) {
      throw new Error('No active holdings found in the uploaded portfolio sheets.');
    }
    
    return {
      headers: ['Symbol', 'Shares', 'Avg Cost', 'Platform'],
      mappings: {
        symbol: 'Symbol',
        shares: 'Shares',
        avgCost: 'Avg Cost',
        platform: 'Platform'
      },
      rows,
      previewRows: rows.slice(0, 5),
      validationErrors: [],
      isAutoParsed: true
    };
  }

  // Fallback to standard single-sheet parsing
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  
  if (rawRows.length === 0) {
    throw new Error('The uploaded file appears to be empty.');
  }
  
  const headers = Object.keys(rawRows[0] || {});
  const mappings = detectMapping(headers);
  
  // Filter out rows that are completely empty or represent footer/totals
  const rows = rawRows.filter(row => {
    const values = Object.values(row).map(v => String(v).trim());
    const hasAnyContent = values.some(v => v !== '');
    if (!hasAnyContent) return false;
    
    if (mappings.symbol) {
      const symVal = String(row[mappings.symbol] || '').trim();
      if (symVal === '') return false;
      
      const lowerSym = symVal.toLowerCase();
      if (lowerSym === 'total' || lowerSym === 'grand total' || lowerSym === 'subtotal' || lowerSym.includes('portfolio value')) {
        return false;
      }
    }
    return true;
  });
  
  if (rows.length === 0) {
    throw new Error('No valid holding rows found in the uploaded file.');
  }
  
  const validationErrors: ParseResult['validationErrors'] = [];
  
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    
    if (mappings.symbol) {
      const symbolVal = row[mappings.symbol];
      if (!symbolVal || String(symbolVal).trim() === '') {
        validationErrors.push({ row: rowNum, field: 'symbol', message: 'Ticker symbol is empty.' });
      }
    } else {
      if (idx === 0) {
        validationErrors.push({ row: 0, field: 'symbol', message: 'Could not auto-detect Ticker / Symbol column.' });
      }
    }
    
    if (mappings.shares) {
      const sharesVal = Number(row[mappings.shares]);
      if (isNaN(sharesVal)) {
        validationErrors.push({ row: rowNum, field: 'shares', message: 'Quantity is not a valid number.' });
      } else if (sharesVal <= 0) {
        validationErrors.push({ row: rowNum, field: 'shares', message: 'Quantity should be greater than 0.' });
      }
    }
    
    if (mappings.avgCost) {
      const costVal = Number(row[mappings.avgCost]);
      if (isNaN(costVal)) {
        validationErrors.push({ row: rowNum, field: 'avgCost', message: 'Average cost is not a valid number.' });
      } else if (costVal < 0) {
        validationErrors.push({ row: rowNum, field: 'avgCost', message: 'Average cost cannot be negative.' });
      }
    }
  });
  
  return {
    headers,
    mappings,
    rows,
    previewRows: rows.slice(0, 5),
    validationErrors,
  };
}

/**
 * Maps raw sheet rows to Holding structures using manual/automatic mapping config
 */
export function mapRowsToHoldings(
  rows: Record<string, any>[],
  mappings: Record<string, string>
): Holding[] {
  return rows.map((row, index) => {
    const rawSymbol = mappings.symbol ? String(row[mappings.symbol] || '').trim().toUpperCase() : '';
    const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : `UNKNOWN-${index}`;
    const shares = mappings.shares ? Number(row[mappings.shares]) || 0 : 0;
    const avgCost = mappings.avgCost ? Number(row[mappings.avgCost]) || 0 : 0;
    const platform = mappings.platform ? String(row[mappings.platform] || '').trim() : 'Unknown';
    const dateAcquiredVal = mappings.dateAcquired ? row[mappings.dateAcquired] : undefined;
    
    let dateAcquired: string | undefined;
    if (dateAcquiredVal) {
      if (dateAcquiredVal instanceof Date) {
        dateAcquired = dateAcquiredVal.toISOString().split('T')[0];
      } else {
        dateAcquired = String(dateAcquiredVal).trim();
      }
    }
    
    return {
      symbol,
      shares,
      avgCost,
      platform,
      dateAcquired,
    };
  }).filter(h => h.symbol !== '' && h.shares > 0);
}
