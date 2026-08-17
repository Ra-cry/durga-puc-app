'use client';

import { useState, useRef } from 'react';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SkippedRow {
  row: number;
  reason: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  skippedDetails: SkippedRow[];
}

export default function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/puc/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setResult(data);
      if (data.imported > 0) onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content glass-card p-6" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Import PUC Data</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Upload an Excel file (.xlsx) to bulk import records
            </p>
          </div>
          <button
            id="import-close"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-slate-800"
            style={{ color: '#64748b' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Expected columns info */}
        <div
          className="p-3 rounded-lg mb-5 text-xs"
          style={{
            background: 'rgba(14,165,233,0.06)',
            border: '1px solid rgba(14,165,233,0.15)',
            color: '#94a3b8',
          }}
        >
          <p className="font-semibold mb-1" style={{ color: '#38bdf8' }}>
            Expected Excel Columns:
          </p>
          <p>
            Vehicle No · BS Stage · Fuel · Customer Name · Customer Phone · Agent ·{' '}
            <span style={{ color: '#f8fafc' }}>Issued Date (dd-mm-yyyy)</span>
          </p>
        </div>

        {/* File picker */}
        <div
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
          style={{
            borderColor: file ? '#0ea5e9' : '#334155',
            background: file ? 'rgba(14,165,233,0.05)' : 'rgba(30,41,59,0.3)',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            id="import-file-input"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" style={{ color: '#38bdf8' }}>
                <path
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {(file.size / 1024).toFixed(1)} KB · Click to change
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" style={{ color: '#334155' }}>
                <path
                  d="M4 16l4-4 4 4m0 0l4-4 4 4M12 12v8M20 8a4 4 0 00-4-4H8a4 4 0 00-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
                Click to select Excel file
              </p>
              <p className="text-xs" style={{ color: '#475569' }}>
                Supports .xlsx format
              </p>
            </div>
          )}
        </div>

        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm mt-4"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Import result */}
        {result && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3 rounded-lg text-center"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>
                  {result.imported}
                </p>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  Records Imported
                </p>
              </div>
              <div
                className="p-3 rounded-lg text-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <p className="text-2xl font-bold" style={{ color: '#f87171' }}>
                  {result.skipped}
                </p>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  Rows Skipped
                </p>
              </div>
            </div>

            {result.skippedDetails.length > 0 && (
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div
                  className="px-3 py-2 text-xs font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                >
                  Skipped Rows ({result.skippedDetails.length})
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {result.skippedDetails.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs"
                      style={{
                        borderTop: i > 0 ? '1px solid rgba(30,41,59,0.6)' : undefined,
                        color: '#94a3b8',
                      }}
                    >
                      <span style={{ color: '#64748b', minWidth: 40 }}>Row {d.row}</span>
                      <span>{d.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button id="import-cancel" className="btn-secondary flex-1" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              id="import-submit"
              className="btn-primary flex-1"
              disabled={!file || loading}
              onClick={handleImport}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  Importing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path
                      fillRule="evenodd"
                      d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Import Data
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
