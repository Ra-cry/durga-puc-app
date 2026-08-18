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
  const startIST = startOfDay(nowInIST);
  return fromZonedTime(startIST, IST);
}

/** End of today in IST (as UTC Date for MongoDB queries) */
export function endOfTodayIST(): Date {
  const nowInIST = toZonedTime(new Date(), IST);
  const endIST = endOfDay(nowInIST);
  return fromZonedTime(endIST, IST);
}

/** Start of a given IST date */
export function startOfDayIST(year: number, month: number, day: number): Date {
  const istDate = new Date(year, month - 1, day, 0, 0, 0);
  return fromZonedTime(istDate, IST);
}

/** End of a given IST date */
export function endOfDayIST(year: number, month: number, day: number): Date {
  const istDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  return fromZonedTime(istDate, IST);
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

/** Indian vehicle number validation regex */
export const VEHICLE_NO_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

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
  if (!input) return null;

  // Handle JS Date object
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getUTCFullYear();
    const m = input.getUTCMonth();
    const d = input.getUTCDate();
    const istDate = new Date(y, m, d, 12, 0, 0);
    return fromZonedTime(istDate, IST);
  }

  // Handle Excel serial date numbers (e.g. 46252)
  const num = typeof input === 'number' ? input : Number(String(input).trim());
  if (!isNaN(num) && num > 1000 && num < 100000) {
    // Excel base epoch is 1899-12-30 (25569 days to 1970-01-01)
    const utcDays = Math.floor(num - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      const year = dateInfo.getUTCFullYear();
      const month = dateInfo.getUTCMonth();
      const day = dateInfo.getUTCDate();
      const istDate = new Date(year, month, day, 12, 0, 0);
      return fromZonedTime(istDate, IST);
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // Standard string date parsing (splits on -, /, .)
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    let year: number;
    let month: number;
    let day: number;

    if (parts[0].length === 4) {
      // yyyy-mm-dd
      [year, month, day] = parts.map(Number);
    } else {
      // dd-mm-yyyy
      [day, month, year] = parts.map(Number);
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
        const istDate = new Date(year, month - 1, day, 12, 0, 0);
        return fromZonedTime(istDate, IST);
      }
    }
  }

  // Fallback for Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    const d = parsed.getDate();
    const istDate = new Date(y, m, d, 12, 0, 0);
    return fromZonedTime(istDate, IST);
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

