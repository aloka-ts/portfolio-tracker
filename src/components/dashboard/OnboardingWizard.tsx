import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Database,
  User,
  ShieldCheck,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { parseSheetFile, mapRowsToHoldings, TARGET_FIELDS } from '../../lib/parsing/sheetParser';
import { importHoldings, importTransactions, portfolioStore, SEED_TRANSACTIONS } from '../../stores/portfolio';
import type { Holding } from '../../types';

export default function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [parseData, setParseData] = useState<any>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');
  
  // Account settings state
  const [username, setUsername] = useState<string>('');
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [hasUploadedData, setHasUploadedData] = useState<boolean>(false);
  const [uploadedUserName, setUploadedUserName] = useState<string>('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('portfolio_holdings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHasUploadedData(true);
          }
        }
        const userSaved = localStorage.getItem('portfolio_user');
        if (userSaved) {
          const parsedUser = JSON.parse(userSaved);
          setUploadedUserName(parsedUser.username || '');
        }
      } catch (e) {}
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseSheetFile(new Uint8Array(buffer));
        
        // Auto-fetch/import if required fields are mapped and there are no validation errors
        if (result.mappings.symbol && result.mappings.shares && result.mappings.avgCost && (!result.validationErrors || result.validationErrors.length === 0)) {
          const finalHoldings = mapRowsToHoldings(result.rows, result.mappings);
          importHoldings(finalHoldings, 'overwrite');
          localStorage.setItem('portfolio_user', JSON.stringify({
            username: 'Guest User',
            isAuthenticated: false
          }));
          window.location.href = '/dashboard';
          return;
        }

        setParseData(result);
        setMappings(result.mappings);
        setValidationErrors(result.validationErrors || []);
        setStep(2);
      } catch (err: any) {
        alert(err.message || 'Error parsing file. Please ensure it is a valid CSV or Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const loadDemoData = () => {
    // Seed the demo portfolio (same path as the dashboard's Load Sample Data)
    importHoldings([], 'overwrite');
    importTransactions(SEED_TRANSACTIONS, 'overwrite');
    window.location.href = '/dashboard';
  };

  const handleMappingChange = (field: string, sourceCol: string) => {
    const nextMappings = { ...mappings, [field]: sourceCol };
    setMappings(nextMappings);
    
    // Re-validate based on new mappings
    if (parseData) {
      const errors: any[] = [];
      parseData.rows.forEach((row: any, idx: number) => {
        const rowNum = idx + 1;
        
        if (field === 'symbol' || (field !== 'symbol' && nextMappings.symbol)) {
          const symCol = nextMappings.symbol;
          if (!row[symCol] || String(row[symCol]).trim() === '') {
            errors.push({ row: rowNum, field: 'symbol', message: 'Ticker symbol is empty.' });
          }
        }
        
        if (nextMappings.shares) {
          const val = Number(row[nextMappings.shares]);
          if (isNaN(val)) {
            errors.push({ row: rowNum, field: 'shares', message: 'Quantity is not a valid number.' });
          } else if (val <= 0) {
            errors.push({ row: rowNum, field: 'shares', message: 'Quantity should be greater than 0.' });
          }
        }
        
        if (nextMappings.avgCost) {
          const val = Number(row[nextMappings.avgCost]);
          if (isNaN(val)) {
            errors.push({ row: rowNum, field: 'avgCost', message: 'Average cost is not a valid number.' });
          } else if (val < 0) {
            errors.push({ row: rowNum, field: 'avgCost', message: 'Average cost cannot be negative.' });
          }
        }
      });
      setValidationErrors(errors);
    }
  };

  const handleValidateConfirm = () => {
    if (!mappings.symbol || !mappings.shares || !mappings.avgCost) {
      alert('Please map at least Ticker/Symbol, Shares/Quantity, and Avg Cost/Purchase Price columns.');
      return;
    }
    setStep(3);
  };

  const handleFinishOnboarding = () => {
    const finalHoldings = mapRowsToHoldings(parseData.rows, mappings);
    importHoldings(finalHoldings, importMode);

    // Save username & authentication status to localStorage
    if (username.trim()) {
      localStorage.setItem('portfolio_user', JSON.stringify({
        username: username.trim(),
        isAuthenticated: isAuth
      }));
    } else {
      localStorage.setItem('portfolio_user', JSON.stringify({
        username: 'Guest User',
        isAuthenticated: false
      }));
    }

    // Redirect to dashboard page
    window.location.href = '/dashboard';
  };

  return (
    <div className="w-full max-w-4xl mx-auto cyber-card p-6 md:p-8 backdrop-blur-md border-cyan-500/25">
      {/* Step Progress Indicators */}
      <div className="flex items-center justify-between mb-8 border-b border-cyan-500/10 pb-6">
        <div className="flex items-center space-x-3 font-tech">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-none text-cyan-400">
            <TrendingUp size={22} className="drop-shadow-[0_0_5px_rgba(0,242,254,0.5)]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-widest uppercase">[ PORTFOLIO_INITIALIZATION.WIZARD ]</h1>
            <p className="text-[10px] text-cyan-500/60 uppercase">COMPILES LIVE CLIENT-SIDE TELEMETRY</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-[10px] font-bold font-tech uppercase">
          <div className={`px-2.5 py-1 rounded-none border ${step >= 1 ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-cyan-500/10 text-cyan-500/40'}`}>1. UPLOAD</div>
          <div className="w-4 h-[1px] bg-cyan-500/20" />
          <div className={`px-2.5 py-1 rounded-none border ${step >= 2 ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-cyan-500/10 text-cyan-500/40'}`}>2. MAP_SCHEMA</div>
          <div className="w-4 h-[1px] bg-cyan-500/20" />
          <div className={`px-2.5 py-1 rounded-none border ${step >= 3 ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'border-cyan-500/10 text-cyan-500/40'}`}>3. FINALIZE</div>
        </div>
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <div className="space-y-6 font-tech">
          {hasUploadedData && (
            <div className="cyber-card p-5 border-gain/20 bg-gain/5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in mb-2 text-left text-gain">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gain/10 border border-gain/35 text-gain rounded-none shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest">[ ACTIVE_HOLDINGS_DETECTED ]</h4>
                  <p className="text-[10px] text-slate-300 mt-0.5 font-sans">
                    We found your uploaded portfolio for <span className="font-bold text-white">{uploadedUserName || 'GUEST USER'}</span>. You can restore it now.
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full sm:w-auto px-5 py-2.5 bg-gain hover:bg-gain/90 text-slate-950 font-bold text-xs rounded-none transition duration-150 flex items-center justify-center space-x-1.5 shrink-0 uppercase"
              >
                <span>RESTORE HUD DASHBOARD</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          <div className="text-center max-w-md mx-auto space-y-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider glow-text-cyan">:: INITIALIZE DATA MANIFEST</h2>
            <p className="text-xs text-cyan-500/60 uppercase">
              Drag and drop transaction CSV, XLSX, or XLS records. Calculations process client-side.
            </p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border border-dashed p-10 text-center cursor-pointer transition duration-200 flex flex-col items-center justify-center space-y-4 rounded-none ${
              dragActive 
                ? 'border-cyan-400 bg-cyan-500/10' 
                : 'border-cyan-500/30 hover:border-cyan-500/60 bg-black/60 hover:bg-cyan-500/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls,.ods"
              className="hidden"
            />
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Upload size={30} className="drop-shadow-[0_0_5px_rgba(0,242,254,0.3)]" />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-widest">DRAG FILE HERE OR CLICK TO MOUNT</p>
              <p className="text-[10px] text-cyan-500/50 mt-1 uppercase">Supports CSV, XLSX, XLS, and ODS indexes</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-cyan-500/10">
            <div className="flex items-center space-x-2 text-[10px] text-cyan-500/60 uppercase">
              <ShieldCheck size={16} className="text-cyan-400" />
              <span>ISOLATED_DATA: TRANSACTIONS COMPILE SECURELY LOCALLY.</span>
            </div>
            
            <button
              onClick={loadDemoData}
              className="w-full sm:w-auto px-5 py-2.5 bg-black hover:bg-cyan-500/10 text-cyan-300 font-bold text-xs rounded-none border border-cyan-500/30 hover:border-cyan-400 transition duration-150 flex items-center justify-center space-x-2 uppercase"
            >
              <span>RUN SEED_DEMO DATA</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW & COLUMN MAPPING */}
      {step === 2 && parseData && (
        <div className="space-y-6 font-tech">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider glow-text-cyan">[ PREVIEW & DEFINE COLUMN MAPPINGS ]</h2>
              <p className="text-[10px] text-cyan-500/60 uppercase">MOUNTED FILE: {fileName}</p>
            </div>
            
            <button 
              onClick={() => setStep(1)} 
              className="text-xs text-cyan-400 hover:text-cyan-300 underline uppercase"
            >
              Mount different index
            </button>
          </div>

          {/* Validation alerts */}
          {validationErrors.length > 0 ? (
            <div className="p-4 bg-loss/5 border border-loss/20 rounded-none flex items-start space-x-3 text-loss uppercase text-[10px]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="font-bold">Detected {validationErrors.length} validation issues:</span>
                <p className="opacity-80 font-sans tracking-normal lowercase">Review mappings below to align columns correctly.</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gain/5 border border-gain/20 rounded-none flex items-start space-x-3 text-gain uppercase text-[10px]">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">SCHEMA VALIDATION PASSED:</span> ALL COLUMNS READY FOR EXTRACTION.
              </div>
            </div>
          )}

          {/* Mapping selection dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 p-4 border border-cyan-500/20 rounded-none">
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 uppercase tracking-widest">[ MAP DATA COLUMNS ]</h3>
              <div className="space-y-3.5">
                {Object.entries(TARGET_FIELDS).map(([field, config]) => {
                  const isRequired = field !== 'dateAcquired';
                  return (
                    <div key={field} className="flex flex-col space-y-1">
                      <label className="text-[10px] font-bold text-cyan-500/80 flex items-center justify-between uppercase">
                        <span>{config.label} {isRequired && <span className="text-loss">*</span>}</span>
                      </label>
                      <select
                        value={mappings[field] || ''}
                        onChange={(e) => handleMappingChange(field, e.target.value)}
                        className={`bg-black/90 border text-xs text-cyan-300 rounded-none p-2 focus:border-cyan-400 outline-none font-tech ${
                          isRequired && !mappings[field] ? 'border-loss/40' : 'border-cyan-500/20'
                        }`}
                      >
                        <option value="">-- CHOOSE COLUMN --</option>
                        {parseData.headers.map((h: string) => (
                          <option key={h} value={h}>{h.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Panel */}
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-cyan-400 mb-3 uppercase tracking-widest">[ RAW SHEET PREVIEW - FIRST 5 ROWS ]</h3>
              <div className="flex-1 overflow-auto border border-cyan-500/20 rounded-none bg-black/60 max-h-[220px]">
                <table className="w-full text-[9px] text-left text-slate-300">
                  <thead className="bg-black sticky top-0 text-cyan-400 font-bold border-b border-cyan-500/20 uppercase tracking-wider">
                    <tr>
                      {parseData.headers.map((h: string) => (
                        <th key={h} className="p-2 border-r border-cyan-500/10 truncate max-w-[80px]" title={h}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parseData.previewRows.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="border-b border-cyan-500/10 hover:bg-cyan-500/5">
                        {parseData.headers.map((h: string) => (
                          <td key={h} className="p-2 border-r border-cyan-500/10 truncate max-w-[80px] font-mono-nums text-slate-400" title={String(row[h] || '')}>
                            {String(row[h] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-cyan-500/40 mt-2 uppercase font-bold">
                PROCESSED ROWS: PREVIEWING 5 OF {parseData.rows.length} RECORD BLOCKS
              </p>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="flex justify-end pt-4 border-t border-cyan-500/10">
            <button
              onClick={handleValidateConfirm}
              disabled={!mappings.symbol || !mappings.shares || !mappings.avgCost}
              className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-none transition duration-150 flex items-center space-x-2 uppercase"
            >
              <span>CONFIRM SCHEMA MAPPING</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: FINALIZE */}
      {step === 3 && (
        <div className="space-y-6 font-tech">
          <div className="text-center max-w-md mx-auto space-y-2">
            <div className="mx-auto p-3 bg-gain/10 border border-gain/35 rounded-none text-gain w-fit mb-2">
              <FileCheck size={28} className="drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider glow-text-cyan">:: DEFINE IMPORT CONFIGURATION</h2>
            <p className="text-xs text-cyan-500/60 uppercase">
              Configure target database import policy strategies and custom profile identities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-w-2xl mx-auto">
            {/* Import Mode Selection */}
            <div className="bg-black/60 p-5 border border-cyan-500/20 rounded-none space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center space-x-1.5">
                <Database size={14} className="text-cyan-400" />
                <span>[ DB_IMPORT_STRATEGY ]</span>
              </h3>
              
              <div className="space-y-2.5">
                <label className="flex items-start space-x-3 p-3 rounded-none border border-cyan-500/20 hover:bg-cyan-500/5 cursor-pointer transition">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'overwrite'}
                    onChange={() => setImportMode('overwrite')}
                    className="mt-1 accent-cyan-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block uppercase">Overwrite database</span>
                    <span className="text-[10px] text-cyan-500/50 block mt-0.5 font-sans normal-case">Clears local storage data cache and replaces it with this parsed dataset.</span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-none border border-cyan-500/20 hover:bg-cyan-500/5 cursor-pointer transition">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-1 accent-cyan-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block uppercase">Merge datasets</span>
                    <span className="text-[10px] text-cyan-500/50 block mt-0.5 font-sans normal-case">Merges holdings together, adjusting shared quantity weights.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Profile Setup */}
            <div className="bg-black/60 p-5 border border-cyan-500/20 rounded-none space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center space-x-1.5">
                <User size={14} className="text-cyan-400" />
                <span>[ USER_PROFILE_SETUP ]</span>
              </h3>

              <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[9px] uppercase text-cyan-500/60 font-bold">CLIENT DISPLAY_NAME</label>
                  <input
                    type="text"
                    placeholder="ENTER ID..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-black/90 border border-cyan-500/30 text-xs text-cyan-300 rounded-none p-2 focus:border-cyan-400 outline-none uppercase font-tech"
                  />
                </div>

                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={isAuth}
                    onChange={(e) => setIsAuth(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span className="text-[10px] text-cyan-500/60 uppercase font-bold">AUTH ENCRYPTION PROTOTYPE</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-cyan-500/10 max-w-2xl mx-auto">
            <button
              onClick={() => setStep(2)}
              className="text-xs text-cyan-500 hover:text-cyan-300 uppercase underline"
            >
              Back to mappings
            </button>
            
            <button
              onClick={handleFinishOnboarding}
              className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-none transition duration-150 flex items-center space-x-2 uppercase"
            >
              <span>INITIALIZE DASHBOARD</span>
              <CheckCircle2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
