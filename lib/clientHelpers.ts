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
  return d;
}

/** Indian vehicle number validation */
export function validateVehicleNo(vehicleNo: string): boolean {
  const sanitized = sanitizeVehicleNo(vehicleNo);
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(sanitized);
}

