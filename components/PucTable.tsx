'use client';

import { formatIST } from '@/lib/clientHelpers';

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
}

export default function PucTable({
  records,
  loading = false,
  emptyMessage = 'No records found',
  showStatus = false,
  showIssuedAt = true,
}: PucTableProps) {
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
        <svg
          viewBox="0 0 48 48"
          fill="none"
          className="w-12 h-12 opacity-30"
        >
          <rect x="8" y="6" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16h16M16 22h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Vehicle No</th>
            <th>BS Stage</th>
            <th>Fuel</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Agent</th>
            {showIssuedAt && <th>Issued On</th>}
            <th>Valid Till</th>
            {showStatus && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const expired = r.status === 'expired' || new Date(r.validTill) < new Date();
            return (
              <tr key={r._id} className="animate-fade-in">
                <td style={{ color: '#475569', fontSize: '0.75rem' }}>{i + 1}</td>
                <td>{r.vehicleNo}</td>
                <td>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
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
                <td>{r.customerName}</td>
                <td style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{r.customerPhone}</td>
                <td style={{ color: '#64748b' }}>{r.agent || '—'}</td>
                {showIssuedAt && (
                  <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {formatIST(r.issuedAt)}
                  </td>
                )}
                <td
                  style={{
                    color: expired ? '#f87171' : '#4ade80',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {formatIST(r.validTill)}
                </td>
                {showStatus && (
                  <td>
                    <span className={expired ? 'badge-expired' : 'badge-active'}>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'currentColor', display: 'inline-block' }}
                      />
                      {expired ? 'Expired' : 'Active'}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
