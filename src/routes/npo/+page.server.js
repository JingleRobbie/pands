import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultFromDate() {
	const d = new Date();
	d.setDate(d.getDate() - 28);
	return localDate(d);
}

export async function load({ locals, url }) {
	const requested = url.searchParams.get('status') ?? '';
	const status = ['complete', 'all'].includes(requested) ? requested : 'open';
	const requestedFrom = (url.searchParams.get('from') ?? '').trim();
	const from = status === 'open' ? '' : DATE_RE.test(requestedFrom) ? requestedFrom : defaultFromDate();

	const where = ["wo.order_type = 'NON_PRODUCTION'"];
	const params = [];

	if (status === 'open') {
		where.push("wo.status = 'OPEN'");
	} else if (status === 'complete') {
		where.push("wo.status = 'COMPLETE'");
	}
	if (from && status !== 'open') {
		where.push('wo.ship_date >= ?');
		params.push(from);
	}

	const [npos] = await db.query(
		`SELECT wo.id, wo.so_number, wo.customer_name, wo.job_name, wo.ship_date, wo.ship_asap, wo.status, wo.created_at,
		        COUNT(wol.id) AS line_count,
		        COALESCE(SUM(wol.sqft), 0) AS total_sqft
		 FROM work_orders wo
		 LEFT JOIN work_order_lines wol ON wol.wo_id = wo.id
		 WHERE ${where.join(' AND ')}
		 GROUP BY wo.id
		 ORDER BY wo.created_at DESC`,
		params
	);

	return { npos, user: locals.appUser, status, from };
}
