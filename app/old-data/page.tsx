'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import PucTable, { PucRecordRow } from '@/components/PucTable';
import FilterBar, { FilterParams } from '@/components/FilterBar';
import CreatePucModal from '@/components/CreatePucModal';

export default function OldDataPage() {
  const [records, setRecords] = useState<PucRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentRange, setCurrentRange] = useState<FilterParams>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchRecords = useCallback(async (params: FilterParams) => {
    setLoading(true);
    setSearched(true);
    setCurrentRange(params);

    try {
      const urlParams = new URLSearchParams({ type: 'old', limit: '500' });
      if (params.startDate) urlParams.set('startDate', params.startDate);
      if (params.endDate) urlParams.set('endDate', params.endDate);
      if (params.year) urlParams.set('year', params.year);
      if (params.month) urlParams.set('month', params.month);
      if (params.week) urlParams.set('week', params.week);
      if (params.day) urlParams.set('day', params.day);

      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.replaceState(null, '', newUrl);
      }

      const res = await fetch(`/api/puc?${urlParams}`);
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to fetch old records');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExport = useCallback(async (params: FilterParams) => {
    setExporting(true);
    try {
      const urlParams = new URLSearchParams({ type: 'old' });
      if (params.startDate) urlParams.set('startDate', params.startDate);
      if (params.endDate) urlParams.set('endDate', params.endDate);
      if (params.year) urlParams.set('year', params.year);
      if (params.month) urlParams.set('month', params.month);
      if (params.week) urlParams.set('week', params.week);
      if (params.day) urlParams.set('day', params.day);

      const res = await fetch(`/api/puc/export?${urlParams}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `old-puc-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/puc?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete record');
        return;
      }
      if (searched) {
        fetchRecords(currentRange);
      }
    } catch {
      alert('Error deleting record');
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    if (searched) {
      fetchRecords(currentRange);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#020617' }}>
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Page title & Create button */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Old PUC Data</h1>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
              Browse and export historical PUC records by year, month, week, or day
            </p>
          </div>
          <div className="flex items-center gap-3">
            {searched && (
              <div
                className="text-sm px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#38bdf8' }}
              >
                {total} record{total !== 1 ? 's' : ''} found
              </div>
            )}
            <button
              id="old-data-create-btn"
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Create PUC
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          type="old"
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
            <div className="w-2 h-2 rounded-full" style={{ background: '#0ea5e9' }} />
            <h2 className="font-bold text-white text-sm">
              {searched ? 'Filtered Records' : 'All Records'}
            </h2>
            {searched && (
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(14,165,233,0.12)', color: '#38bdf8' }}
              >
                {records.length}
              </span>
            )}
          </div>
          <PucTable
            records={searched ? records : []}
            loading={loading}
            emptyMessage={
              searched ? 'No records found for the selected period' : 'Select a year/month/week/day and click Search to view records'
            }
            showStatus
            onDelete={handleDelete}
          />
        </div>
      </main>

      {showCreateModal && (
        <CreatePucModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
