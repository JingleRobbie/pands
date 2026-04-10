import { db } from '$lib/db.js';
import { localDate } from '$lib/utils.js';

export async function load() {
	const today = localDate();
	const [todayRuns] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.run_date = ? AND pr.status = 'SCHEDULED'
		 ORDER BY pr.run_number`,
		[today]
	);
	const [upcoming] = await db.query(
		`SELECT pr.*, ms.display_label, so.so_number, so.job_name
		 FROM production_runs pr
		 JOIN material_skus ms ON ms.id = pr.sku_id
		 JOIN sales_order_lines sol ON sol.id = pr.so_line_id
		 JOIN sales_orders so ON so.id = sol.so_id
		 WHERE pr.run_date > ? AND pr.status = 'SCHEDULED'
		 ORDER BY pr.run_date, pr.run_number`,
		[today]
	);
	return { todayRuns, upcoming, today };
}
