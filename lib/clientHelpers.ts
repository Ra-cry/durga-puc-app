/** Format an ISO date string to IST dd-MM-yyyy using Intl (client-safe) */
export function formatIST(dateStr: string | Date): string {
  if (!dateStr) return '—';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Format an ISO date string to IST dd-MM-yyyy HH:mm (client-safe) */
export function formatISTDateTime(dateStr: string | Date): string {
  if (!dateStr) return '—';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(vehicleNo.trim().toUpperCase());
}
