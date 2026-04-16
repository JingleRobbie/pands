/** Return today's date (or a given Date) as YYYY-MM-DD in local time */
export function localDate(d = new Date()) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format a date string or Date object to "Apr 7, 2026" */
export function fmtDate(d) {
	if (!d) return '—';
	const s = typeof d === 'string' ? d : d.toISOString();
	return new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
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
