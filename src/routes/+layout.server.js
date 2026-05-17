import { db } from '$lib/db.js';

export async function load({ locals }) {
	if (!locals.appUser) return { appUser: null, overdueCount: 0 };

	const [[row]] = await db.query(`
		SELECT
			(SELECT COUNT(*) FROM purchase_orders
			 WHERE status = 'OPEN' AND expected_date < CURDATE()) +
			(SELECT COUNT(*) FROM production_runs
			 WHERE status = 'SCHEDULED' AND run_date < CURDATE()) +
			(SELECT COUNT(*) FROM production_runs
			 WHERE status = 'UNSCHEDULED') +
			(SELECT COUNT(*) FROM cut_downs
			 WHERE status = 'SCHEDULED' AND run_date < CURDATE()) +
			(SELECT COUNT(*) FROM cut_downs
			 WHERE status = 'UNSCHEDULED') +
			(SELECT COUNT(*) FROM shipments s
			 WHERE status = 'DRAFT' AND ship_date < CURDATE())
		AS n
	`);

	return { appUser: locals.appUser, overdueCount: row.n };
}
