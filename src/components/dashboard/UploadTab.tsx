import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { importHoldings } from '../../stores/portfolio';
import { settingsStore } from '../../stores/settings';
import { parseSheetFile, mapRowsToHoldings } from '../../lib/parsing/sheetParser';
import { AlertCircle, CheckCircle2, Upload, FileSpreadsheet, Sparkles, HelpCircle } from 'lucide-react';

interface UploadTabProps {
  onSuccess?: () => void;
}

export default function UploadTab({ onSuccess }: UploadTabProps) {
  const settings = useStore(settingsStore);

  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

        // Import holdings (which converts them to BUY transactions)
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
    <div className="space-y-6 max-w-4xl mx-auto font-sans">
      
      <div className="page-title-row">
        <h1 className="page-title flex items-center gap-2">
          <FileSpreadsheet className="text-accent" size={24} />
          <span>Upload Portfolio Spreadsheet</span>
        </h1>
        <p className="page-subtitle">
          Import your equity ledger in bulk. We support Zerodha console holdings, Groww CSV exports, and custom Excel templates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Dropzone Card */}
        <div className="md:col-span-2 cyber-card p-6 space-y-5 flex flex-col">
          <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
            [ Drag & Drop Telemetry ]
          </span>

          {uploadSuccess && (
            <div className="p-3.5 bg-gain/5 border border-gain/20 text-gain text-xs font-semibold rounded-lg flex items-center gap-2 animate-pulse">
              <CheckCircle2 size={16} />
              <span>Spreadsheet parsed and imported successfully! Syncing portfolio...</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3.5 bg-loss/5 border border-loss/20 text-loss text-xs rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`min-h-[280px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition duration-200 relative cursor-pointer ${
              isDragging
                ? 'border-accent bg-accent/5'
                : 'border-white/[0.08] hover:border-white/20 bg-black/30'
            }`}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-full text-accent mb-4">
              <Upload size={32} className="animate-pulse" />
            </div>

            <span className="text-sm font-bold text-white block uppercase tracking-wide">
              Drag & Drop Portfolio File
            </span>
            
            <span className="text-xs text-slate-400 mt-1 block font-sans">
              Supports .CSV, .XLSX, or .XLS file extensions
            </span>

            <div className="flex items-center gap-2 mt-5 text-[10px] font-mono text-slate-500 uppercase">
              <Sparkles size={12} className="text-accent" />
              <span>Auto-maps headers dynamically</span>
            </div>
          </div>
        </div>

        {/* Instructions & Help */}
        <div className="md:col-span-1 space-y-6">
          
          <div className="cyber-card p-5 space-y-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5">
              [ Column Specifications ]
            </span>
            <div className="space-y-3 text-xs font-sans">
              <p className="text-slate-400 leading-relaxed">
                The parser will automatically scan your sheet headers. For best results, ensure your file contains the following column headers:
              </p>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="text-slate-500">Symbol / Ticker:</span>
                  <span className="text-white font-bold">e.g. AAPL, TCS.NS</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="text-slate-500">Quantity / Shares:</span>
                  <span className="text-white font-bold">e.g. 15.5</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="text-slate-500">Average Cost / Price:</span>
                  <span className="text-white font-bold">e.g. 182.50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Custodian / Platform:</span>
                  <span className="text-white font-bold">e.g. Zerodha, Groww</span>
                </div>
              </div>
            </div>
          </div>

          <div className="cyber-card p-5 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-white/[0.04] pb-2.5 flex items-center gap-1">
              <HelpCircle size={14} className="text-accent" />
              <span>[ Platform Support ]</span>
            </span>
            <p className="text-xs text-slate-400 leading-normal font-sans">
              Directly upload spreadsheets exported from **Zerodha Console**, **Groww**, or **Vested**. Custom Excel files with standard headers are also supported.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
