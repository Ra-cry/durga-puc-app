'use client';

import { useState, useEffect, useCallback } from 'react';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_LABELS: Record<number, string> = {
  1: 'Week 1 (1–7)',
  2: 'Week 2 (8–14)',
  3: 'Week 3 (15–21)',
  4: 'Week 4 (22–28)',
  5: 'Week 5 (29–31)',
};

interface FilterBarProps {
  type: 'old' | 'expired';
  onFilterChange: (params: { startDate?: string; endDate?: string }) => void;
  onExport: (params: { startDate?: string; endDate?: string }) => void;
  exporting?: boolean;
}

export default function FilterBar({ type, onFilterChange, onExport, exporting }: FilterBarProps) {
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Fetch years on mount
  useEffect(() => {
    const fetchYears = async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch(`/api/puc/meta?type=${type}`);
        const data = await res.json();
        setYears(data.years || []);
      } catch {
        console.error('Failed to fetch years');
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchYears();
  }, [type]);

  // Fetch months when year changes
  useEffect(() => {
    if (!selectedYear) {
      setMonths([]);
      setWeeks([]);
      setSelectedMonth('');
      setSelectedWeek('');
      return;
    }
    const fetchMonths = async () => {
      try {
        const res = await fetch(`/api/puc/meta?type=${type}&year=${selectedYear}`);
        const data = await res.json();
        setMonths(data.months || []);
        setSelectedMonth('');
        setSelectedWeek('');
        setWeeks([]);
      } catch {
        console.error('Failed to fetch months');
      }
    };
    fetchMonths();
  }, [selectedYear, type]);

  // Fetch weeks when month changes
  useEffect(() => {
    if (!selectedYear || !selectedMonth) {
      setWeeks([]);
      setSelectedWeek('');
      return;
    }
    const fetchWeeks = async () => {
      try {
        const res = await fetch(`/api/puc/meta?type=${type}&year=${selectedYear}&month=${selectedMonth}`);
        const data = await res.json();
        setWeeks(data.weeks || []);
        setSelectedWeek('');
      } catch {
        console.error('Failed to fetch weeks');
      }
    };
    fetchWeeks();
  }, [selectedYear, selectedMonth, type]);

  const getDateRange = useCallback((): { startDate?: string; endDate?: string } => {
    if (!selectedYear) return {};

    const y = parseInt(selectedYear);

    if (selectedMonth && selectedWeek) {
      const m = parseInt(selectedMonth);
      const w = parseInt(selectedWeek);
      // Week 1: days 1-7, Week 2: 8-14, etc.
      const startDay = (w - 1) * 7 + 1;
      const endDay = Math.min(w * 7, new Date(y, m, 0).getDate());
      const start = new Date(Date.UTC(y, m - 1, startDay, 0, 0, 0));
      // Adjust for IST offset (+5:30 = -330 min)
      const startIST = new Date(start.getTime() - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, endDay, 23, 59, 59, 999));
      const endIST = new Date(end.getTime() - 330 * 60 * 1000);
      return { startDate: startIST.toISOString(), endDate: endIST.toISOString() };
    }

    if (selectedMonth) {
      const m = parseInt(selectedMonth);
      const lastDay = new Date(y, m, 0).getDate();
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const startIST = new Date(start.getTime() - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));
      const endIST = new Date(end.getTime() - 330 * 60 * 1000);
      return { startDate: startIST.toISOString(), endDate: endIST.toISOString() };
    }

    // Year only
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const startIST = new Date(start.getTime() - 330 * 60 * 1000);
    const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    const endIST = new Date(end.getTime() - 330 * 60 * 1000);
    return { startDate: startIST.toISOString(), endDate: endIST.toISOString() };
  }, [selectedYear, selectedMonth, selectedWeek]);

  const handleSearch = () => {
    const range = getDateRange();
    onFilterChange(range);
  };

  const handleExport = () => {
    const range = getDateRange();
    onExport(range);
  };

  const handleClear = () => {
    setSelectedYear('');
    setSelectedMonth('');
    setSelectedWeek('');
    setMonths([]);
    setWeeks([]);
    onFilterChange({});
  };

  return (
    <div
      className="flex flex-wrap gap-3 items-end p-4 rounded-xl"
      style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)' }}
    >
      {/* Year */}
      <div style={{ minWidth: 130 }}>
        <label className="form-label" htmlFor="filter-year">
          Year
        </label>
        <select
          id="filter-year"
          className="select-field"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          disabled={loadingMeta}
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Month */}
      <div style={{ minWidth: 150 }}>
        <label className="form-label" htmlFor="filter-month">
          Month
        </label>
        <select
          id="filter-month"
          className="select-field"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          disabled={!selectedYear || months.length === 0}
        >
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {MONTH_NAMES[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Week */}
      <div style={{ minWidth: 160 }}>
        <label className="form-label" htmlFor="filter-week">
          Week / Range
        </label>
        <select
          id="filter-week"
          className="select-field"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          disabled={!selectedMonth || weeks.length === 0}
        >
          <option value="">Full Month</option>
          {weeks.map((w) => (
            <option key={w} value={w}>
              {WEEK_LABELS[w] || `Week ${w}`}
            </option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pb-0.5">
        <button id="filter-search" className="btn-primary" onClick={handleSearch}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          Search
        </button>

        {selectedYear && (
          <button id="filter-clear" className="btn-secondary" onClick={handleClear}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
            Clear
          </button>
        )}

        <button
          id="filter-export"
          className="btn-success"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              Exporting...
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
              Export Excel
            </>
          )}
        </button>
      </div>
    </div>
  );
}
