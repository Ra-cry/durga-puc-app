'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSunSatWeeksForMonth,
  getDaysForMonth,
  SunSatWeek,
  DayOption,
} from '@/lib/clientHelpers';

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Fetch years from meta or fallback to standard year list
  useEffect(() => {
    const fetchYears = async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch(`/api/puc/meta?type=${type}`);
        const data = await res.json();
        const serverYears: number[] = data.years || [];
        const currentY = new Date().getFullYear();
        // Combine server years with range from 2024 to current + 3
        const yearSet = new Set<number>([
          ...serverYears,
          2024,
          2025,
          2026,
          2027,
          currentY,
        ]);
        const sorted = Array.from(yearSet).sort((a, b) => b - a);
        setYears(sorted);
      } catch {
        const currentY = new Date().getFullYear();
        setYears([2027, 2026, 2025, 2024, currentY].sort((a, b) => b - a));
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchYears();
  }, [type]);

  // Dynamic Sunday-to-Saturday weeks for selected year & month
  const weeksList: SunSatWeek[] = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    if (isNaN(y) || isNaN(m)) return [];
    return getSunSatWeeksForMonth(y, m);
  }, [selectedYear, selectedMonth]);

  // Dynamic days (1..31) for selected year & month
  const daysList: DayOption[] = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    if (isNaN(y) || isNaN(m)) return [];
    return getDaysForMonth(y, m);
  }, [selectedYear, selectedMonth]);

  const getDateRange = useCallback((): FilterParams => {
    if (!selectedYear) return {};

    const y = parseInt(selectedYear);

    // Specific Day chosen
    if (selectedMonth && selectedDay) {
      const dNum = parseInt(selectedDay);
      const matchedDay = daysList.find((d) => d.day === dNum);
      if (matchedDay) {
        return {
          startDate: matchedDay.startDateIST,
          endDate: matchedDay.endDateIST,
          year: selectedYear,
          month: selectedMonth,
          day: selectedDay,
        };
      }
      const m = parseInt(selectedMonth);
      const start = new Date(Date.UTC(y, m - 1, dNum, 0, 0, 0) - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, dNum, 23, 59, 59, 999) - 330 * 60 * 1000);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        year: selectedYear,
        month: selectedMonth,
        day: selectedDay,
      };
    }

    // Week chosen (Sunday to Saturday)
    if (selectedMonth && selectedWeek) {
      const wNum = parseInt(selectedWeek);
      const matchedWeek = weeksList.find((w) => w.weekNum === wNum);
      if (matchedWeek) {
        return {
          startDate: matchedWeek.startDateIST,
          endDate: matchedWeek.endDateIST,
          year: selectedYear,
          month: selectedMonth,
          week: selectedWeek,
        };
      }
    }

    // Month chosen
    if (selectedMonth) {
      const m = parseInt(selectedMonth);
      const lastDay = new Date(y, m, 0).getDate();
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - 330 * 60 * 1000);
      const end = new Date(Date.UTC(y, m - 1, lastDay, 23, 59, 59, 999) - 330 * 60 * 1000);
      return {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        year: selectedYear,
        month: selectedMonth,
      };
    }

    // Year only
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0) - 330 * 60 * 1000);
    const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - 330 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      year: selectedYear,
    };
  }, [selectedYear, selectedMonth, selectedWeek, selectedDay, weeksList, daysList]);

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
          disabled={!selectedYear}
        >
          <option value="">All Months</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <option key={m} value={m}>
              {MONTH_NAMES[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Week (Sunday to Saturday) */}
      <div className="flex-1 min-w-[170px]">
        <label className="form-label" htmlFor="filter-week">
          Week (Sun – Sat)
        </label>
        <select
          id="filter-week"
          className="select-field"
          value={selectedWeek}
          onChange={(e) => {
            setSelectedWeek(e.target.value);
            if (e.target.value) setSelectedDay('');
          }}
          disabled={!selectedMonth || weeksList.length === 0 || !!selectedDay}
        >
          <option value="">Full Month</option>
          {weeksList.map((w) => (
            <option key={w.weekNum} value={w.weekNum}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      {/* Day */}
      <div className="flex-1 min-w-[150px]">
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
          disabled={!selectedMonth || daysList.length === 0 || !!selectedWeek}
        >
          <option value="">All Days</option>
          {daysList.map((d) => (
            <option key={d.day} value={d.day}>
              {d.label}
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
