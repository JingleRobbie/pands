/** Return today's date (or a given Date) as YYYY-MM-DD in local time */
export function localDate(d = new Date()) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format an ISO date string to "Apr 7, 2026" */
export function fmtDate(dateStr) {
	if (!dateStr) return '—';
	return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

/** Format a sqft integer with thousands separator */
export function fmtSqft(n) {
	if (n == null) return '—';
	return Number(n).toLocaleString();
}
