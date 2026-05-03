import { getAllShipments } from '$lib/services/shipping.js';
import { localDate } from '$lib/utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultFromDate() {
	const d = new Date();
	d.setDate(d.getDate() - 90);
	return localDate(d);
}

export async function load({ url }) {
	const requested = url.searchParams.get('status') ?? '';
	const status = ['shipped', 'all'].includes(requested) ? requested : 'draft';
	const requestedFrom = (url.searchParams.get('from') ?? '').trim();
	const from = status === 'draft' ? '' : DATE_RE.test(requestedFrom) ? requestedFrom : defaultFromDate();
	const shipments = await getAllShipments({ status, from });
	return { shipments, status, from };
}
