/** Sanitize vehicle number (remove spaces & hyphens, uppercase) */
export function sanitizeVehicleNo(vehicleNo: string): string {
  return (vehicleNo || '').replace(/[\s-]/g, '').toUpperCase();
}

/** Sanitize phone number (keep digits only) */
export function sanitizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

/** Format an ISO date string to IST dd-MM-yyyy (Day) (client-safe) */
export function formatIST(dateStr: string | Date, includeDay = false): string {
  if (!dateStr) return '—';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '—';

  const datePart = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  if (includeDay) {
    const dayPart = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(date);
    return `${datePart} (${dayPart})`;
  }

  return datePart;
}

/** Format an ISO date string to IST date and day */
export function formatISTDateWithDay(dateStr: string | Date): string {
  return formatIST(dateStr, true);
}

/** Format an ISO date string without time/seconds */
export function formatISTDateTime(dateStr: string | Date): string {
  return formatIST(dateStr, false);
}

/** Compute validity display string from bsStage */
export function getValidityLabel(bsStage: string): string {
  if (bsStage === 'BS6') return '12 months';
  if (['BS1', 'BS2', 'BS3', 'BS4'].includes(bsStage)) return '6 months';
  return '—';
}

/** Compute validTill date from issuedAt and bsStage (client-side preview only) */
export function computeValidTillClient(issuedAt: Date, bsStage: string): Date {
  const d = new Date(issuedAt);
  const months = bsStage === 'BS6' ? 12 : 6;
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d;
}

/** Check if a PUC record is expired */
export function isRecordExpired(validTill: string | Date | undefined, status?: string): boolean {
  if (status === 'expired') return true;
  if (!validTill) return false;
  const vt = typeof validTill === 'string' ? new Date(validTill).getTime() : validTill.getTime();
  if (isNaN(vt)) return status === 'expired';
  return vt < Date.now();
}

/** Get current date in YYYY-MM-DD format in IST timezone for date inputs */
export function getTodayISTDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

/** Fuel short code mappings: Petrol -> P, Diesel -> D, Gas/CNG/LPG -> G */
export function getFuelShortCode(fuel?: string): 'P' | 'D' | 'G' {
  if (!fuel) return 'P';
  const f = fuel.trim().toUpperCase();
  if (f === 'D' || f.startsWith('DIESEL')) return 'D';
  if (f === 'G' || f.startsWith('GAS') || f.startsWith('CNG') || f.startsWith('LPG')) return 'G';
  return 'P'; // default Petrol
}

/** Get full fuel name from code or name */
export function getFuelFullName(fuel?: string): string {
  const code = getFuelShortCode(fuel);
  if (code === 'D') return 'Diesel';
  if (code === 'G') return 'Gas';
  return 'Petrol';
}

/** Standard Vehicle Classes */
export const VEHICLE_CLASSES = ['MC', 'CAR', 'LORRY', 'MMV'] as const;

export interface SunSatWeek {
  weekNum: number;
  startDay: number;
  endDay: number;
  label: string;
  startDateIST: string;
  endDateIST: string;
}

/** Compute Sunday-to-Saturday week ranges for any given year & month in IST */
export function getSunSatWeeksForMonth(year: number, month: number): SunSatWeek[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: SunSatWeek[] = [];
  const MONTH_SHORT = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mName = MONTH_SHORT[month] || '';

  let curDay = 1;
  let weekIndex = 1;

  while (curDay <= daysInMonth) {
    const startDay = curDay;
    // Day of week in IST: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const curDate = new Date(year, month - 1, curDay);
    const dayOfWeek = curDate.getDay();

    // End on Saturday (day 6), or the last day of the month
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    let endDay = startDay + daysUntilSaturday;
    if (endDay > daysInMonth) {
      endDay = daysInMonth;
    }

    const startDate = new Date(Date.UTC(year, month - 1, startDay, 0, 0, 0) - 330 * 60 * 1000);
    const endDate = new Date(Date.UTC(year, month - 1, endDay, 23, 59, 59, 999) - 330 * 60 * 1000);

    const startStr = `${String(startDay).padStart(2, '0')} ${mName}`;
    const endStr = `${String(endDay).padStart(2, '0')} ${mName}`;

    let label = '';
    if (startDay === endDay) {
      const dayName = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(year, month - 1, startDay));
      label = `Week ${weekIndex} (${startStr}, ${dayName})`;
    } else {
      label = `Week ${weekIndex} (${startStr} – ${endStr})`;
    }

    weeks.push({
      weekNum: weekIndex,
      startDay,
      endDay,
      label,
      startDateIST: startDate.toISOString(),
      endDateIST: endDate.toISOString(),
    });

    curDay = endDay + 1;
    weekIndex++;
  }

  return weeks;
}

export interface DayOption {
  day: number;
  label: string;
  startDateIST: string;
  endDateIST: string;
}

/** Compute all days for any given year & month */
export function getDaysForMonth(year: number, month: number): DayOption[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: DayOption[] = [];
  const MONTH_SHORT = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mName = MONTH_SHORT[month] || '';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayName = new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(dateObj);
    const startDate = new Date(Date.UTC(year, month - 1, d, 0, 0, 0) - 330 * 60 * 1000);
    const endDate = new Date(Date.UTC(year, month - 1, d, 23, 59, 59, 999) - 330 * 60 * 1000);

    days.push({
      day: d,
      label: `${String(d).padStart(2, '0')} ${mName} (${dayName})`,
      startDateIST: startDate.toISOString(),
      endDateIST: endDate.toISOString(),
    });
  }
  return days;
}

/** Indian vehicle number validation */
export function validateVehicleNo(vehicleNo: string): boolean {
  const sanitized = sanitizeVehicleNo(vehicleNo);
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,5}$/.test(sanitized);
}
