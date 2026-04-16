import { db } from '$lib/db.js';

export async function load() {
	const [pos] = await db.query(
		`SELECT po.*, COUNT(pol.id) AS open_lines
		 FROM purchase_orders po
		 JOIN purchase_order_lines pol ON pol.po_id = po.id AND pol.status = 'OPEN'
		 WHERE po.status = 'OPEN'
		 GROUP BY po.id
		 ORDER BY po.expected_date ASC`
	);
	return { pos };
}
