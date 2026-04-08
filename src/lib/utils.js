/** Format an ISO date string to "Apr 7, 2026" */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

/** Format a sqft integer with thousands separator */
export function fmtSqft(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}
