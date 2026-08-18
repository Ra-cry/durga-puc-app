'use client';

import { useState } from 'react';
import { formatIST, isRecordExpired } from '@/lib/clientHelpers';

export interface PucRecordRow {
  _id: string;
  vehicleNo: string;
  bsStage: string;
  fuelType: string;
  customerName: string;
  customerPhone: string;
  agent?: string | null;
  issuedAt: string;
  validTill: string;
  status: string;
  source: string;
}

interface PucTableProps {
  records: PucRecordRow[];
  loading?: boolean;
  emptyMessage?: string;
  showStatus?: boolean;
  showIssuedAt?: boolean;
  onDelete?: (id: string, vehicleNo: string) => Promise<void> | void;
}

export default function PucTable({
  records,
  loading = false,
  emptyMessage = 'No records found',
  showStatus = false,
  showIssuedAt = true,
  onDelete,
}: PucTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmRecord, setConfirmRecord] = useState<{ id: string; vehicleNo: string } | null>(null);

  const handleDeleteClick = (id: string, vehicleNo: string) => {
    setConfirmRecord({ id, vehicleNo });
  };

  const handleConfirmDelete = async () => {
    if (!confirmRecord || !onDelete) return;
    const { id, vehicleNo } = confirmRecord;
    setDeletingId(id);
    try {
      await onDelete(id, vehicleNo);
      setConfirmRecord(null);
    } catch {
      // Error handled by parent
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <span className="text-sm" style={{ color: '#64748b' }}>
          Loading records...
        </span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 gap-3 text-center"
        style={{ color: '#475569' }}
      >
        <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12 opacity-30">
          <rect x="8" y="6" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16h16M16 22h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-hidden">
        <table className="data-table w-full table-fixed">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: showIssuedAt ? '14%' : '17%' }}>Vehicle No</th>
              <th style={{ width: '9%' }}>BS</th>
              <th style={{ width: '9%' }}>Fuel</th>
              <th style={{ width: showIssuedAt ? '17%' : '22%' }}>Customer</th>
              <th style={{ width: '13%' }}>Phone</th>
              <th style={{ width: '9%' }}>Agent</th>
              {showIssuedAt && <th style={{ width: '12%' }}>Issued On</th>}
              <th style={{ width: showIssuedAt ? '12%' : '15%' }}>Valid Till</th>
              {showStatus && <th style={{ width: '10%' }}>Status</th>}
              {onDelete && <th style={{ width: '7%', textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const expired = isRecordExpired(r.validTill, r.status);
              return (
                <tr key={r._id} className="animate-fade-in">
                  <td style={{ color: '#475569', fontSize: '0.75rem' }}>{i + 1}</td>
                  <td className="font-mono font-bold text-white tracking-wide truncate" title={r.vehicleNo}>
                    {r.vehicleNo}
                  </td>
                  <td>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                      style={{
                        background: 'rgba(14,165,233,0.1)',
                        color: '#38bdf8',
                        border: '1px solid rgba(14,165,233,0.2)',
                      }}
                    >
                      {r.bsStage}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{r.fuelType}</td>
                  <td className="truncate text-slate-200" title={r.customerName}>
                    {r.customerName}
                  </td>
                  <td style={{ color: '#94a3b8' }} className="font-mono text-xs truncate">
                    {r.customerPhone}
                  </td>
                  <td style={{ color: '#64748b' }} className="truncate" title={r.agent || ''}>
                    {r.agent || '—'}
                  </td>
                  {showIssuedAt && (
                    <td style={{ color: '#94a3b8', fontSize: '0.75rem' }} className="whitespace-nowrap">
                      {formatIST(r.issuedAt)}
                    </td>
                  )}
                  <td
                    style={{
                      color: expired ? '#f87171' : '#4ade80',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                    className="whitespace-nowrap"
                  >
                    {formatIST(r.validTill)}
                  </td>
                  {showStatus && (
                    <td>
                      <span className={expired ? 'badge-expired' : 'badge-active'}>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: 'currentColor', display: 'inline-block' }}
                        />
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                  )}
                  {onDelete && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title={`Delete certificate for ${r.vehicleNo}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors inline-flex items-center justify-center"
                        disabled={deletingId === r._id}
                        onClick={() => handleDeleteClick(r._id, r.vehicleNo)}
                      >
                        {deletingId === r._id ? (
                          <div className="spinner" style={{ width: 14, height: 14 }} />
                        ) : (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 001.5.06l.3-7.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmRecord && (
        <div className="modal-overlay" onClick={() => setConfirmRecord(null)}>
          <div className="modal-content glass-card p-6" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 001.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Certificate?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to delete the certificate for{' '}
                  <span className="font-mono font-bold text-sky-400">{confirmRecord.vehicleNo}</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setConfirmRecord(null)}
                disabled={deletingId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
