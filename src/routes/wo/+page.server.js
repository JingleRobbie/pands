import { db } from '$lib/db.js';

export async function load({ locals }) {
	const [wos] = await db.query(
		`SELECT wo.id, wo.so_number, wo.customer_name, wo.job_name, wo.branch, wo.ship_date, wo.facing, wo.status,
		        COUNT(wol.id) AS line_count,
		        COALESCE(SUM(wol.sqft), 0) AS total_sqft
		 FROM work_orders wo
		 LEFT JOIN work_order_lines wol ON wol.wo_id = wo.id
		 GROUP BY wo.id
		 ORDER BY wo.created_at DESC`
	);
	return { wos, user: locals.appUser };
}
