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

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  year?: string;
  month?: string;
  week?: string;
  day?: string;
}

interface FilterBarProps {
  type: 'old' | 'expired';
  onFilterChange: (params: FilterParams) => void;
  onExport: (params: FilterParams) => void;
  exporting?: boolean;
}

export default function FilterBar({ type, onFilterChange, onExport, exporting }: FilterBarProps) {
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [days, setDays] = useState<number[]>([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Fetch years on mount
  useEffect(() => {
    const fetchYears = async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch(`/api/puc/meta?type=${type}`);
        const data = await res.json();
        setYears(data.years || [new Date().getFullYear()]);
      } catch {
        setYears([new Date().getFullYear()]);
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
      setDays([]);
      setSelectedMonth('');
      setSelectedWeek('');
      setSelectedDay('');
      return;
    }
    const fetchMonths = async () => {
      try {
        const res = await fetch(`/api/puc/meta?type=${type}&year=${selectedYear}`);
        const data = await res.json();
        setMonths(data.months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        setSelectedMonth('');
        setSelectedWeek('');
        setSelectedDay('');
        setWeeks([]);
        setDays([]);
      } catch {
        setMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      }
    };
    fetchMonths();
  }, [selectedYear, type]);

  // Fetch weeks & days when month changes
  useEffect(() => {
    if (!selectedYear || !selectedMonth) {
      setWeeks([]);
      setDays([]);
      setSelectedWeek('');
      setSelectedDay('');
      return;
    }
    const fetchWeeksAndDays = async () => {
      try {
        const res = await fetch(
          `/api/puc/meta?type=${type}&year=${selectedYear}&month=${selectedMonth}`
        );
        const data = await res.json();
        setWeeks(data.weeks || [1, 2, 3, 4, 5]);

        const y = parseInt(selectedYear);
        const m = parseInt(selectedMonth);
        const numDays = new Date(y, m, 0).getDate();
        const availableDays =
          data.days && data.days.length > 0
            ? data.days
            : Array.from({ length: numDays }, (_, i) => i + 1);
        setDays(availableDays);
        setSelectedWeek('');
        setSelectedDay('');
      } catch {
        setWeeks([1, 2, 3, 4, 5]);
        setDays(Array.from({ length: 31 }, (_, i) => i + 1));
      }
    };
    fetchWeeksAndDays();
  }, [selectedYear, selectedMonth, type]);

  const getDateRange = useCallback((): FilterParams => {
    if (!selectedYear) return {};

    const y = parseInt(selectedYear);

    // Specific Day chosen
    if (selectedMonth && selectedDay) {
      const m = parseInt(selectedMonth);
      const d = parseInt(selectedDay);
      const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      const startIST = new Date(start.getTime() - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      const endIST = new Date(end.getTime() - 330 * 60 * 1000);
      return {
        startDate: startIST.toISOString(),
        endDate: endIST.toISOString(),
        year: selectedYear,
        month: selectedMonth,
        day: selectedDay,
      };
    }

    // Week chosen
    if (selectedMonth && selectedWeek) {
      const m = parseInt(selectedMonth);
      const w = parseInt(selectedWeek);
      const startDay = (w - 1) * 7 + 1;
      const endDay = Math.min(w * 7, new Date(y, m, 0).getDate());
      const start = new Date(Date.UTC(y, m - 1, startDay, 0, 0, 0));
      const startIST = new Date(start.getTime() - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, endDay, 23, 59, 59, 999));
      const endIST = new Date(end.getTime() - 330 * 60 * 1000);
      return {
        startDate: startIST.toISOString(),
        endDate: endIST.toISOString(),
        year: selectedYear,
        month: selectedMonth,
        week: selectedWeek,
      };
    }

    // Month chosen
    if (selectedMonth) {
      const m = parseInt(selectedMonth);
      const lastDay = new Date(y, m, 0).getDate();
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const startIST = new Date(start.getTime() - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999));
      const endIST = new Date(end.getTime() - 330 * 60 * 1000);
      return {
        startDate: startIST.toISOString(),
        endDate: endIST.toISOString(),
        year: selectedYear,
        month: selectedMonth,
      };
    }

    // Year only
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const startIST = new Date(start.getTime() - 330 * 60 * 1000);
    const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    const endIST = new Date(end.getTime() - 330 * 60 * 1000);
    return {
      startDate: startIST.toISOString(),
      endDate: endIST.toISOString(),
      year: selectedYear,
    };
  }, [selectedYear, selectedMonth, selectedWeek, selectedDay]);

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
    setSelectedDay('');
    setMonths([]);
    setWeeks([]);
    setDays([]);
    onFilterChange({});
  };

  return (
    <div
      className="flex flex-wrap gap-3 items-end p-4 rounded-xl"
      style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)' }}
    >
      {/* Year */}
      <div className="flex-1 min-w-[120px]">
        <label className="form-label" htmlFor="filter-year">
          Year
        </label>
        <select
          id="filter-year"
          className="select-field"
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
            setSelectedMonth('');
            setSelectedWeek('');
            setSelectedDay('');
          }}
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
      <div className="flex-1 min-w-[140px]">
        <label className="form-label" htmlFor="filter-month">
          Month
        </label>
        <select
          id="filter-month"
          className="select-field"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setSelectedWeek('');
            setSelectedDay('');
          }}
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
      <div className="flex-1 min-w-[140px]">
        <label className="form-label" htmlFor="filter-week">
          Week
        </label>
        <select
          id="filter-week"
          className="select-field"
          value={selectedWeek}
          onChange={(e) => {
            setSelectedWeek(e.target.value);
            if (e.target.value) setSelectedDay('');
          }}
          disabled={!selectedMonth || weeks.length === 0 || !!selectedDay}
        >
          <option value="">Full Month</option>
          {weeks.map((w) => (
            <option key={w} value={w}>
              {WEEK_LABELS[w] || `Week ${w}`}
            </option>
          ))}
        </select>
      </div>

      {/* Day */}
      <div className="flex-1 min-w-[110px]">
        <label className="form-label" htmlFor="filter-day">
          Day / Date
        </label>
        <select
          id="filter-day"
          className="select-field"
          value={selectedDay}
          onChange={(e) => {
            setSelectedDay(e.target.value);
            if (e.target.value) setSelectedWeek('');
          }}
          disabled={!selectedMonth || days.length === 0 || !!selectedWeek}
        >
          <option value="">All Days</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2 pb-0.5 items-center">
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
