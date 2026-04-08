import { db } from '$lib/db.js';

export async function load() {
	const [sos] = await db.query(
		`SELECT so.*, COUNT(sol.id) AS line_count
		 FROM sales_orders so
		 LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
		 WHERE so.status IN ('OPEN','IN_PROGRESS')
		 GROUP BY so.id ORDER BY so.ship_date, so.so_number`
	);
	return { sos };
}
