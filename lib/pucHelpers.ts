import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { addMonths, subDays, startOfDay, endOfDay } from 'date-fns';

export const IST = 'Asia/Kolkata';

/** Returns current time as a Date object (UTC), but represents IST "now" */
export function nowIST(): Date {
  return new Date();
}

/** Convert any Date to its IST representation */
export function toIST(date: Date): Date {
  return toZonedTime(date, IST);
}

/** Start of today in IST (as UTC Date for MongoDB queries) */
export function startOfTodayIST(): Date {
  const nowInIST = toZonedTime(new Date(), IST);
  const y = nowInIST.getFullYear();
  const m = nowInIST.getMonth();
  const d = nowInIST.getDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - 330 * 60 * 1000);
}

/** End of today in IST (as UTC Date for MongoDB queries) */
export function endOfTodayIST(): Date {
  const nowInIST = toZonedTime(new Date(), IST);
  const y = nowInIST.getFullYear();
  const m = nowInIST.getMonth();
  const d = nowInIST.getDate();
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - 330 * 60 * 1000);
}

/** Start of a given IST date */
export function startOfDayIST(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 330 * 60 * 1000);
}

/** End of a given IST date */
export function endOfDayIST(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 330 * 60 * 1000);
}

/** Start of a month in IST */
export function startOfMonthIST(year: number, month: number): Date {
  return startOfDayIST(year, month, 1);
}

/** End of a month in IST */
export function endOfMonthIST(year: number, month: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return endOfDayIST(year, month, lastDay);
}

/** Start of a year in IST */
export function startOfYearIST(year: number): Date {
  return startOfDayIST(year, 1, 1);
}

/** End of a year in IST */
export function endOfYearIST(year: number): Date {
  return endOfDayIST(year, 12, 31);
}

/** Get week number in month for a given IST date */
export function getWeekOfMonth(date: Date): number {
  const istDate = toZonedTime(date, IST);
  const dayOfMonth = istDate.getDate();
  return Math.ceil(dayOfMonth / 7);
}

/** Compute validTill date based on bsStage (6 months - 1 day for BS1..BS4, 12 months - 1 day for BS6) */
export function computeValidTill(issuedAt: Date, bsStage: string): Date {
  const months = bsStage === 'BS6' ? 12 : 6;
  return subDays(addMonths(issuedAt, months), 1);
}

/** Format a Date to IST string for display */
export function formatIST(date: Date, fmt = 'dd-MM-yyyy'): string {
  return format(toZonedTime(date, IST), fmt, { timeZone: IST });
}

/** Format a Date to IST datetime string */
export function formatISTDateTime(date: Date): string {
  return format(toZonedTime(date, IST), 'dd-MM-yyyy HH:mm:ss', { timeZone: IST });
}

/** Indian vehicle number validation regex — relaxed to allow 3-5 trailing digits */
export const VEHICLE_NO_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/;

/** Sanitize vehicle number */
export function sanitizeVehicleNo(vehicleNo: string): string {
  return (vehicleNo || '').replace(/[\s-]/g, '').toUpperCase();
}

/** Validate a vehicle number */
export function validateVehicleNo(vehicleNo: string): boolean {
  return VEHICLE_NO_REGEX.test(sanitizeVehicleNo(vehicleNo));
}

/** Parse dd-mm-yyyy, yyyy-mm-dd, Excel serial number, or Date object to a Date in IST */
export function parseISTDate(input: any): Date | null {
  if (input === null || input === undefined || input === '') return null;

  // 1. Handle JS Date object (e.g. from xlsx cellDates: true)
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    // Round to nearest second to eliminate SheetJS float microsecond rounding errors
    const rounded = new Date(Math.round(input.getTime() / 1000) * 1000);
    const zoned = toZonedTime(rounded, IST);
    const y = zoned.getFullYear();
    const m = zoned.getMonth();
    const d = zoned.getDate();
    return new Date(Date.UTC(y, m, d, 6, 30, 0)); // Midday 12:00 IST (06:30 UTC)
  }

  // 2. Handle Excel serial date numbers (e.g. 46253 or "46253" or 46253.25)
  const isPureNumber = typeof input === 'number' || (
    typeof input === 'string' &&
    /^\d+(\.\d+)?$/.test(input.trim()) &&
    Number(input.trim()) > 1000 &&
    Number(input.trim()) < 100000
  );

  if (isPureNumber) {
    const num = Number(input);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      // Excel epoch: 1899-12-30. 25569 is days to 1970-01-01.
      const utcDays = Math.floor(num - 25569);
      const ms = utcDays * 86400 * 1000;
      const dateObj = new Date(ms);
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getUTCFullYear();
        const m = dateObj.getUTCMonth();
        const d = dateObj.getUTCDate();
        return new Date(Date.UTC(y, m, d, 6, 30, 0));
      }
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // 3. String date parsing — extract leading date portion if time is present
  // Handles "19-08-2026 10:30 AM", "19/08/2026", "2026-08-19", "19.08.2026", "19-08-26"
  const dateMatch = str.match(/^(\d{1,4})[-/. ](\d{1,2})[-/. ](\d{1,4})/);
  if (dateMatch) {
    let year: number;
    let month: number;
    let day: number;

    const p1 = parseInt(dateMatch[1], 10);
    const p2 = parseInt(dateMatch[2], 10);
    const p3 = parseInt(dateMatch[3], 10);

    if (dateMatch[1].length === 4) {
      // yyyy-mm-dd
      year = p1;
      month = p2;
      day = p3;
    } else {
      // dd-mm-yyyy or dd-mm-yy
      day = p1;
      month = p2;
      year = p3 < 100 ? 2000 + p3 : p3;
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
        return new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
      }
    }
  }

  // 4. Fallback for ISO strings or English date strings like "19 Aug 2026"
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const zoned = toZonedTime(parsed, IST);
    const y = zoned.getFullYear();
    const m = zoned.getMonth();
    const d = zoned.getDate();
    return new Date(Date.UTC(y, m, d, 6, 30, 0));
  }

  return null;
}

/** Get current IST time components */
/** Get fuel short code (P / D / G) */
export function getFuelShortCode(fuel?: string): 'P' | 'D' | 'G' {
  if (!fuel) return 'P';
  const f = fuel.trim().toUpperCase();
  if (f === 'D' || f.startsWith('DIESEL')) return 'D';
  if (f === 'G' || f.startsWith('GAS') || f.startsWith('CNG') || f.startsWith('LPG')) return 'G';
  return 'P';
}

/** Get full fuel name */
export function getFuelFullName(fuel?: string): string {
  const code = getFuelShortCode(fuel);
  if (code === 'D') return 'Diesel';
  if (code === 'G') return 'Gas';
  return 'Petrol';
}

