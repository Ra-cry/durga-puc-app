'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import PucTable, { PucRecordRow } from '@/components/PucTable';
import CreatePucModal from '@/components/CreatePucModal';
import ImportModal from '@/components/ImportModal';

export default function DashboardPage() {
  const [todayRecords, setTodayRecords] = useState<PucRecordRow[]>([]);
  const [expiredToday, setExpiredToday] = useState<PucRecordRow[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingExpired, setLoadingExpired] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportBtn, setShowImportBtn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PucRecordRow[] | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);

  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const res = await fetch('/api/puc?type=today&limit=200');
      const data = await res.json();
      setTodayRecords(data.records || []);
      setTodayCount(data.total || 0);
    } catch {
      setTodayRecords([]);
      setTodayCount(0);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const fetchExpiredToday = useCallback(async () => {
    setLoadingExpired(true);
    try {
      const res = await fetch('/api/puc?type=today_expired&limit=200');
      const data = await res.json();
      setExpiredToday(data.records || []);
      setExpiredCount(data.total || 0);
    } catch {
      setExpiredToday([]);
      setExpiredCount(0);
    } finally {
      setLoadingExpired(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
    fetchExpiredToday();
  }, [fetchToday, fetchExpiredToday]);

  // F7 keypress reveals import button
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowImportBtn((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Search
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/puc?type=search&search=${encodeURIComponent(q)}&limit=100`);
      const data = await res.json();
      setSearchResults(data.records || []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchToday();
    fetchExpiredToday();
  };

  const handleImportSuccess = () => {
    fetchToday();
    fetchExpiredToday();
  };

  return (
    <div className="min-h-screen" style={{ background: '#020617' }}>
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top controls bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#64748b' }}
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                id="dashboard-search"
                type="text"
                className="input-field"
                placeholder="Search vehicle number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
            <button id="dashboard-search-btn" type="submit" className="btn-primary" disabled={loadingSearch}>
              {loadingSearch ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Search'}
            </button>
            {searchResults !== null && (
              <button id="dashboard-clear-search" type="button" className="btn-secondary" onClick={handleClearSearch}>
                Clear
              </button>
            )}
          </form>

          <div className="flex gap-2 ml-auto">
            {showImportBtn && (
              <button
                id="dashboard-import-btn"
                className="btn-secondary animate-fade-in"
                onClick={() => setShowImportModal(true)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                    clipRule="evenodd"
                  />
                </svg>
                Import Data (Excel)
              </button>
            )}

            <button
              id="dashboard-create-btn"
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

        {/* Search results panel */}
        {searchResults !== null && (
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
              <div>
                <h2 className="font-bold text-white text-sm">
                  Search Results
                  <span className="ml-2 text-xs font-normal" style={{ color: '#64748b' }}>
                    {searchResults.length} record{searchResults.length !== 1 ? 's' : ''} found for &quot;{searchQuery}&quot;
                  </span>
                </h2>
              </div>
            </div>
            <PucTable
              records={searchResults}
              loading={loadingSearch}
              emptyMessage={`No vehicles found matching "${searchQuery}"`}
              showStatus
            />
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="glass-card p-4 flex items-center gap-4"
            style={{ borderLeft: '3px solid #0ea5e9' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(14,165,233,0.12)' }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" style={{ color: '#38bdf8' }}>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{todayCount}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                PUCs Issued Today
              </p>
            </div>
          </div>

          <div
            className="glass-card p-4 flex items-center gap-4"
            style={{ borderLeft: '3px solid #ef4444' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(239,68,68,0.12)' }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" style={{ color: '#f87171' }}>
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{expiredCount}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Expired Today
              </p>
            </div>
          </div>
        </div>

        {/* Two panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's PUC */}
          <div className="glass-card overflow-hidden">
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: '#0ea5e9' }}
              />
              <h2 className="font-bold text-white text-sm">Today&apos;s PUC</h2>
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(14,165,233,0.12)', color: '#38bdf8' }}
              >
                {todayRecords.length}
              </span>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <PucTable
                records={todayRecords}
                loading={loadingToday}
                emptyMessage="No PUCs issued today yet"
                showIssuedAt={false}
              />
            </div>
          </div>

          {/* Today's Expired */}
          <div className="glass-card overflow-hidden">
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: '#ef4444' }}
              />
              <h2 className="font-bold text-white text-sm">Today&apos;s Expired PUC</h2>
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
              >
                {expiredToday.length}
              </span>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <PucTable
                records={expiredToday}
                loading={loadingExpired}
                emptyMessage="No PUCs expiring today"
                showIssuedAt={false}
                showStatus
              />
            </div>
          </div>
        </div>

        {/* F7 hint */}
        <p className="text-xs text-center" style={{ color: '#1e293b' }}>
          Press F3 to reveal import button
        </p>
      </main>

      {showCreateModal && (
        <CreatePucModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
