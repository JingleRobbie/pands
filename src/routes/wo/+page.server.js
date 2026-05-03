import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultFromDate() {
	const d = new Date();
	d.setDate(d.getDate() - 90);
	return localDate(d);
}

export async function load({ locals, url }) {
	const requested = url.searchParams.get('status') ?? '';
	const status = ['complete', 'all'].includes(requested) ? requested : 'open';
	const requestedFrom = (url.searchParams.get('from') ?? '').trim();
	const from =
		status === 'open' ? '' : DATE_RE.test(requestedFrom) ? requestedFrom : defaultFromDate();

	const where = [];
	const params = [];
	if (status === 'open') {
		where.push("wo.status = 'OPEN'");
	} else if (status === 'complete') {
		where.push("wo.status = 'COMPLETE'");
	}
	if (from && status !== 'open') {
		where.push(
			status === 'complete'
				? 'COALESCE(activity.completed_at, wo.ship_date) >= ?'
				: `CASE
				     WHEN wo.status = 'COMPLETE' THEN COALESCE(activity.completed_at, wo.ship_date)
				     ELSE wo.ship_date
				   END >= ?`
		);
		params.push(from);
	}

	const [wos] = await db.query(
		`SELECT wo.id, wo.so_number, wo.customer_name, wo.job_name, wo.branch, wo.ship_date, wo.status,
		        activity.completed_at,
		        COUNT(wol.id) AS line_count,
		        COALESCE(SUM(wol.sqft), 0) AS total_sqft,
		        COALESCE(SUM(wol.qty), 0) AS total_rolls,
		        COALESCE(SUM(wol.rolls_produced), 0) AS rolls_produced,
		        COALESCE((
		          SELECT SUM(pr.rolls_scheduled)
		          FROM production_runs pr
		          JOIN work_order_lines wol2 ON wol2.id = pr.wo_line_id
		          WHERE wol2.wo_id = wo.id AND pr.status != 'COMPLETED'
		        ), 0) AS rolls_scheduled
		 FROM work_orders wo
		 LEFT JOIN work_order_lines wol ON wol.wo_id = wo.id
		 LEFT JOIN (
		   SELECT wol2.wo_id, DATE(MAX(pr.confirmed_at)) AS completed_at
		   FROM production_runs pr
		   JOIN work_order_lines wol2 ON wol2.id = pr.wo_line_id
		   WHERE pr.status = 'COMPLETED'
		   GROUP BY wol2.wo_id
		 ) activity ON activity.wo_id = wo.id
		 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		 GROUP BY wo.id
		 ORDER BY COALESCE(activity.completed_at, wo.ship_date) DESC, wo.created_at DESC`,
		params
	);
	return { wos, user: locals.appUser, status, from };
}
