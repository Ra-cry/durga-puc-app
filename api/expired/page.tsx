'use client';

import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import PucTable, { PucRecordRow } from '@/components/PucTable';
import FilterBar from '@/components/FilterBar';

export default function ExpiredPage() {
  const [records, setRecords] = useState<PucRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Load all expired on mount (no filter applied)
  const fetchRecords = useCallback(async (params: { startDate?: string; endDate?: string } = {}) => {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams({ type: 'expired', limit: '500' });
      if (params.startDate) urlParams.set('startDate', params.startDate);
      if (params.endDate) urlParams.set('endDate', params.endDate);

      const res = await fetch(`/api/puc?${urlParams}`);
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to fetch expired records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleExport = useCallback(async (params: { startDate?: string; endDate?: string }) => {
    setExporting(true);
    try {
      const urlParams = new URLSearchParams({ type: 'expired' });
      if (params.startDate) urlParams.set('startDate', params.startDate);
      if (params.endDate) urlParams.set('endDate', params.endDate);

      const res = await fetch(`/api/puc/export?${urlParams}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expired-puc-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#020617' }}>
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Expired PUC Records</h1>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
              All certificates that have passed their expiry date
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: '#f87171' }}>
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-bold" style={{ color: '#f87171' }}>
              {total}
            </span>
            <span className="text-xs" style={{ color: '#ef4444' }}>
              Total Expired
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          type="expired"
          onFilterChange={fetchRecords}
          onExport={handleExport}
          exporting={exporting}
        />

        {/* Results */}
        <div className="glass-card overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <h2 className="font-bold text-white text-sm">Expired Certificates</h2>
            <span
              className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
            >
              {records.length}
            </span>
          </div>
          <PucTable
            records={records}
            loading={loading}
            emptyMessage="No expired records found"
            showStatus
          />
        </div>
      </main>
    </div>
  );
}
