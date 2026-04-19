import { db } from '$lib/db.js';

export async function load({ locals }) {
	const [wos] = await db.query(
		`SELECT wo.id, wo.so_number, wo.customer_name, wo.job_name, wo.branch, wo.ship_date, wo.status,
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
		 GROUP BY wo.id
		 ORDER BY wo.created_at DESC`
	);
	return { wos, user: locals.appUser };
}
